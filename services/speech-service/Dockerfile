FROM golang:alpine AS builder

WORKDIR /app
RUN apk add --no-cache git ca-certificates

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/speech-service ./cmd/server

FROM alpine:3.20

WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -g 1001 -S zenfit && \
    adduser -u 1001 -S zenfit -G zenfit

COPY --from=builder /app/bin/speech-service /app/speech-service

USER zenfit

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health/live || exit 1

ENTRYPOINT ["/app/speech-service"]
