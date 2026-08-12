# Architectural & Security Decision Log (ADR) — ZenFit Production Hardening

This document records the key architectural, security, performance, and operational decisions made for the ZenFit platform to transition it from a prototype codebase into a production-grade fitness & AI coaching product.

---

## 1. Authentication & Token Management

### Decision: Transition JWT Storage to Exclusive `httpOnly` Cookies with Bearer Fallback
- **What Was Done**: Removed raw JWT token strings from the JSON response body of `POST /api/auth/login`. Tokens are now set exclusively via `httpOnly`, `Secure`, `SameSite=Lax` cookies. Added `Authorization: Bearer <token>` header inspection as a fallback in `lib/auth.ts`.
- **Why**: 
  - Storing JWTs in browser `localStorage` or `sessionStorage` leaves them vulnerable to theft via Cross-Site Scripting (XSS).
  - `httpOnly` prevents client-side JavaScript from reading the session token.
  - Supporting `Authorization: Bearer` headers allows non-browser clients (mobile apps, external microservices) to authenticate safely without cookies.

### Decision: Enforce Minimum 32-Character Guard for `JWT_SECRET` Across All Non-Test Environments
- **What Was Done**: Updated `lib/constants.ts` to throw a fatal startup error if `JWT_SECRET` is missing, default/fallback, or under 32 characters in any environment (dev, staging, prod) except `test`.
- **Why**: Weak or hardcoded secrets permit offline token forgery and algorithm confusion attacks. Enforcing secret length at startup prevents accidental deployment with vulnerable configuration.

---

## 2. Access Control & Authorization Boundaries

### Decision: Implement Strict Ownership Guards on User Profile Endpoints
- **What Was Done**: Refactored `GET` and `PUT` `/api/users/[id]/route.ts` to extract the authenticated user from session context (`getAuthUserFromRequest`) and enforce `authUser.userId === targetId`.
- **Why**: Previously, any authenticated user (or unauthenticated request due to a faulty boolean operator) could read or overwrite any user's profile and PII by changing the URL parameter. Ownership guards enforce strict tenant boundary isolation.

### Decision: Strict Schema Binding & Enum Sanitization for Profile Updates
- **What Was Done**: Applied `UserProfileUpdateSchema.strict()` and constrained fields like `fitnessGoal`, `experienceLevel`, and `workoutLocation` to strict Zod Enums.
- **Why**:
  - `.strict()` prevents mass-assignment vulnerabilities (e.g., injecting `password` or internal fields into a profile update payload).
  - Enums prevent prompt injection attacks when free-text profile attributes are later interpolated into AI/LLM prompts (e.g., `generate-plan` or `ai-trainer`).

---

## 3. Data Architecture & Performance Optimization

### Decision: Server-Side Index Filtering for Milestones (`/api/milestones?userId=...`)
- **What Was Done**: Refactored `getMilestonesByUserId()` in `lib/storage.ts` to pass `?userId=` as a URL parameter to the API route, and updated `app/api/milestones/route.ts` to execute a filtered MongoDB query `{ userId }`.
- **Why**: 
  - Previously, `getMilestonesByUserId` fetched **all** database milestones into client memory and ran `Array.prototype.filter()`.
  - Client-side filtering is an $O(N)$ memory and bandwidth bottleneck that degrades as the database grows.
  - Server-side indexing reduces query execution to $O(1)$ lookup time and drastically lowers API payload sizes.

### Decision: Dependency Pruning (`@google/generative-ai`)
- **What Was Done**: Uninstalled `@google/generative-ai` package after verifying zero active import usages across the codebase. Standardized on `@google/genai` and `@mistralai/mistralai`.
- **Why**: Prevents bundle bloat, reduces dependency supply-chain attack surface, and avoids duplicate library version conflicts.

---

## 4. AI System Resilience & Prompt Protection

### Decision: Exception-Safe LLM Response Parsing & Self-RAG Classification
- **What Was Done**: Wrapped `JSON.parse` in `generate-plan/route.ts` in `try/catch` blocks returning `502 Bad Gateway` on malformed responses. Integrated zero-cost query classification (`classifyQuerySync`) before invoking the heavy Self-RAG pipeline in `chat/route.ts`.
- **Why**:
  - LLMs occasionally return markdown-wrapped or malformed JSON. Crashing the Node.js process with an unhandled exception causes 500 errors and server instability.
  - Fast-path keyword/greeting classification handles trivial messages (e.g., "hi", "thanks") instantly at zero cost without triggering LLM latency or token usage.

---

