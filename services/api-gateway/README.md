# ZenFit Go API Gateway (Phase 2 Core Service)

High-performance, low-latency API Gateway and Real-Time Event Hub for the **ZenFit** distributed microservices platform.

---

## 1. Architectural Responsibilities

The API Gateway acts as the trusted internal edge between Nginx and backend microservices:

1. **In-Process RS256 / HS256 JWT Verification:** Validates user authentication tokens in-memory in sub-millisecond time using public keys, eliminating per-request authentication roundtrips to databases.
2. **Zero-Trust Boundary Sanitization:** Unconditionally strips all client-supplied identity headers (`X-User-*`, `X-Internal-*`) before dispatching requests, and injects verified `X-User-Id` and `X-User-Role` claims downstream.
3. **Embedded SSE Real-Time Event Hub (`GET /v1/events`):** Manages long-lived client event streams via lightweight Go goroutines parked on Redis Pub/Sub channels (`events:{userId}`) with zero-leak automatic cleanup on client tab disconnection.
4. **Tiered Rate Limiting:** Enforces multi-tier sliding-window rate limits backed by Redis TCP, with fail-closed protection for high-cost GenAI endpoints during infrastructure degradation.
5. **Microservice Routing & Connection Pooling:** Reverse proxies traffic across Auth & Core, AI Engine, and Speech Service with HTTP keep-alive connection pooling.
6. **Observability:** Generates correlation `X-Request-Id` UUIDs and structured JSON access logs with millisecond latency timings.

---

## 2. Route Dispatch Matrix

| Path Pattern | Target Microservice | Authentication | Rate Limit Tier |
|---|---|---|---|
| `GET /health/live` | Gateway Local Stub | Public | Uncapped |
| `GET /health/ready` | Gateway Local Deep Check | Public | Uncapped |
| `GET /v1/events` | Embedded SSE Hub | Verified (JWT/Cookie/Query) | Uncapped Stream |
| `POST /v1/events/publish` | Embedded SSE Hub | Internal / Worker | Uncapped |
| `POST /v1/auth/*` | Auth & Core (`app:3000`) | Public | **Tier 3 (10 attempts/min)** |
| `ANY /v1/users/*` | Auth & Core (`app:3000`) | Verified | Tier 4 (60 req/min) |
| `ANY /v1/milestones/*` | Auth & Core (`app:3000`) | Verified | Tier 4 (60 req/min) |
| `POST /v1/chat` | AI Engine (`app:3000`) | Verified | **Tier 2 (10 req/min)** |
| `POST /v1/plan/*` | AI Engine (`app:3000`) | Verified | **Tier 2 (10 req/min)** |
| `POST /v1/image/*` | AI Engine (`app:3000`) | Verified | **Tier 2 (10 req/min)** |
| `GET /v1/quote` | AI Engine (`app:3000`) | Optional | Tier 1 (100 req/min) |
| `POST /v1/voice/*` | Speech Service (`speech:8080`) | Verified | Tier 2 (10 req/min) |
| `POST /v1/transcribe` | Speech Service (`speech:8080`) | Verified | Tier 2 (10 req/min) |
| `ANY /*` (Catch-all) | Auth & Core / Web App | Optional | Tier 1 (100 req/min) |

---

## 3. Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the Gateway HTTP server |
| `ENVIRONMENT` | `development` | Environment name (`development`, `production`) |
| `JWT_PUBLIC_KEY` | `""` | PEM string of the RSA public key for RS256 verification |
| `JWT_PUBLIC_KEY_PATH` | `""` | File path to RSA public key `.pem` file |
| `JWT_SECRET` | *(dev default)* | Symmetric fallback secret during gradual migration |
| `REDIS_URL` | `redis://localhost:6379` | Redis TCP connection URL for Pub/Sub & rate limiting |
| `AUTH_SERVICE_URL` | `http://localhost:3000` | Upstream URL for Auth & Core microservice |
| `AI_ENGINE_URL` | `http://localhost:3000` | Upstream URL for FastAPI AI Engine |
| `SPEECH_SERVICE_URL` | `http://localhost:8081` | Upstream URL for Go Speech & Audio Service |
| `RATE_LIMIT_GLOBAL` | `100` | Requests/minute per client IP |
| `RATE_LIMIT_AI` | `10` | Requests/minute per authenticated user for GenAI routes |

---

## 4. Development & Testing Commands

```bash
# Run all unit tests
make test

# Build binary
make build

# Start Gateway locally
make run

# Run load test & empirical benchmarks (requires running gateway)
make bench
```
