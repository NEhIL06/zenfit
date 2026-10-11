# ZenFit — Speech & Audio Microservice (Go)

High-performance, stateless audio and speech microservice for ZenFit. Implemented in Go as **Service 1** of the ZenFit microservices decomposition plan outlined in [`docs/ARCHITECTURE.md`](../y/docs/ARCHITECTURE.md).

---

## 1. Architectural Highlights

- **Zero-Allocation Audio Synthesizer**: Uses Go's `sync.Pool` to reuse byte buffers when packaging raw 24kHz 16-bit linear PCM from Gemini TTS into standard RIFF WAVE containers, avoiding GC pressure under high concurrency.
- **Dual-Mode Content Negotiation**:
  - **Raw Binary Streaming (Default)**: Direct `audio/wav` or `audio/mpeg` streaming eliminating the **33% Base64 serialization overhead**.
  - **JSON Backward Compatibility**: When `Accept: application/json` is sent, returns Base64 payloads (`{"audioData": "<base64>", "format": "wav"|"mp3"}`) allowing legacy clients and Next.js internal proxies to operate seamlessly without frontend changes.
- **Circuit Breaker Protected Fallback**: Protects primary Gemini TTS with an automated Circuit Breaker (5 consecutive errors / timeouts trips to `OPEN` for 60s). While open, requests fail-fast to the Pollinations TTS fallback, guaranteeing sub-2s response latency.
- **100% Stateless**: Zero database, vector store, or message broker dependencies. Operates at ~15–30MB RAM footprint vs 250MB+ for Node.js equivalents.
- **Production Observability**: Structured JSON logging (`log/slog`), correlation IDs (`X-Request-Id`), recovery middleware, and decoupled Liveness/Readiness probes (`/health/live` vs `/health/ready`).

---

## 2. API Endpoints

### `POST /v1/voice/generate`
Synthesizes speech from text.

- **Headers**:
  - `Content-Type: application/json`
  - `Accept`: `audio/wav` (for binary stream) or `application/json` (for Base64 JSON)
- **Request Body**:
  ```json
  {
    "text": "Great job finishing your 5k run today! Keep the momentum going.",
    "voiceName": "Puck"
  }
  ```
  *(Supported voices: `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`)*
- **Binary Response (Default)**:
  - Status: `200 OK`
  - `Content-Type`: `audio/wav` (or `audio/mpeg` if fallback used)
  - `X-Audio-Format`: `wav` | `mp3`
  - `X-Audio-Provider`: `gemini` | `pollinations`
- **JSON Response (`Accept: application/json`)**:
  - Status: `200 OK`
  - Body:
    ```json
    {
      "audioData": "<base64_encoded_audio>",
      "format": "wav"
    }
    ```

---

### `POST /v1/transcribe`
Transcribes spoken user audio to text.

- **Headers**:
  - `Content-Type: multipart/form-data`
- **Form Fields**:
  - `file`: Audio file binary (Max 5MB; supported formats: `wav`, `webm`, `mp3`, `mp4`)
- **Response**:
  - Status: `200 OK`
  - Body:
    ```json
    {
      "text": "I completed 3 sets of bench press and 15 pull-ups."
    }
    ```

---

### `GET /health/live`
Liveness probe. Returns HTTP 200 as long as the process is alive.

```json
{
  "status": "UP",
  "uptime": "12m34s"
}
```

---

### `GET /health/ready`
Readiness probe. Verifies provider connectivity and circuit breaker state.

```json
{
  "status": "READY",
  "providers": {
    "gemini_configured": true,
    "pollinations_fallback": true,
    "circuit_breaker": {
      "name": "gemini-tts-breaker",
      "state": "closed",
      "consecutiveFails": 0,
      "failureThreshold": 5
    }
  },
  "uptime": "12m34s"
}
```

---

## 3. Configuration

Configuration is loaded from environment variables or a `.env` file (also searches `../y/.env`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listening port |
| `ENVIRONMENT` | `development` | Environment (`development`, `production`) |
| `GEMINI_API_KEY` | *empty* | Google Gemini API key for TTS and STT |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | Gemini TTS model identifier |
| `GEMINI_STT_MODEL` | `gemini-2.0-flash` | Gemini Multimodal STT model identifier |
| `POLLINATIONS_API_KEY` | *empty* | Optional API key for Pollinations AI |
| `POLLINATIONS_BASE_URL` | `https://gen.pollinations.ai/audio` | Pollinations TTS API endpoint |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Consecutive failures before tripping to `OPEN` |
| `CIRCUIT_BREAKER_TIMEOUT_SECONDS` | `60` | Duration to remain open before half-open probe |
| `HTTP_CLIENT_TIMEOUT_SECONDS` | `15` | External provider HTTP request deadline |
| `TRUSTED_ORIGINS` | `http://localhost:3000,http://localhost:3100` | Allowed CORS origins |

---

## 4. Local Development

### Run directly:
```bash
go run ./cmd/server
```

### Build binary:
```bash
go build -ldflags="-s -w" -o speech-service ./cmd/server
```

### Run tests:
```bash
go test -v ./...
```

### Run benchmarks:
```bash
go test -bench=. ./internal/audio/...
```

---

## 5. Docker Deployment

```bash
# Build image
docker build -t zenfit/speech-service:latest .

# Run container
docker run -d -p 8080:8080 \
  -e GEMINI_API_KEY="your-api-key" \
  --name zenfit_speech \
  zenfit/speech-service:latest
```
