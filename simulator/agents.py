import threading
import time
import requests
import math
import json
from kafka import KafkaConsumer
from config import TRACKING_URL, NUM_AGENTS, PING_INTERVAL, STEP_SIZE
from routes import ROUTES

# ──────────────────────────────────────────────────────────────────
# OSRM request handling
#
# router.project-osrm.org is the free PUBLIC OSRM demo server. It is
# only meant for light/occasional testing and will start throttling
# or rejecting requests under real load (multiple agents, repeated
# patrol legs, etc). When that happens the old code silently fell
# back to a straight line between the two endpoints, which is why
# agents appeared to cut through buildings/water instead of driving
# on roads ("teleporting through the air").
#
# Fixes applied below:
#   1. Retry with backoff instead of giving up on the first failure.
#   2. A global throttle so all agent threads don't hammer the free
#      server at the same time (which is what triggers the rate
#      limiting/blocking in the first place).
#   3. A route cache — patrol legs repeat the same start/end pair
#      over and over, so there's no reason to refetch every time.
#   4. Proper validation of the HTTP status + response body before
#      trusting it.
#   5. Loud logging when we truly do have to fall back, instead of a
#      single easy-to-miss print.
#
# NOTE: for a real production deployment you should not rely on the
# public demo server at all — self-host OSRM, or use a provider like
# Mapbox/GraphHopper with an API key. The retry/throttle/cache logic
# below makes the simulator behave correctly, but the public server
# can still refuse you outright if enough people use it at once.
# ──────────────────────────────────────────────────────────────────

_OSRM_LOCK = threading.Lock()
_OSRM_MIN_INTERVAL = 2.0  # seconds between OSRM calls, across ALL agents
_osrm_last_call = [0.0]

_route_cache = {}
_route_cache_lock = threading.Lock()


def _throttle_osrm():
    """Ensure at least _OSRM_MIN_INTERVAL seconds between OSRM requests,
    shared across every agent thread, so we don't get rate-limited."""
    with _OSRM_LOCK:
        now = time.time()
        wait = _osrm_last_call[0] + _OSRM_MIN_INTERVAL - now
        if wait > 0:
            time.sleep(wait)
        _osrm_last_call[0] = time.time()


def _route_cache_key(start_lat, start_lng, end_lat, end_lng):
    return (round(start_lat, 5), round(start_lng, 5),
            round(end_lat, 5), round(end_lng, 5))


def calculate_bearing(lat1, lng1, lat2, lng2):
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    diff_lng = math.radians(lng2 - lng1)
    x = math.sin(diff_lng) * math.cos(lat2_r)
    y = (math.cos(lat1_r) * math.sin(lat2_r) -
         math.sin(lat1_r) * math.cos(lat2_r) * math.cos(diff_lng))
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def get_road_waypoints(start_lat, start_lng, end_lat, end_lng, max_retries=4):
    """
    Fetch a road-following route from OSRM.

    Retries with backoff on failure/rate-limiting, throttles requests
    globally so multiple agents don't overwhelm the free demo server,
    and caches results since patrol legs reuse the same start/end
    pair repeatedly. Only falls back to a straight line as an
    absolute last resort, and logs loudly when it does so it's
    obvious in the logs instead of silently degrading.
    """
    cache_key = _route_cache_key(start_lat, start_lng, end_lat, end_lng)
    with _route_cache_lock:
        cached = _route_cache.get(cache_key)
    if cached is not None:
        return cached

    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{start_lng},{start_lat};{end_lng},{end_lat}"
        f"?overview=full&geometries=geojson"
    )
    headers = {"User-Agent": "TrackFlow-Simulator/1.0"}

    last_error = None
    for attempt in range(1, max_retries + 1):
        _throttle_osrm()
        try:
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 429:
                # Rate limited — back off harder and retry
                last_error = "HTTP 429 rate limited"
                time.sleep(2 * attempt)
                continue

            if response.status_code != 200:
                last_error = f"HTTP {response.status_code}"
                time.sleep(1 * attempt)
                continue

            data = response.json()
            if data.get("code") == "Ok" and data.get("routes"):
                coordinates = data["routes"][0]["geometry"]["coordinates"]
                waypoints = [(c[1], c[0]) for c in coordinates]
                with _route_cache_lock:
                    _route_cache[cache_key] = waypoints
                return waypoints

            last_error = f"OSRM returned code={data.get('code')}"
            time.sleep(1 * attempt)

        except Exception as e:
            last_error = str(e)
            time.sleep(1 * attempt)

    # All retries exhausted — this should be rare. Log it loudly so
    # it's obvious this is happening rather than a quiet one-liner.
    print(
        f"*** OSRM ROUTE FETCH FAILED after {max_retries} attempts "
        f"({start_lat},{start_lng}) -> ({end_lat},{end_lng}). "
        f"Last error: {last_error}. Falling back to a straight-line "
        f"path — this agent will NOT follow roads for this leg. ***"
    )
    fallback = [(start_lat, start_lng), (end_lat, end_lng)]
    # Don't cache the fallback — we want future attempts to retry OSRM
    # rather than being stuck on a straight line permanently.
    return fallback


