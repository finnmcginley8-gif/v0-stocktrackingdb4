/**
 * End-to-end alert test:
 * 1) Calls /api/ingest/run (manual)
 * 2) Reads /api/alerts/feed?limit=20
 * 3) Prints a compact summary
 */

const BASE = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : "http://localhost:3000"

async function main() {
  console.log("[test] Using base:", BASE)

  // 1) Trigger ingest (manual)
  console.log("[test] POST /api/ingest/run …")
  const runRes = await fetch(`${BASE}/api/ingest/run`, { method: "POST" })
  const runJson = await runRes.json().catch(() => ({}))
  console.log("[test] ingest status:", runRes.status, runJson)

  if (!runRes.ok) {
    console.error("[test] Ingest failed — cannot continue.")
    process.exit(1)
  }

  // 2) Fetch alerts feed
  console.log("[test] GET /api/alerts/feed?limit=20 …")
  const feedRes = await fetch(`${BASE}/api/alerts/feed?limit=20`, { cache: "no-store" })
  const feedJson = await feedRes.json().catch(() => [])
  console.log("[test] feed status:", feedRes.status)

  // 3) Print compact summary
  if (Array.isArray(feedJson)) {
    console.log(`\n=== Latest Alerts (${feedJson.length}) ===`)
    for (const a of feedJson) {
      const when = a.created_at ?? a.createdAt ?? ""
      const sym = a.symbol ?? a.wca_uid ?? ""
      const typ = a.type ?? ""
      const pri = a.priority ?? "None"
      console.log(`• ${when}  ${sym} [${pri}]  ${typ}`)
    }
  } else {
    console.log(feedJson)
  }
}

main().catch((e) => {
  console.error("[test] Uncaught error:", e)
  process.exit(1)
})
