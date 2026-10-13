# ZenFit Auth & Core Microservice

Staff Engineer Grade TypeScript/Express microservice handling authentication, user profiles, achievements, and plan state ownership for the ZenFit ecosystem.

---

## Architectural Highlights

- **Sole Owner of MongoDB**: Sole writer and owner of `users`, `user_plans`, and `milestones` collections.
- **Asymmetric RS256 JWTs**: Signs short-lived access tokens (15m) using a private RSA key.
- **JWKS Endpoint**: Exposes RFC 7517 compliant JWKS at `/.well-known/jwks.json` and `/v1/auth/jwks` for in-memory token verification at the Go API Gateway without database roundtrips.
- **Token Rotation & Instant Revocation**: Opaque refresh tokens stored in Redis with rotating replacement; instant logout writes user ID to Redis revocation denylist (`denylist:user:{id}`).
- **Zero-Trust Header Ingestion**: Accepts verified claims from `X-User-Id`, `X-User-Role`, and `X-User-Email` injected by the Go API Gateway boundary.
- **Microsecond In-Memory Fallbacks**: Built-in fallback database and Redis adapters enable 100% test suite execution and offline development without mandatory external databases.

---

## API Surface

| Method | Path | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/health/live` | Process liveness probe | No |
| `GET` | `/health/ready` | Datastore readiness probe | No |
| `GET` | `/.well-known/jwks.json` | Public key discovery set | No |
| `POST` | `/v1/auth/register` | User signup & RS256 cookie issuance | No |
| `POST` | `/v1/auth/login` | User login & RS256 cookie issuance | No |
| `POST` | `/v1/auth/logout` | Session revocation in Redis denylist | Yes |
| `POST` | `/v1/auth/refresh` | Refresh token rotation | Yes |
| `GET` | `/v1/auth/me` | Authenticated user profile | Yes |
| `GET` | `/v1/users/:id` | Profile lookup with ownership guard | Yes |
| `PATCH` | `/v1/users/:id` | Strict profile update with enum validation | Yes |
| `GET` | `/v1/users/:id/plan` | Plan retrieval from `user_plans` | Yes |
| `PUT` | `/v1/users/:id/plan` | Plan persistence | Yes |
| `GET` | `/v1/milestones` | Indexed milestones feed | Yes |
| `POST` | `/v1/milestones` | Record user achievement milestone | Yes |

---

## Commands

```bash
# Run in dev mode (hot reload)
npm run dev

# Compile TypeScript
npm run build

# Run Vitest test suite (17/17 tests)
npm test

# Run empirical load benchmark (50 workers, 6,000 requests)
npm run bench
```