def send_order_status(order_id, agent_id, status, extra=None):
    payload = {
        "orderId": order_id,
        "agentId": agent_id,
        "status": status
    }
    if extra:
        payload.update(extra)

    try:
        # Notify tracking service for WebSocket broadcast
        requests.post(
            "http://localhost:8082/api/tracking/order-status",
            json=payload,
            timeout=3
        )
        # Update order status in MongoDB
        requests.patch(
            f"http://localhost:8095/api/orders/{order_id}/status",
            json={"status": status},
            timeout=3
        )
        print(f"[{agent_id}] Status sent: {status}")
    except Exception as e:
        print(f"[{agent_id}] Failed to send status: {e}")


def calculate_eta_minutes(from_lat, from_lng, to_lat, to_lng):
    """
    Estimate delivery time based on straight line distance
    and average city speed of 25 km/h.
    """
    R = 6371
    dLat = math.radians(to_lat - from_lat)
    dLng = math.radians(to_lng - from_lng)
    a = (math.sin(dLat/2) ** 2 +
         math.cos(math.radians(from_lat)) *
         math.cos(math.radians(to_lat)) *
         math.sin(dLng/2) ** 2)
    distance_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Add 30% for road routing vs straight line
    road_distance_km = distance_km * 1.3

    # Average city speed 25 km/h
    avg_speed_kmh = 25
    eta_minutes = (road_distance_km / avg_speed_kmh) * 60

    return max(2, round(eta_minutes))
    
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
    waypoints = get_road_waypoints(current_lat, current_lng, dest_lat, dest_lng)
    print(f"[{agent_id}] Delivery route: {len(waypoints)} waypoints")

    # Safety — if same position, skip
    if len(waypoints) < 2:
        print(f"[{agent_id}] WARNING: No waypoints, staying put")
        return current_lat, current_lng, 0.0

    lat = current_lat
    lng = current_lng
    bearing = 0.0

    for i in range(len(waypoints) - 1):
        target_lat, target_lng = waypoints[i + 1]
        lat_diff = target_lat - lat
        lng_diff = target_lng - lng
        distance = math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        # Safety — skip duplicate waypoints
        if distance < 0.000001:
            continue

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

    # Final ping at exact destination
    send_ping(agent_id, dest_lat, dest_lng, bearing)
    return dest_lat, dest_lng, bearing


def agent_loop(agent_id, route):
    print(f"[{agent_id}] Starting on route: {route['name']}")

    start_lat, start_lng = route["start"]
    end_lat, end_lng = route["end"]

    current_lat = start_lat
    current_lng = start_lng
    going_forward = True

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

            # Calculate ETA to drop
            eta = calculate_eta_minutes(
                pickup_lat, pickup_lng,
                drop_lat, drop_lng
            )

            # Pause at pickup — feels like picking up the order
            print(f"[{agent_id}] Picking up order... ETA {eta} mins")
            time.sleep(4)

            # Send PICKED_UP with all coordinates so frontend
            # can calculate accurate OSRM ETA
            send_order_status(order_id, agent_id, "PICKED_UP", {
                "eta": eta,
                "pickupLat": pickup_lat,
                "pickupLng": pickup_lng,
                "dropLat": drop_lat,
                "dropLng": drop_lng,
            })

            # Phase 2 — drive to drop (uninterruptible)
            print(f"[{agent_id}] Heading to drop")
            current_lat, current_lng, _ = drive_to_delivery(
                agent_id,
                current_lat, current_lng,
                drop_lat, drop_lng
            )

            print(f"[{agent_id}] Delivered!")
            send_order_status(order_id, agent_id, "DELIVERED")

            # Resume patrol from current position
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
