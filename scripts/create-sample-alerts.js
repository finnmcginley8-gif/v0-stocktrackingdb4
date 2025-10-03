/**
 * Inserts a couple of sample alerts directly for quick UI checks.
 * Uses Supabase admin key (server-only).
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log("[create] inserting sample alerts…")

  // Pick an existing uid (adjust if needed)
  // If you know a uid, hardcode it; otherwise grab one:
  const { data: stocks, error: e1 } = await sb.from("wca_main").select("uid, symbol").limit(1)
  if (e1) throw e1
  if (!stocks?.length) throw new Error("No rows in wca_main; add a stock first.")

  const { uid, symbol } = stocks[0]

  const payload = [
    {
      wca_uid: uid,
      type: "dq_le_5pct",
      status: "triggered",
      details: { symbol, note: "sample dq ≤ 5%" },
    },
    {
      wca_uid: uid,
      type: "drawdown_10pct_2d",
      status: "triggered",
      details: { symbol, note: "sample drawdown 10% in 2d" },
    },
  ]

  const { data, error } = await sb.from("wca_alerts").insert(payload).select()
  if (error) throw error

  console.log("[create] inserted:", data?.length ?? 0)
  for (const row of data ?? []) {
    console.log("  -", row.id, row.type, row.created_at)
  }
}

main().catch((e) => {
  console.error("[create] error:", e)
  process.exit(1)
})
