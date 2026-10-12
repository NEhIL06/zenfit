# ZenFit — AI Engine Service & RabbitMQ Workers (Phase 3)

High-performance Python / FastAPI microservice and background worker cluster responsible for LangGraph Self-RAG, ChromaDB vector indexing, and asynchronous LLM workout & nutrition plan synthesis.

---

## 1. Architectural Highlights

- **Asynchronous Request-Reply (HTTP 202 Accepted)**:
  - `POST /v1/plan/generate` validates user biometrics and goals, enforces distributed idempotency via Redis locks (`idempotency:plan:{userId}:{key}`), and enqueues to RabbitMQ `q.plans` in **< 20ms**.
- **Resilient Worker Cluster (`worker.py`)**:
  - Pulls tasks from `q.plans` with bounded concurrency (`prefetch_count`).
  - Executes CSCS-certified prompt calculations (Mifflin-St Jeor TDEE formulas) and Mistral structured plan generation.
  - Writes completed plan to MongoDB `user_plans` collection.
  - Purges stale user RAG caches in Redis.
  - Broadcasts `{ "type": "job_completed" }` event to Redis Pub/Sub channel `events:{userId}`, delivered in real time to the browser via the Go Gateway's embedded SSE Hub.
  - **Strict ACK Sequencing**: Message `basic_ack` occurs **strictly after** MongoDB write and Redis publish succeed, preventing silent job drops.
  - **Poison-Pill Mitigation & DLQ**: 3x exponential backoff retries before routing dead messages to `q.plans.dlq` with failure notifications.
- **LangGraph Self-RAG Pipeline**:
  - Zero-cost sync classification (`fitness` vs `general`).
  - ChromaDB multi-tenant search (global knowledge + per-user training history).
  - Batched LLM document grading, cross-encoder reranking, and web search fallback.
  - Real-time token streaming over HTTP/2 SSE (`POST /v1/chat`).
- **Circuit Breakers**:
  - Third-party AI APIs (Mistral, Gemini, Pollinations) protected with circuit breakers to prevent thread pool starvation during external outages.

---

## 2. API Endpoints

| Method | Endpoint | Description | Latency Profile |
|--------|----------|-------------|-----------------|
| `GET` | `/health/live` | Process liveness probe | < 2ms |
| `GET` | `/health/ready` | Datastore readiness probe (Redis, RabbitMQ, Chroma) | < 10ms |
| `POST` | `/v1/plan/generate` | Asynchronous plan generation (returns HTTP 202) | < 20ms |
| `GET` | `/v1/plan/jobs/{id}` | Fallback polling for plan status reconciliation | < 5ms |
| `POST` | `/v1/chat` | AI Trainer Chat & Self-RAG (JSON or SSE stream) | 200ms TTFT |
| `POST` | `/v1/image/generate` | Exercise & meal photograph synthesis (3-tier fallback) | Sub-second |
| `GET` | `/v1/quote` | Daily motivational quote (cached in Redis) | < 2ms |
| `POST` | `/v1/quote/personalized` | Personalized motivation quote | < 200ms |
| `POST` | `/v1/documents` | Ingest guidelines and documents into ChromaDB | Batch |

---

## 3. Local Development

```powershell
# 1. Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 2. Run API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Run background RabbitMQ worker
python worker.py

# 4. Run test suite
pytest -v
```
