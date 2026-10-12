# ZenFit Edge Reverse Proxy (Nginx)

High-performance, hardened Nginx edge reverse proxy for the **ZenFit** distributed microservices platform.

---

## 1. Responsibilities

- **Edge SSL/TLS Termination:** HTTP/2 over TLS 1.2/1.3 with ECDHE/DHE modern ciphers and HSTS preloading.
- **Microservices Routing:** L7 reverse proxy dispatching traffic across Next.js frontend (`app:3000`), Go Speech Service (`speech-service:8080`), and future Go API Gateway (`api-gateway:8080`).
- **Real-Time Streaming Offload:** Zero-buffering reverse proxying for Server-Sent Events (SSE) and raw binary WAV audio streaming (`proxy_buffering off`).
- **Edge Security & Abuse Mitigation:** Strict client IP sanitization (`$remote_addr`) to prevent rate-limit spoofing, browser audio permission enablement (`microphone=(self)`), and tiered request rate limiting.
- **Custom Error & Maintenance Pages:** Modern glassmorphic 429 (Too Many Requests) and 50x (Bad Gateway / Outage) fallback pages.

---

## 2. Route Topology

| Route Pattern | Upstream Target | Buffering | Rate Limit | Description |
|---|---|---|---|---|
| `GET = /healthz` | Local Nginx stub | Off | None | Fast edge liveness probe returning `200 "healthy\n"`. |
| `GET /.well-known/acme-challenge/` | `/var/www/certbot` | Off | None | Automated Let's Encrypt SSL certificate renewal webroot. |
| `GET /speech/*` | `speech-service:8080` | **Disabled** (`off`) | `60 req/min` (burst 20) | Go Speech & Audio microservice (TTS binary streaming & STT). |
| `GET /api/v1/events` | `app:3000` (or Gateway) | **Disabled** (`off`) | Uncapped | Long-lived Server-Sent Events (SSE) connection hub (`timeout 24h`). |
| `POST /api/auth/login`, `/api/users` | `app:3000` | Default | **`10 req/min`** (burst 5) | High-risk brute-force defense zone for authentication. |
| `ANY /api/*` | `app:3000` | Default | `30 req/min` (burst 10) | General REST application APIs. |
| `GET /_next/static/*` | `app:3000` | Default | None | Next.js compiled chunks with `1-year immutable` cache headers. |
| `ANY /` | `app:3000` | Default | None | Web frontend application shell and server-rendered pages. |

---

## 3. Hardened Security Features (P0 Production Checklist)

### A. Microphone Access Permitted (`Permissions-Policy`)
Default Nginx installations often lock down all hardware devices:
```nginx
# FIXED: microphone=(self) enables client voice trainer and audio transcription
add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;
```

### B. IP-Spoofing Defense
Client headers like `X-Forwarded-For: 1.2.3.4` are unconditionally overwritten at the edge using `$remote_addr` before reaching downstream microservices:
```nginx
proxy_set_header X-Real-IP       $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

### C. Container Network Isolation
In production `docker-compose.yml`, downstream containers (`app`, `speech-service`, `chroma`) do **not** expose host ports to `0.0.0.0`. Only Nginx binds to public host ports (`80`, `443`), preventing direct backend bypass.

---

## 4. Directory Structure

```text
nginx/
├── Dockerfile                  # Standalone alpine image with healthchecks
├── nginx.conf                  # Production hardened TLS + rate-limiting configuration
├── nginx.dev.conf              # Local development configuration (HTTP port 80, zero SSL friction)
├── html/
│   ├── 429.html                # Rate limit exceeded fallback page
│   └── 50x.html                # Bad Gateway / upstream error fallback page
├── scripts/
│   ├── generate-dev-certs.sh   # Bash self-signed SSL certificate generator
│   └── generate-dev-certs.ps1  # PowerShell self-signed SSL certificate generator
├── ssl/                        # Local dev certificates (gitignored)
└── README.md
```

---

## 5. Local Development Workflow

### Option A: Run Nginx in Dev Mode (No SSL Required)
Use `nginx.dev.conf` via Docker:
```bash
docker run --rm -p 80:80 \
  -v "$(pwd)/nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro" \
  -v "$(pwd)/nginx/html:/usr/share/nginx/html:ro" \
  nginx:1.25-alpine
```

### Option B: Test HTTPS Locally with Self-Signed Certificates
1. Generate self-signed local certificates:
   ```powershell
   powershell -File nginx/scripts/generate-dev-certs.ps1
   # Or on Bash:
   ./nginx/scripts/generate-dev-certs.sh
   ```
2. Run standard production configuration with certificates mounted in `ssl/`:
   ```bash
   docker compose up -d nginx
   ```

### Option C: Validate Configuration Syntax
```bash
docker run --rm -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.25-alpine nginx -t
```
