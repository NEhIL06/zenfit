/**
 * Empirical Benchmark Harness for ZenFit Auth & Core Service.
 * Measures real throughput (req/s), latency percentiles (P50, P90, P95, P99),
 * and Node.js process memory under 50 concurrent workers.
 */

import http from "http"
import { createApp } from "../src/app.js"
import { getKeyManager } from "../src/security/keys.js"
import { signAccessToken } from "../src/security/jwt.js"

interface BenchResult {
  endpoint: string
  workers: number
  totalRequests: number
  rps: number
  p50Ms: number
  p90Ms: number
  p95Ms: number
  p99Ms: number
  successCount: number
  failedCount: number
}

async function runBenchmark(
  serverPort: number,
  endpoint: string,
  method: string = "GET",
  bodyPayload?: any,
  headers: Record<string, string> = {},
  workers: number = 50,
  totalRequests: number = 2000
): Promise<BenchResult> {
  const latencies: number[] = []
  let successCount = 0
  let failedCount = 0
  let completed = 0

  const bodyData = bodyPayload ? JSON.stringify(bodyPayload) : undefined
  const requestHeaders = {
    ...headers,
    "Content-Type": "application/json",
    Connection: "keep-alive",
  }

  const agent = new http.Agent({
    keepAlive: true,
    maxSockets: workers * 2,
  })

  return new Promise((resolve) => {
    const startTime = performance.now()
    let currentIndex = 0

    function dispatchWorker() {
      if (currentIndex >= totalRequests) return
      const idx = currentIndex++

      const reqStart = performance.now()
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: endpoint,
          method,
          headers: {
            ...requestHeaders,
            "X-Request-Id": `bench_${idx}`,
          },
          agent,
        },
        (res) => {
          let data = ""
          res.on("data", (chunk) => (data += chunk))
          res.on("end", () => {
            const dt = performance.now() - reqStart
            latencies.push(dt)

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
              successCount++
            } else {
              failedCount++
            }

            completed++
            if (completed === totalRequests) {
              const wallSec = (performance.now() - startTime) / 1000
              latencies.sort((a, b) => a - b)
              const n = latencies.length
              const p50 = latencies[Math.floor(n * 0.5)] || 0
              const p90 = latencies[Math.floor(n * 0.9)] || 0
              const p95 = latencies[Math.floor(n * 0.95)] || 0
              const p99 = latencies[Math.floor(n * 0.99)] || 0
              const rps = totalRequests / wallSec

              resolve({
                endpoint,
                workers,
                totalRequests,
                rps,
                p50Ms: p50,
                p90Ms: p90,
                p95Ms: p95,
                p99Ms: p99,
                successCount,
                failedCount,
              })
            } else {
              dispatchWorker()
            }
          })
        }
      )

      req.on("error", () => {
        latencies.push(performance.now() - reqStart)
        failedCount++
        completed++
        if (completed === totalRequests) {
          resolve({
            endpoint,
            workers,
            totalRequests,
            rps: 0,
            p50Ms: 0,
            p90Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            successCount,
            failedCount,
          })
        } else {
          dispatchWorker()
        }
      })

      if (bodyData) req.write(bodyData)
      req.end()
    }

    // Launch worker pool
    for (let i = 0; i < workers; i++) {
      dispatchWorker()
    }
  })
}

async function main() {
  process.env.NODE_ENV = "test"
  await getKeyManager()

  const app = createApp()
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as any).port

  console.log("=================================================================")
  console.log(" ZenFit Auth & Core Service — Empirical Performance Benchmark")
  console.log(` Listening on temporary port: ${port}`)
  console.log("=================================================================\n")

  // Setup valid benchmark user with 24-character hexadecimal ObjectId
  const { getDb } = await import("../src/db/mongo.js")
  const { ObjectId } = await import("mongodb")
  const testObjectId = new ObjectId()
  const testUserId = testObjectId.toString()
  const testEmail = "bench_auth@zenfit.com"

  await getDb().collection("users").insertOne({
    _id: testObjectId,
    formData: {
      fullName: "Benchmark User",
      email: testEmail,
      fitnessGoal: "Muscle Gain",
    },
    createdAt: new Date(),
  })

  const token = await signAccessToken({ userId: testUserId, email: testEmail })

  // 1. Benchmark Liveness (/health/live)
  console.log("--> 1. Benchmarking GET /health/live (50 workers, 2,000 requests)...")
  const liveRes = await runBenchmark(port, "/health/live", "GET", null, {}, 50, 2000)
  console.log(`    RPS:     ${liveRes.rps.toFixed(1)} req/s`)
  console.log(`    P50:     ${liveRes.p50Ms.toFixed(2)} ms`)
  console.log(`    P95:     ${liveRes.p95Ms.toFixed(2)} ms`)
  console.log(`    P99:     ${liveRes.p99Ms.toFixed(2)} ms`)
  console.log(`    Success: ${liveRes.successCount}/${liveRes.totalRequests}\n`)

  // 2. Benchmark JWKS Discovery (/.well-known/jwks.json)
  console.log("--> 2. Benchmarking GET /.well-known/jwks.json (50 workers, 2,000 requests)...")
  const jwksRes = await runBenchmark(port, "/.well-known/jwks.json", "GET", null, {}, 50, 2000)
  console.log(`    RPS:     ${jwksRes.rps.toFixed(1)} req/s`)
  console.log(`    P50:     ${jwksRes.p50Ms.toFixed(2)} ms`)
  console.log(`    P95:     ${jwksRes.p95Ms.toFixed(2)} ms`)
  console.log(`    P99:     ${jwksRes.p99Ms.toFixed(2)} ms`)
  console.log(`    Success: ${jwksRes.successCount}/${jwksRes.totalRequests}\n`)

  // 3. Benchmark Authenticated Route with Token Verification (/v1/users/:id)
  console.log("--> 3. Benchmarking GET /v1/users/:id (50 workers, 2,000 requests)...")
  const userRes = await runBenchmark(
    port,
    `/v1/users/${testUserId}`,
    "GET",
    null,
    { Authorization: `Bearer ${token}` },
    50,
    2000
  )
  console.log(`    RPS:     ${userRes.rps.toFixed(1)} req/s`)
  console.log(`    P50:     ${userRes.p50Ms.toFixed(2)} ms`)
  console.log(`    P95:     ${userRes.p95Ms.toFixed(2)} ms`)
  console.log(`    P99:     ${userRes.p99Ms.toFixed(2)} ms`)
  console.log(`    Success: ${userRes.successCount}/${userRes.totalRequests}\n`)

  // Capture memory footprint
  const mem = process.memoryUsage()
  console.log("=================================================================")
  console.log(` Heap Used:   ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
  console.log(` Heap Total:  ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`)
  console.log(` Resident RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`)
  console.log(" Empirical Benchmark Complete.")
  console.log("=================================================================")

  server.close()
  process.exit(0)
}

main().catch(console.error)
