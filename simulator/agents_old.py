import threading
import time
import requests
import math
import json
from kafka import KafkaConsumer
from config import TRACKING_URL, NUM_AGENTS, PING_INTERVAL, STEP_SIZE
from routes import ROUTES


def calculate_bearing(lat1, lng1, lat2, lng2):
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    diff_lng = math.radians(lng2 - lng1)
    x = math.sin(diff_lng) * math.cos(lat2_r)
    y = (math.cos(lat1_r) * math.sin(lat2_r) -
         math.sin(lat1_r) * math.cos(lat2_r) * math.cos(diff_lng))
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def get_road_waypoints(start_lat, start_lng, end_lat, end_lng):
    try:
        url = (
            f"http://router.project-osrm.org/route/v1/driving/"
            f"{start_lng},{start_lat};{end_lng},{end_lat}"
            f"?overview=full&geometries=geojson"
        )
        response = requests.get(url, timeout=10)
        data = response.json()
        if data["code"] == "Ok":
            coordinates = data["routes"][0]["geometry"]["coordinates"]
            return [(c[1], c[0]) for c in coordinates]
        else:
            return [(start_lat, start_lng), (end_lat, end_lng)]
    except Exception as e:
        print(f"OSRM error: {e}")
        return [(start_lat, start_lng), (end_lat, end_lng)]


def send_order_status(order_id, agent_id, status):
    try:
        requests.post(
            "http://localhost:8082/api/tracking/order-status",
            json={
                "orderId": order_id,
                "agentId": agent_id,
                "status": status
            },
            timeout=3
        )
        print(f"[{agent_id}] Status sent: {status}")
    except Exception as e:
        print(f"[{agent_id}] Failed to send status: {e}")


def send_ping(agent_id, lat, lng, bearing):
    payload = {
        "agentId": agent_id,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "bearing": round(bearing, 2),
        "timestamp": int(time.time() * 1000)
    }
    try:
        requests.post(TRACKING_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"[{agent_id}] Ping failed: {e}")


def drive_to(agent_id, current_lat, current_lng, dest_lat, dest_lng, order_queue):
    """
    Drive from current position to destination along OSRM route.
    Checks order_queue at every step — if new order arrives, stops early.
    Returns final (lat, lng, bearing).
    """
    waypoints = get_road_waypoints(current_lat, current_lng, dest_lat, dest_lng)
    print(f"[{agent_id}] Route fetched: {len(waypoints)} waypoints")

    lat = current_lat
    lng = current_lng
    bearing = 0.0

    for i in range(len(waypoints) - 1):
        # Check for new order — stop early if one arrives during patrol
        if order_queue:
            break

        target_lat, target_lng = waypoints[i + 1]
        lat_diff = target_lat - lat
        lng_diff = target_lng - lng
        distance = math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        while distance >= STEP_SIZE:
            prev_lat, prev_lng = lat, lng
            ratio = STEP_SIZE / distance
            lat += lat_diff * ratio
            lng += lng_diff * ratio
            bearing = calculate_bearing(prev_lat, prev_lng, lat, lng)
            send_ping(agent_id, lat, lng, bearing)
            time.sleep(PING_INTERVAL)

            # Recalculate remaining distance to waypoint
            lat_diff = target_lat - lat
            lng_diff = target_lng - lng
            distance = math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        lat, lng = target_lat, target_lng

    return lat, lng, bearing


def drive_to_delivery(agent_id, current_lat, current_lng, dest_lat, dest_lng):
    """
    Drive to destination without interruption — used for pickup and drop phases.
    Returns final (lat, lng, bearing).
    """
    waypoints = get_road_waypoints(current_lat, current_lng, dest_lat, dest_lng)
    print(f"[{agent_id}] Delivery route: {len(waypoints)} waypoints")

    lat = current_lat
    lng = current_lng
    bearing = 0.0

    for i in range(len(waypoints) - 1):
        target_lat, target_lng = waypoints[i + 1]
        lat_diff = target_lat - lat
        lng_diff = target_lng - lng
        distance = math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        while distance >= STEP_SIZE:
            prev_lat, prev_lng = lat, lng
            ratio = STEP_SIZE / distance
            lat += lat_diff * ratio
            lng += lng_diff * ratio
            bearing = calculate_bearing(prev_lat, prev_lng, lat, lng)
            send_ping(agent_id, lat, lng, bearing)
            time.sleep(PING_INTERVAL)

            lat_diff = target_lat - lat
            lng_diff = target_lng - lng
            distance = math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        lat, lng = target_lat, target_lng

    return lat, lng, bearing


