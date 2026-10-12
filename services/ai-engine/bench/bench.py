"""Empirical Benchmark Harness for ZenFit AI Engine.
Measures real throughput (req/s) and latency percentiles (P50, P90, P95, P99)
across Liveness, Quote retrieval, and the Async 202 Accepted Plan Generation endpoint.
"""

import time
import logging
import statistics
import concurrent.futures
from starlette.testclient import TestClient

# Silence noisy access logs during load tests
logging.getLogger("ai-engine").setLevel(logging.WARNING)

from app.config import settings
settings.ENVIRONMENT = "test"

from app.main import create_application


def run_benchmark(endpoint: str, method: str = "GET", payload: dict = None, workers: int = 50, total_requests: int = 2000):
    app = create_application()
    client = TestClient(app)

    headers = {"X-User-Id": "usr_bench_01"}

    latencies = []
    success_count = 0
    fail_count = 0

    def single_req(idx: int):
        t0 = time.perf_counter()
        if method == "POST":
            req_headers = {**headers, "Idempotency-Key": f"bench_key_{idx}"}
            res = client.post(endpoint, json=payload, headers=req_headers)
        else:
            res = client.get(endpoint, headers=headers)
        dt = (time.perf_counter() - t0) * 1000.0  # ms
        return res.status_code, dt

    start_wall = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(single_req, i) for i in range(total_requests)]
        for f in concurrent.futures.as_completed(futures):
            status_code, dt = f.result()
            latencies.append(dt)
            if status_code in (200, 202):
                success_count += 1
            else:
                fail_count += 1
    total_wall_sec = time.perf_counter() - start_wall

    latencies.sort()
    n = len(latencies)
    p50 = statistics.median(latencies)
    p90 = latencies[int(n * 0.90)]
    p95 = latencies[int(n * 0.95)]
    p99 = latencies[int(n * 0.99)]
    rps = total_requests / total_wall_sec

    return {
        "endpoint": endpoint,
        "workers": workers,
        "total_requests": total_requests,
        "duration_sec": total_wall_sec,
        "rps": rps,
        "success": success_count,
        "failed": fail_count,
        "p50_ms": p50,
        "p90_ms": p90,
        "p95_ms": p95,
        "p99_ms": p99,
        "min_ms": min(latencies),
        "max_ms": max(latencies),
    }


if __name__ == "__main__":
    print("=================================================================")
    print(" ZenFit AI Engine — Empirical Performance Benchmark Harness")
    print("=================================================================\n")

    # 1. Benchmark Liveness (/health/live)
    print("--> Benchmarking /health/live (50 workers, 2,000 requests)...")
    live_res = run_benchmark("/health/live", method="GET", workers=50, total_requests=2000)
    print(f"    RPS:     {live_res['rps']:.1f} req/s")
    print(f"    P50:     {live_res['p50_ms']:.2f} ms")
    print(f"    P95:     {live_res['p95_ms']:.2f} ms")
    print(f"    P99:     {live_res['p99_ms']:.2f} ms")
    print(f"    Success: {live_res['success']}/{live_res['total_requests']}\n")

    # 2. Benchmark Async 202 Plan Generation (/v1/plan/generate)
    plan_payload = {
        "age": "26",
        "gender": "Male",
        "height": "178",
        "weight": "74",
        "fitnessGoal": "Muscle Gain",
        "experienceLevel": "Intermediate",
        "workoutLocation": "Gym",
        "dietaryPreference": "Standard",
        "userId": "usr_bench_01",
    }
    print("--> Benchmarking POST /v1/plan/generate (Async 202 Enqueue, 50 workers, 2,000 requests)...")
    plan_res = run_benchmark("/v1/plan/generate", method="POST", payload=plan_payload, workers=50, total_requests=2000)
    print(f"    RPS:     {plan_res['rps']:.1f} req/s")
    print(f"    P50:     {plan_res['p50_ms']:.2f} ms")
    print(f"    P95:     {plan_res['p95_ms']:.2f} ms")
    print(f"    P99:     {plan_res['p99_ms']:.2f} ms")
    print(f"    Success: {plan_res['success']}/{plan_res['total_requests']}\n")

    # 3. Benchmark Quote Retrieval (/v1/quote)
    print("--> Benchmarking GET /v1/quote (Cached, 50 workers, 2,000 requests)...")
    quote_res = run_benchmark("/v1/quote", method="GET", workers=50, total_requests=2000)
    print(f"    RPS:     {quote_res['rps']:.1f} req/s")
    print(f"    P50:     {quote_res['p50_ms']:.2f} ms")
    print(f"    P95:     {quote_res['p95_ms']:.2f} ms")
    print(f"    P99:     {quote_res['p99_ms']:.2f} ms")
    print(f"    Success: {quote_res['success']}/{quote_res['total_requests']}\n")

    print("=================================================================")
    print(" Empirical Benchmark Complete.")
    print("=================================================================")
