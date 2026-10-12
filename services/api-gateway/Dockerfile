# ─── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM golang:alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Statically linked stripped binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/api-gateway ./cmd/server

# ─── Stage 2: Minimal Runtime ──────────────────────────────────────────────────
FROM alpine:3.20

WORKDIR /app

# Security & TLS roots
RUN apk --no-cache add ca-certificates tzdata

# Non-root user
RUN addgroup -S zenfit && adduser -S zenfit -G zenfit

COPY --from=builder /app/bin/api-gateway /app/api-gateway

USER zenfit

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health/live || exit 1

ENTRYPOINT ["/app/api-gateway"]
