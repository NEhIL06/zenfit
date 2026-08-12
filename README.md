# ZenFit — AI-Powered Fitness & Nutrition Platform

ZenFit is a production-grade, full-stack fitness and nutrition application. It acts as a personalized, AI-driven personal trainer that generates tailored workout routines, diet plans, and provides an interactive conversational interface powered by a highly optimized Self-RAG (Retrieval-Augmented Generation) pipeline.

This repository demonstrates advanced systems design, emphasizing strict type safety, robust caching, multimodal AI orchestration, and deterministic fallback mechanisms designed for scale.

## 🏗 High-Level Architecture (HLD)

ZenFit employs a modern Next.js App Router architecture, cleanly separating client-side state management from server-side edge logic.

- **Frontend:** React Server Components (RSC) and Client Components, utilizing `framer-motion` for micro-animations and `zod` for strict runtime payload validation (`handleApiResponse`).
- **API Gateway & Middleware:** Next.js Edge Middleware handles request verification. It intercepts JWTs (`jose`), validates `httpOnly` cookies, and injects `x-user-id` headers, allowing downstream API routes to bypass redundant database lookups.
- **Database (MongoDB):** Native MongoDB driver usage optimized for performance. Data is stored across `users`, `user_plans`, and `milestones` collections, with strict `ObjectId` validation and nested document updates.
- **Caching Layer (Upstash Redis):** A robust, serverless-safe Redis implementation. Uses deterministic SHA-256 key hashing (`hashKey`) to prevent collisions, `SCAN`-based cursor eviction (avoiding blocking `KEYS` commands), and fine-grained TTLs (e.g., 30 days for images, 1 hour for personalized RAG context).
- **Vector Database (ChromaDB):** Handles document embeddings for the AI Trainer.

## 🧠 Advanced Self-RAG AI Pipeline (LLD)

The core feature of ZenFit is the "AI Trainer," powered by a highly optimized, graph-based RAG architecture using LangGraph (`StateGraph`).

### The Workflow Pipeline
1. **Zero-Cost Fast Path Routing:** Incoming queries are immediately evaluated by a synchronous zero-cost classifier (`classifyQuerySync`). If the query is an ambiguous edge case, it falls back to a lightweight (5-token max) LLM call. Queries classified as "general" bypass the RAG pipeline entirely.
2. **Context Pre-fetching:** To avoid dynamic import latency inside graph execution nodes, the user's specific workout/diet plan is pre-fetched and injected statically into the graph's initial state.
3. **Retrieval & Batched Grading:** Documents are retrieved from ChromaDB (using HuggingFace `bge-base-en-v1.5` embeddings). Instead of grading documents sequentially, ZenFit uses a **Batched Grading Node** — a single LLM call that outputs a JSON array grading all retrieved documents simultaneously, cutting LLM latency by 80%.
4. **Cross-Encoder Reranking:** Filtered documents pass through a Cohere reranker to ensure the highest contextual relevance.
5. **Web Search Fallback:** If retrieval fails or documents are graded irrelevant, the pipeline dynamically falls back to a parallelized DuckDuckGo search (Wikipedia + PubMed Open Access).
6. **Hallucination Checking:** A final faithfulness node verifies the generated response against the source context to prevent dangerous fitness hallucinations.

### Multimodal Fallback Chain
ZenFit implements a highly resilient, multi-tiered architecture for image generation to ensure 100% uptime:
1. **Primary:** Nanobanana API (High-quality, specialized inference)
2. **Secondary:** Gemini Vision API (Flash models)
3. **Tertiary:** Pollinations AI (Zero-cost, URL-based deterministic fallback using seeded hashing)

## ⚡ Key Optimizations & Trade-offs

- **Trade-off: JWT Edge Verification over DB Sessions.** 
  - *Decision:* We use stateless JWTs verified at the edge rather than database-backed sessions.
  - *Why:* Reduces TTFB (Time to First Byte) and database load. The trade-off is a lack of immediate server-side revocation, which is mitigated by short-lived JWT expiry windows.
