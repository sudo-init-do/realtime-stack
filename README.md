Here’s a clean **README.md** you can drop in, followed by the exact next steps to keep building.

---

# Realtime Stack — WebSockets + RabbitMQ + Kafka (+ Postgres, Redis)

A minimal, production-style **real-time platform** that showcases:

* **Instant messaging & presence** via **WebSockets**
* **Reliable task processing** via **RabbitMQ** (with retries/DLQs next)
* **High-throughput event streaming** via **Kafka**
* **Postgres** (persistence) & **Redis** (counters/leaderboards) via Docker

This repo is designed to be an employer-impressive, end-to-end demo of event-driven architecture.

## Architecture (v1)

```
Web Client  ⇄  WS Gateway ──► RabbitMQ (persist_message)
     │             │  └────► Kafka (chat_events)
     │             └───────── in-memory room fanout (v1)
     └────────────────────────────────────────► Realtime UX
```

**Planned next:**

* Chat Persist Worker (RabbitMQ consumer → Postgres)
* DLQ + retry queues (RabbitMQ)
* Events pipeline (Kafka consumer → Redis counters)
* Live leaderboard fanout via WS
* Next.js client (replace HTML test page)

## Tech Stack

* **TypeScript/Node.js** services
* **WebSockets** (`ws`)
* **RabbitMQ** (`amqplib`)
* **Kafka** (`kafkajs`)
* **PostgreSQL** (Docker)
* **Redis** (Docker)
* **Docker Compose** (infra)

## Quick Start

### 1) Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d
```

Dashboards:

* RabbitMQ UI → [http://localhost:15672](http://localhost:15672) (user: `dev`, pass: `dev`)
* Kafka (PLAINTEXT\_HOST) → `localhost:9094`
* Postgres → `localhost:5432` (user: `postgres`, pass: `postgres`, db: `realtimedb`)
* Redis → `localhost:6379`

### 2) Run the WebSocket Gateway

```bash
cd ../../
npm install -w apps/ws-gateway
cp apps/ws-gateway/.env.example apps/ws-gateway/.env
npm run dev:ws
```

### 3) Test from the simple client

Open **`apps/web-client/index.html`** in your browser and check the console.

* On connect: joins `room-1`
* Sends a “hello world” message
* You’ll see real-time echoes and a Kafka `message_sent` event logged in the gateway

## Repository Layout

```
apps/
  ws-gateway/         # WebSocket server (auth, join room, broadcast)
  web-client/         # Minimal test page (Next.js client coming next)
packages/
  shared/             # Shared types (reserved)
  config/             # Shared config (reserved)
infrastructure/
  docker/             # Docker Compose: RabbitMQ, Kafka, Postgres, Redis
  db/                 # DB init files (placeholder for now)
```

## Environment Variables

Create `.env` files from the examples:

* Root `.env.example` (shared defaults)
* `apps/ws-gateway/.env.example` (service env)

Common variables:

```
JWT_SECRET=dev-secret
RABBIT_URL=amqp://dev:dev@localhost:5672
KAFKA_BROKER=localhost:9094
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/realtimedb
REDIS_URL=redis://localhost:6379
```

## NPM Scripts (root)

```bash
npm run dev:ws     # start ws-gateway in watch mode
```

## Troubleshooting

* **WS connection closes immediately:** token not accepted → ensure gateway `.env` has `JWT_SECRET=dev-secret` (default) and the client builds a token string.
* **RabbitMQ not reachable:** confirm `docker compose ps` shows `mq` healthy; check `RABBIT_URL`.
* **Kafka errors:** ensure `kafka` is up; use `localhost:9094` from the host.
* **Port conflicts:** stop other local DBs/brokers or change Compose ports.

## Why this repo is valuable

* Demonstrates **realtime UX**, **operational reliability**, and **streaming analytics** in one place.
* Clean separation of concerns and cloud-friendly architecture.
* Easy to extend into a full “startup-grade” demo (DLQs, metrics, Next.js UI, CI/CD).

---

## What’s Next (precise build order)

1. **Add the Chat Persist Worker (RabbitMQ → Postgres)**

   * Create `apps/chat-service/` with a RabbitMQ consumer for `persist_message`.
   * Use Prisma (or pg) to persist messages.
   * Add a `messages` table (id, room\_id, user\_id, text, ts).
   * Log a success metric; `ack` on success, `nack` to DLQ on failure.

2. **Introduce DLQ + Retry Queues (Reliability)**

   * Configure `persist_message` with `x-dead-letter-exchange` and a **retry** queue (TTL).
   * Flow: main queue → (nack) → retry queue (delayed) → main queue (reprocess) → DLQ after N attempts.

3. **Events Pipeline (Kafka Consumer)**

   * New service `apps/events-pipeline/` consuming `chat_events`.
   * Maintain per-room counters (e.g., messages/min) → store in Redis (for fast reads).
   * Expose a tiny HTTP endpoint to fetch counters (for the UI).

4. **Live Leaderboard**

   * `apps/leaderboard-service/` consuming engagement events (or reuse `chat_events` for now).
   * Update Redis **sorted sets**; push deltas to clients via the WS gateway (add a “leaderboard” channel).

5. **Replace the HTML test page with a Next.js client**

   * `apps/web-client/` → Next.js 14 + Tailwind + shadcn/ui.
   * Pages: Chat room, Live counters, Leaderboard.
   * Token creation (dev only) and a minimal login screen.

6. **Observability (stretch)**

   * Add OpenTelemetry tracing on WS → MQ → Service → Kafka.
   * Export Prometheus metrics (connections, queue depth, consumer lag).

7. **GitHub CI (stretch)**

   * Lint, typecheck, build, and a lightweight integration test (spins up Docker services in CI).

---