## 5. Observability & Information Leakage Prevention

### Decision: Production Structured JSON Logging & Development Formatter
- **What Was Done**: Created `lib/logger.ts` — a zero-dependency structured logger that emits formatted JSON objects in production (suitable for Vercel Log Drains / Datadog / CloudWatch) and human-readable text in development. Replaced raw `console.log` across route handlers.
- **Why**: Unstructured text logs are difficult to index, filter, and alert on in production log analyzers. Structured JSON logging enables machine parsing, log aggregation, and real-time security alerting.

### Decision: Safe Error Serialization via `toSafeErrorMessage()`
- **What Was Done**: Created `toSafeErrorMessage()` in `lib/error-handler.ts` to return internal error messages only when `NODE_ENV === 'development'`, returning generic messages in production 500 responses.
- **Why**: Returning raw `error.message` or stack traces in HTTP responses leaks sensitive infrastructure details (database names, file paths, library versions, internal IP addresses) to potential attackers.

---

## 6. CI/CD & Automated Quality Control

### Decision: Single Consolidated 3-Stage CI/CD Pipeline
- **What Was Done**: Replaced redundant `.github/workflows/ci.yml` and `ci-cd.yml` with a unified `.github/workflows/ci-cd.yml` containing three gated stages: `Quality Gate` (linting, type-checking, Vitest) $\rightarrow$ `Build` $\rightarrow$ `Deploy` (via official Vercel CLI).
- **Why**: Guarantees that code is never deployed to production unless all type checks, lints, and unit/integration security regression tests pass 100%.

---

## 7. CSRF Protection & Origin Validation Strategy

### Decision: Enforce `SameSite=Lax/Strict` and Origin Checking for Cookie Mutations
- **What Was Done**: Evaluated CSRF risk profile. Confirmed recommendation to validate `Origin` / `Referer` headers on state-changing API requests (`POST`, `PUT`, `DELETE`) authenticated via cookies.
- **Why**:
  - `httpOnly` cookies protect against token theft via XSS, but browser automatic cookie inclusion makes endpoints vulnerable to Cross-Site Request Forgery (CSRF) if a malicious site submits a cross-origin form/fetch.
  - `SameSite=Lax` mitigates top-level cross-site POST forms in modern browsers, but Origin checking provides defense-in-depth against subdomain navigation or browser compatibility edge cases.
  - Requests carrying `Authorization: Bearer` headers are naturally immune to CSRF because browsers do not auto-attach custom authorization headers across origins.

---

## 8. August 2026 Audit Hardening Pass

### Decision: Route Handlers Must Re-Verify Auth, Not Trust Client Headers
- **What Was Done**: Added `requireAuthUser()` in `lib/api-security.ts` and moved high-risk API routes to server-derived identity: plan generation, AI chat, document upload/listing, image generation, voice generation, transcription, text generation, quote generation, personalized quote generation, and milestones.
- **Why**: Middleware is useful but not a complete authorization boundary. Route handlers can be invoked directly in tests, refactors, server actions, or future internal calls. User identity must come from a verified JWT, not `x-user-id` headers or request body fields.

### Decision: Stop Persisting or Rate-Limiting Against Spoofable User IDs
- **What Was Done**: `POST /api/generate-plan` now stores plans under `auth.user.userId`; `POST /api/ai-trainer/chat` now passes the authenticated user ID into Self-RAG; milestones now derive `userId` from auth and reject mismatched legacy body/query IDs.
- **Why**: Client-provided user IDs allow cross-user writes, rate-limit bypasses, and incorrect cache invalidation. Server-derived identity keeps tenant ownership stable.

### Decision: Add Origin Checks for Cookie-Authenticated Mutations
- **What Was Done**: `middleware.ts` now rejects mutating API requests with untrusted `Origin`/`Referer` headers unless the request uses an explicit Bearer token. `NEXT_PUBLIC_APP_URL` and optional `TRUSTED_ORIGINS` define accepted origins.
- **Why**: `httpOnly` cookies prevent token theft, but browsers still attach cookies automatically. Origin validation adds CSRF defense-in-depth for state-changing endpoints.

### Decision: Bound Uploads and AI-Cost Surfaces
- **What Was Done**: Added strict request schemas for chat/images/text/voice/milestones, bounded chat images to one data URL, capped transcription and document uploads at 5 MB, enforced audio MIME allowlists, rejected unimplemented PDF document ingestion, and added per-user rate limits to external-cost endpoints.
- **Why**: AI endpoints are expensive and upload endpoints are memory-sensitive. Early validation reduces abuse, accidental cost spikes, and denial-of-service risk.