- **Trade-off: Zod Schema Warnings over Hard Blocking on Responses.**
  - *Decision:* While inbound requests are strictly blocked on Zod failure (400 Bad Request), outbound AI responses are validated but only *warn* on failure (`validateResponse`).
  - *Why:* LLMs can occasionally drift in JSON schema. A missing optional field shouldn't crash the user's UI. This fail-open approach prioritizes User Experience (UX) while logging the drift for developer monitoring.
- **Optimization: Fail-Open Rate Limiting.**
  - Redis-based sliding window rate limiting is implemented on sensitive endpoints. If Upstash Redis experiences downtime, the rate limiter fails open, ensuring the application remains functional rather than blocking legitimate traffic.
- **Optimization: Payload Normalization & Password Stripping.**
  - Backend API routes proactively strip password hashes and aggressively type-cast MongoDB responses into safe `UserProfile` shapes before serialization, preventing sensitive data leaks over the wire.

## 🛠 Tech Stack Summary

- **Core Framework:** Next.js 14, React 18, TypeScript
- **Styling & UI:** Tailwind CSS, Framer Motion, Sonner (Toasts), Lucide Icons
- **Data & Storage:** MongoDB (Native), Upstash Redis, ChromaDB
- **AI Providers:** Mistral (Chat/Routing), HuggingFace (Embeddings), Nanobanana/Gemini/Pollinations (Vision/Image), Cohere (Reranking)
- **Security:** `jose` (Edge JWTs), `bcryptjs`, `zod` (Validation)

## 🚀 Running Locally

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Populate the `.env` file with required keys (MongoDB, Upstash, Mistral, HF, JWT Secret).
3. Start the development server:
   ```bash
   npm run dev
   ```

## Production Flow Contract

The main user journey is:

1. `POST /api/users` creates the user, hashes the password, sets the `zenfit_auth_token` httpOnly cookie, and returns `userId`.
2. Signup stores `current_user_id` in `localStorage` and triggers `POST /api/generate-plan` as a background request.
3. The dashboard loads the current user from `localStorage`; if that value is missing but the auth cookie is still valid, it recovers the session through `GET /api/users`.
4. Plan generation always uses the authenticated JWT user id on the server. The client does not control plan ownership.
5. Plans are persisted in `user_plans`; profile updates do not store plan payloads.
6. AI Trainer chat posts to `POST /api/ai-trainer/chat`, which authenticates the cookie, classifies the message, and runs Self-RAG for fitness requests.
7. User RAG documents upload into `fitness_user_${userId}`, the same collection used by chat retrieval.

## Environment Variables

Required for a production deployment:

```bash
MONGODB_URI=
JWT_SECRET=at_least_32_characters
MISTRAL_API_KEY=
HF_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

RAG can run with local Chroma or Chroma Cloud:

```bash
# Local Docker Chroma
CHROMA_SERVER_URL=http://chroma:8000

# Chroma Cloud, used only when all three are present
CHROMA_API_KEY=
CHROMA_TENANT_ID=
CHROMA_DATABASE=
```

Optional AI/media providers:

```bash
GEMINI_API_KEY=
NANOBANANA_API_KEY=
ENABLE_GEMINI_IMAGE=false
```

## CI/CD

GitHub Actions runs on every commit pushed to `main` or `master`, and on pull requests targeting those branches. The deploy job runs only after lint, type-check, audit, tests, and production build pass.

Repository secrets required for Vercel deploy:

```bash
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Application runtime secrets such as `MONGODB_URI`, `JWT_SECRET`, `MISTRAL_API_KEY`, `HF_API_KEY`, Upstash keys, and Chroma keys must be configured in the Vercel project environment because `vercel build --prod` reads production environment variables from Vercel.

## Docker and Nginx

`docker-compose.yml` starts three services: `app`, `chroma`, and `nginx`. The app talks to local Chroma through `CHROMA_SERVER_URL=http://chroma:8000`. Nginx terminates TLS, proxies to `app:3000`, applies API/auth rate limits, forwards `X-Forwarded-*` headers, and exposes the ACME challenge webroot at `/var/www/certbot`.

Before using the Nginx stack in production, update `server_name` in `nginx/nginx.conf` and mount valid TLS certificates into `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`.
