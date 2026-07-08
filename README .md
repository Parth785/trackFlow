<div align="center">

# 🛵 TrackFlow

### Real-Time Delivery Tracking System

*A production-grade microservices platform built from scratch — inspired by how Swiggy and Zomato actually work under the hood.*

![Java](https://img.shields.io/badge/Java-17-orange?style=flat-square&logo=java)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen?style=flat-square&logo=springboot)
![Apache Kafka](https://img.shields.io/badge/Kafka-3.6-black?style=flat-square&logo=apachekafka)
![Redis](https://img.shields.io/badge/Redis-7.2-red?style=flat-square&logo=redis)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green?style=flat-square&logo=mongodb)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?style=flat-square&logo=docker)

</div>

---

## What Is This?

TrackFlow is a full-stack real-time delivery tracking system. Place an order on a live map, watch the nearest delivery agent get assigned instantly, track them moving toward your pickup on real roads, and receive live status updates as the delivery progresses — all in real time, zero polling.

This is not a tutorial project. Every architectural decision was made to solve a real engineering problem.

---

## Demo

> *Place an order → Agent assigned instantly via Redis GEO → Agent drives to pickup on real Ahmedabad roads → Blue route line trims live as agent moves → Order picked up → Orange route to drop appears → Delivered*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│              Leaflet Map + WebSocket (STOMP/SockJS)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway :8080                          │
│                   Spring Cloud Gateway                          │
└────┬──────────────────┬──────────────────┬──────────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────┐      ┌─────────────┐    ┌──────────────┐
│  Agent  │      │    Order    │    │   Tracking   │
│ Service │      │   Service   │    │   Service    │
│  :8083  │      │    :8095    │    │    :8082     │
└────┬────┘      └──────┬──────┘    └──────┬───────┘
     │                  │                  │
     │           ┌──────▼──────┐           │
     │           │             │           │
     ▼           ▼             ▼           ▼
┌─────────┐ ┌────────┐  ┌──────────┐ ┌─────────┐
│  Redis  │ │ Kafka  │  │ MongoDB  │ │Cassandra│
│  GEO   │ │ Topics │  │  Orders  │ │Location │
│  Live  │ │ Events │  │  Agents  │ │ History │
└─────────┘ └────────┘  └──────────┘ └─────────┘
                │
                ▼
┌───────────────────────────┐
│   Notification Service    │
│  Kafka Consumer :8084     │
│  WebSocket Status Push    │
└───────────────────────────┘
                ▲
┌───────────────────────────┐
│    Python GPS Simulator   │
│  5 Agents × Real Routes   │
│  OSRM Road Routing        │
│  Kafka Order Consumer     │
└───────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| Backend | Spring Boot 3.2 (Java 17) | Production-grade, familiar ecosystem |
| Messaging | Apache Kafka (3 brokers) | Decoupled order lifecycle, replay capability |
| Live Location | Redis GEO | `GEORADIUS` nearest-agent query in <1ms |
| Primary DB | MongoDB | Flexible document model for orders/agents |
| Time-series | Cassandra | High write throughput for location history |
| Real-time | WebSocket (STOMP) | Zero-polling push to browser |
| Frontend | React + Leaflet.js | Live map with 60fps interpolated movement |
| Routing | OSRM (Open Source Routing Machine) | Real road routes, free, self-hostable |
| Simulation | Python + kafka-python | Multi-threaded GPS agent simulation |
| Infra | Docker Compose | One command local setup |

---

## Services

```
trackflow/
├── services/
│   ├── api-gateway/          # Spring Cloud Gateway — port 8080
│   ├── agent-service/        # Agent registration, Redis GEO — port 8083
│   ├── order-service/        # Order placement, assignment, stats — port 8095
│   ├── tracking-service/     # WebSocket server, location pipeline — port 8082
│   └── notification-service/ # Kafka consumer, status broadcasts — port 8084
├── simulator/                # Python GPS agent simulator
├── frontend/                 # React + Vite + Leaflet
└── docker-compose.yml        # Full infra in one file
```

---

## The Hard Problems

### 1. Nearest Agent Assignment at Scale

The naive approach — query MongoDB for all AVAILABLE agents and calculate distances in application code — doesn't scale. At 1000 agents that's 1000 DB reads per order.

TrackFlow uses **Redis GEO**. Every agent ping updates their coordinates in Redis using `GEOADD`. When an order is placed, a single `GEORADIUS` command returns all agents within 10km sorted by distance. Sub-millisecond, O(N+log M) complexity.

```java
GeoResults<RedisGeoCommands.GeoLocation<String>> results =
    redisTemplate.opsForGeo()
        .radius("agents:live", circle, args);
```

### 2. Smooth 60fps Movement on the Map

GPS pings arrive every 3 seconds. Jumping the icon to a new position every 3 seconds looks terrible. TrackFlow uses `requestAnimationFrame` to interpolate the marker's position between pings using an ease-in-out function — the agent appears to drive continuously at realistic speed.

```javascript
const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
// Runs at 60fps, interpolates between last ping and new ping position
```

### 3. Live Route Line Trimming

The blue route line (agent to pickup) needs to shrink as the agent moves — exactly like Swiggy. The challenge: route trimming must run at 60fps to stay in sync with the animated marker, not every 3 seconds when WebSocket updates arrive.

Solution: `useRouteProgress` hook runs against the animated position (from `useAnimatedPosition`) rather than the raw WebSocket position. The closest waypoint to the agent's visual position is found and the route is sliced from there.

### 4. WebSocket Fanout Across Multiple Server Instances

When tracking-service scales to multiple pods, a WebSocket connection on Pod-1 can't push to a customer connected to Pod-3. 

Solution: Redis pub/sub. Every location ping publishes to a Redis channel. All pods subscribe. All pods push to their connected clients. No missed messages regardless of which pod the agent's HTTP request hits.

### 5. OSRM Rate Limiting Under Load

The public OSRM demo server throttles aggressive callers. With 5+ agents all fetching routes simultaneously, most requests get rejected and fall back to straight lines — agents appear to drive through buildings.

Solution: Global throttle lock across all agent threads (1 OSRM call per 2 seconds), retry with exponential backoff, and route caching — patrol legs reuse the same start/end pair, so the route is fetched once and cached indefinitely.

```python
_OSRM_LOCK = threading.Lock()  # shared across all agent threads
_route_cache = {}              # keyed by (start_lat, start_lng, end_lat, end_lng)
```

### 6. Kafka Consumer Group Coordination

The Python simulator needs to consume `ORDER_ASSIGNED` events and route them to the correct agent thread. Using a fixed consumer group ID means Kafka remembers the offset — the simulator misses events published before it started.

Solution: Dynamic consumer group ID with timestamp suffix (`simulator-group-{timestamp}`), combined with `auto_offset_reset=latest`. Each simulator restart gets a fresh group — no stale offset issues.

---

## What Each Kafka Topic Does

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `order-events` | order-service | Python simulator | ORDER_ASSIGNED events route to correct agent |
| `location-events` | tracking-service | (future) | Location history pipeline |
| `notification-events` | order-service | notification-service | Status updates to customer browser |

---

## Local Setup

### Prerequisites

- Docker + Docker Compose
- Java 17+
- Maven
- Node.js 18+
- Python 3.10+

### 1. Start Infrastructure

```bash
git clone https://github.com/YOUR_USERNAME/trackflow.git
cd trackflow
docker compose up -d
```

This starts: Kafka (1 broker), Zookeeper, Kafdrop, MongoDB, Redis, Cassandra.

Add Kafka hostname to `/etc/hosts`:
```bash
echo "127.0.0.1 kafka1" | sudo tee -a /etc/hosts
```

### 2. Start Services

Open 4 terminals:

```bash
# Terminal 1
cd services/agent-service && mvn spring-boot:run

# Terminal 2
cd services/order-service && mvn spring-boot:run

# Terminal 3
cd services/tracking-service && mvn spring-boot:run

# Terminal 4
cd frontend && npm install && npm run dev
```

### 3. Register Agents

```bash
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:8083/api/agents/register \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"Agent $i\", \"phone\": \"9876543$i\", \"vehicleType\": \"BIKE\", \"initialLat\": 23.0225, \"initialLng\": 72.5714}"
done
```

### 4. Start Simulator

```bash
cd simulator
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python3 agents.py
```

### 5. Open the App

| URL | What |
|-----|------|
| `http://localhost:5173` | Customer view — place orders, track delivery |
| `http://localhost:5173/admin` | Admin dashboard — live stats, all agents |
| `http://localhost:9000` | Kafdrop — inspect Kafka topics and messages |

---

## API Reference

### Agent Service (8083)

```
POST   /api/agents/register          Register a new delivery agent
PATCH  /api/agents/{id}/status       Update agent status
GET    /api/agents                   List all agents
GET    /api/agents/{id}              Get specific agent
```

### Order Service (8095)

```
POST   /api/orders                   Place a new order (assigns nearest agent)
GET    /api/orders/{id}              Get order details
GET    /api/orders/{id}/route        Get OSRM route lines for map display
GET    /api/orders/customer/{id}     Orders by customer
GET    /api/orders/stats/summary     Today's stats (total, delivered, avg time)
GET    /api/orders/stats/hourly      Orders per hour for last 12 hours
GET    /api/orders/recent            Last 10 orders
PATCH  /api/orders/{id}/status       Update order status
```

### Tracking Service (8082)

```
POST   /api/tracking/location        Receive agent GPS ping (called by simulator)
POST   /api/tracking/order-status    Broadcast order status via WebSocket
WS     /ws-tracking                  WebSocket endpoint (STOMP over SockJS)
```

### WebSocket Topics

```
/topic/agents                        All agent location updates (admin map)
/topic/agent/{agentId}              Specific agent updates
/topic/order/{orderId}/status       Order status updates (ASSIGNED/PICKED_UP/DELIVERED)
```

---

## Data Models

### Order (MongoDB)

```json
{
  "_id": "6a4c90b44f15584f110ea3b6",
  "customerId": "customer-web-01",
  "agentId": "sim-agent-03",
  "status": "DELIVERED",
  "pickupLocation": {
    "lat": 23.0225,
    "lng": 72.5714,
    "address": "SG Highway, Ahmedabad"
  },
  "dropLocation": {
    "lat": 23.0892,
    "lng": 72.6200,
    "address": "Chandkheda, Ahmedabad"
  },
  "placedAt": "2024-01-15T17:00:00",
  "assignedAt": "2024-01-15T17:00:01",
  "deliveredAt": "2024-01-15T17:22:00"
}
```

### Agent (MongoDB)

```json
{
  "_id": "sim-agent-03",
  "name": "Agent 3",
  "vehicleType": "BIKE",
  "status": "AVAILABLE",
  "lastKnownLat": 23.0469,
  "lastKnownLng": 72.5269,
  "registeredAt": "2024-01-15T10:00:00",
  "lastActiveAt": "2024-01-15T17:22:05"
}
```

### Location History (Cassandra)

```sql
CREATE TABLE agent_location_history (
  agent_id  TEXT,
  timestamp TIMESTAMP,
  lat       DOUBLE,
  lng       DOUBLE,
  bearing   DOUBLE,
  PRIMARY KEY (agent_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);
```

---

## What I'd Do Differently at True Scale

**At 10,000 concurrent agents:**
- Replace public OSRM with self-hosted OSRM on dedicated hardware
- Kafka partitioning by `agentId` for ordered per-agent event processing
- Cassandra partition key by `(agent_id, date)` to prevent hot partitions
- WebSocket connection load balancing with sticky sessions at the ingress level

**At 100,000 concurrent agents:**
- Separate location ingestion service from WebSocket broadcast service
- Location updates to Redis Streams instead of direct GEO (better backpressure)
- CDN-hosted map tiles instead of public CartoDB
- Event sourcing on order lifecycle for full audit trail

---

## Roadmap

- [x] Core delivery tracking loop
- [x] Real-time WebSocket push
- [x] OSRM road routing
- [x] Live route trimming
- [x] Admin dashboard
- [ ] Kubernetes deployment with HPA
- [ ] Load testing with k6 (target: 500 pings/sec)
- [ ] Notification service (Kafka → WebSocket)
- [ ] Cassandra location history + route replay
- [ ] CI/CD with GitHub Actions

---

## Author

Built by **Eren** — Java backend developer with 4 years of experience building production systems.

Currently open to backend and full-stack roles at product companies.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat-square&logo=linkedin)](https://linkedin.com/in/YOUR_PROFILE)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME)

