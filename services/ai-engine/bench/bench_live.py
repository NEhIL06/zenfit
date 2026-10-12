"""Live Containerized HTTP/TCP Benchmark Harness for ZenFit AI Engine.
Executes real network requests over TCP port 8000 against the running Docker container.
Measures true network throughput (req/s), latency percentiles (P50, P90, P95, P99),
and reads container CPU/memory via docker stats.
"""

import time
import statistics
import concurrent.futures
import subprocess
import httpx
import threading


TARGET_BASE_URL = "http://127.0.0.1:8000"


def get_docker_stats():
    try:
        res = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.MemUsage}} / CPU: {{.CPUPerc}}", "zenfit_ai_engine"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return res.stdout.strip()
    except Exception as e:
        return f"Err: {e}"


_thread_local = threading.local()


def get_thread_client():
    if not hasattr(_thread_local, "client"):
        _thread_local.client = httpx.Client(base_url=TARGET_BASE_URL, timeout=10.0)
    return _thread_local.client


def run_tcp_benchmark(endpoint: str, method: str = "GET", payload: dict = None, workers: int = 50, total_requests: int = 1000):
    headers = {"X-User-Id": "usr_docker_bench_01"}

    latencies = []
    success_count = 0
    fail_count = 0

    def single_req(idx: int):
        client = get_thread_client()
        t0 = time.perf_counter()
        try:
            if method == "POST":
                req_headers = {**headers, "Idempotency-Key": f"docker_bench_key_{idx}_{time.time()}"}
                res = client.post(endpoint, json=payload, headers=req_headers)
            else:
                res = client.get(endpoint, headers=headers)
            dt = (time.perf_counter() - t0) * 1000.0  # ms
            return res.status_code, dt
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000.0
            return 0, dt

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
    print(" ZenFit AI Engine — Live Containerized TCP Benchmark Harness")
    print(f" Target: {TARGET_BASE_URL} (Docker container: zenfit_ai_engine)")
    print(f" Initial Container Stats: {get_docker_stats()}")
    print("=================================================================\n")

    # 1. Benchmark Liveness (/health/live)
    print("--> 1. Benchmarking GET /health/live over TCP (50 workers, 1,000 requests)...")
    live_res = run_tcp_benchmark("/health/live", method="GET", workers=50, total_requests=1000)
    print(f"    RPS:     {live_res['rps']:.1f} req/s")
    print(f"    P50:     {live_res['p50_ms']:.2f} ms")
    print(f"    P95:     {live_res['p95_ms']:.2f} ms")
    print(f"    P99:     {live_res['p99_ms']:.2f} ms")
    print(f"    Success: {live_res['success']}/{live_res['total_requests']}")
    print(f"    Docker Stats: {get_docker_stats()}\n")

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
        "userId": "usr_docker_bench_01",
    }
    print("--> 2. Benchmarking POST /v1/plan/generate (Async 202, 50 workers, 1,000 requests)...")
    plan_res = run_tcp_benchmark("/v1/plan/generate", method="POST", payload=plan_payload, workers=50, total_requests=1000)
    print(f"    RPS:     {plan_res['rps']:.1f} req/s")
    print(f"    P50:     {plan_res['p50_ms']:.2f} ms")
    print(f"    P95:     {plan_res['p95_ms']:.2f} ms")
    print(f"    P99:     {plan_res['p99_ms']:.2f} ms")
    print(f"    Success: {plan_res['success']}/{plan_res['total_requests']}")
    print(f"    Docker Stats: {get_docker_stats()}\n")

    # 3. Benchmark Quote Retrieval (/v1/quote)
    print("--> 3. Benchmarking GET /v1/quote (50 workers, 1,000 requests)...")
    quote_res = run_tcp_benchmark("/v1/quote", method="GET", workers=50, total_requests=1000)
    print(f"    RPS:     {quote_res['rps']:.1f} req/s")
    print(f"    P50:     {quote_res['p50_ms']:.2f} ms")
    print(f"    P95:     {quote_res['p95_ms']:.2f} ms")
    print(f"    P99:     {quote_res['p99_ms']:.2f} ms")
    print(f"    Success: {quote_res['success']}/{quote_res['total_requests']}")
    print(f"    Docker Stats: {get_docker_stats()}\n")

    print("=================================================================")
    print(f" Final Container Stats: {get_docker_stats()}")
    print(" Live Container TCP Benchmark Complete.")
    print("=================================================================")
