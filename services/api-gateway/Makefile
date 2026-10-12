.PHONY: build test bench run docker-build clean

build:
	go build -o bin/api-gateway.exe ./cmd/server

test:
	go test -v ./...

bench:
	go run ./cmd/bench -url http://localhost:8080 -duration 5

run:
	go run ./cmd/server

docker-build:
	docker build -t zenfit/api-gateway:latest .

clean:
	rm -rf bin/