def agent_loop(agent_id, route):
    """
    Main loop for one agent.
    Patrols its default route.
    When order arrives in queue — handles full delivery then resumes patrol.
    """
    print(f"[{agent_id}] Starting on route: {route['name']}")

    start_lat, start_lng = route["start"]
    end_lat, end_lng = route["end"]

    current_lat = start_lat
    current_lng = start_lng
    going_forward = True

    # This agent's order queue — Kafka consumer appends here
    order_queue = agent_queues[agent_id]

    while True:

        # ── Check for pending order ──
        if order_queue:
            order = order_queue.pop(0)
            order_id = order["orderId"]
            pickup_lat = order["pickupLat"]
            pickup_lng = order["pickupLng"]
            drop_lat = order["dropLat"]
            drop_lng = order["dropLng"]

            print(f"[{agent_id}] Order {order_id} — heading to pickup")

            # Phase 1 — drive to pickup (uninterruptible)
            current_lat, current_lng, _ = drive_to_delivery(
                agent_id,
                current_lat, current_lng,
                pickup_lat, pickup_lng
            )
            print(f"[{agent_id}] Reached pickup!")
            send_order_status(order_id, agent_id, "PICKED_UP")

            # Phase 2 — drive to drop (uninterruptible)
            print(f"[{agent_id}] Heading to drop")
            current_lat, current_lng, _ = drive_to_delivery(
                agent_id,
                current_lat, current_lng,
                drop_lat, drop_lng
            )
            print(f"[{agent_id}] Delivered!")
            send_order_status(order_id, agent_id, "DELIVERED")

            # Resume patrol from current position toward route end
            going_forward = True
            continue

        # ── Normal patrol ──
        if going_forward:
            dest_lat, dest_lng = end_lat, end_lng
        else:
            dest_lat, dest_lng = start_lat, start_lng

        current_lat, current_lng, _ = drive_to(
            agent_id,
            current_lat, current_lng,
            dest_lat, dest_lng,
            order_queue
        )

        # Reverse direction at end of route
        going_forward = not going_forward


# One queue per agent — Kafka consumer appends, agent loop pops
agent_queues = {}


def kafka_consumer_loop():
    print("Connecting to Kafka...")

    while True:
        try:
            consumer = KafkaConsumer(
                "order-events",
                bootstrap_servers=["localhost:9092"],
                group_id=f"simulator-group-{int(time.time())}",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="latest",
                enable_auto_commit=True,
                consumer_timeout_ms=-1
            )
            print("Kafka consumer connected. Waiting for orders...")
            break
        except Exception as e:
            print(f"Kafka not ready: {e}. Retrying in 5s...")
            time.sleep(5)

    for message in consumer:
        try:
            event = message.value
            event_type = event.get("eventType", "")
            print(f"Kafka event received: {event_type} -> {event}")

            if event_type == "ORDER_ASSIGNED":
                agent_id = event.get("agentId")
                print(f"Order for agent: {agent_id}")

                if agent_id in agent_queues:
                    agent_queues[agent_id].append(event)
                    print(f"Queued for {agent_id} — queue size: {len(agent_queues[agent_id])}")
                else:
                    print(f"Agent {agent_id} not found. Known: {list(agent_queues.keys())}")

        except Exception as e:
            print(f"Error processing Kafka message: {e}")


def main():
    print(f"Starting TrackFlow simulator with {NUM_AGENTS} agents...")
    print(f"Tracking URL: {TRACKING_URL}")
    print(f"Ping interval: {PING_INTERVAL} seconds")
    print("-" * 50)

    # Initialize queues first
    for i in range(NUM_AGENTS):
        agent_id = f"sim-agent-{i+1:02d}"
        agent_queues[agent_id] = []

    print(f"Queues ready: {list(agent_queues.keys())}")

    # Start Kafka consumer first — before agents start moving
    kafka_thread = threading.Thread(
        target=kafka_consumer_loop,
        daemon=True
    )
    kafka_thread.start()
    print("Kafka consumer thread started")

    # Wait for consumer to connect
    time.sleep(3)

    # Start agent threads
    for i in range(NUM_AGENTS):
        route = ROUTES[i % len(ROUTES)]
        agent_id = f"sim-agent-{i+1:02d}"

        thread = threading.Thread(
            target=agent_loop,
            args=(agent_id, route),
            daemon=True
        )
        thread.start()
        print(f"Started {agent_id}")
        time.sleep(0.5)

    print(f"\nAll {NUM_AGENTS} agents running. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    main()
