.PHONY: all build run test bench docker-build clean

APP_NAME := speech-service
PORT ?= 8080

all: test build

build:
	go build -ldflags="-s -w" -o bin/$(APP_NAME) ./cmd/server

run:
	go run ./cmd/server

test:
	go test -v -race ./...

bench:
	go test -bench=. ./internal/audio/...

docker-build:
	docker build -t zenfit/speech-service:latest .

clean:
	rm -rf bin/ speech-service.exe