### Decision: Disable Global RAG Writes Until an Admin Workflow Exists
- **What Was Done**: `/api/ai-trainer/documents` now only writes to authenticated user collections and returns `403` for global document uploads.
- **Why**: Allowing any signed-in user to write `global_documents` lets one user poison the shared retrieval corpus for all users. Global knowledge ingestion needs an explicit admin review/audit path.

### Decision: Remove Critical Dependency Attack Surface
- **What Was Done**: Removed unused/vulnerable `@chroma-core/default-embed`, `jspdf`, and unused `html2canvas`. PDF export now uses `html-to-image` plus the browser print dialog instead of client-side PDF generation.
- **Why**: `@chroma-core/default-embed` pulled native ONNX/tar vulnerabilities while the app already uses a custom Gemini embedder. `jspdf` had critical advisories and was only used for a non-essential export path.

### Decision: CI Should Block Deploys on Real Release Blockers
- **What Was Done**: Fixed ESLint installation/configuration, removed the deprecated placeholder workflow, added workflow concurrency, added a Vercel secret preflight step, kept type-check/test/lint/build gates, and set `npm audit --audit-level=critical`.
- **Why**: CI was previously unable to run lint and would fail permanently on high/moderate upstream advisories with no standard npm fix. Critical vulnerabilities now block deployment; remaining high/moderate advisories are documented debt requiring dependency migration.

### Known Follow-Up Debt
- Upgrade or replace dependency families that still report high/moderate advisories with no normal npm fix: Next.js 16.0.8, LangChain/LangSmith, Google GenAI/ws, and Recharts/lodash.
- Reduce current lint warnings to zero by replacing broad `any` types, fixing React hook dependency/order warnings, and cleaning unused imports.
- Add a real admin-controlled global RAG ingestion workflow with audit logs and moderation.
- Add full E2E coverage for signup -> plan generation -> AI chat -> milestones after test database/API-key strategy is finalized.

---

## 9. Signup, Plan, RAG, and Proxy Flow Alignment

### Decision: Keep Form Options Aligned with Server Enums
- **What Was Done**: Updated signup defaults and select options to use the same values accepted by `GeneratePlanRequestSchema` (`Vegetarian` instead of `Veg`, `Outdoors` instead of `Outdoor`, and supported gender/diet/location values only).
- **Why**: Signup was creating users successfully but background plan generation could fail with `400` because the UI submitted values rejected by the plan API schema. A production codebase should keep UI options and API contracts in one consistent vocabulary.

### Decision: Treat `user_plans` as the Plan Source of Truth
- **What Was Done**: Removed client-side attempts to save generated plans through profile updates. Full plan regeneration now persists through `POST /api/generate-plan`; diet-only regeneration is merged with the existing server-side plan before returning.
- **Why**: The profile update schema intentionally rejects unknown/mass-assignment fields, including `plan`. Persisting plans through both user profiles and `user_plans` created a broken write path and two competing sources of truth.

### Decision: Recover Dashboard Sessions from the Auth Cookie
- **What Was Done**: `GET /api/users` now returns the authenticated user when no `id` or `email` query is provided, and the client falls back to that endpoint when `localStorage.current_user_id` is absent.
- **Why**: Authentication is cookie-backed. A valid session should not fail just because local browser state was cleared, opened in a new tab, or not yet hydrated.

### Decision: Support Both Local Chroma and Chroma Cloud
- **What Was Done**: `lib/chroma.ts` now uses `CloudClient` only when cloud credentials are complete; otherwise it connects to `CHROMA_SERVER_URL`, which matches the Docker Compose Chroma service.
- **Why**: The compose stack already provides local Chroma, but the code always attempted Chroma Cloud. That made the RAG pipeline fail unless cloud-only credentials were present.

### Decision: Use One User RAG Collection Naming Scheme
- **What Was Done**: Document uploads now store chunks in `fitness_user_${userId}`, matching the collection queried by Self-RAG.
- **Why**: Uploading to `user_${userId}` while retrieving from `fitness_user_${userId}` meant user documents were never used in chat responses.

### Decision: Harden Nginx Proxy and Challenge Routing
- **What Was Done**: Fixed the auth rate-limit location to include `/api/users`, added a proper websocket/upgrade connection map, and mounted the ACME challenge webroot in Docker Compose.
- **Why**: Signup/profile routes need the stricter auth limit, proxy headers should be protocol-correct, and certificate challenge files must be available in the Nginx container for TLS operations.

---

*Last Updated: August 2026*
