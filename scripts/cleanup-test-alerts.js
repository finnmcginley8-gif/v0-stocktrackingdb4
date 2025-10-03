/**
 * Deletes sample alerts created by create-sample-alerts.js.
 * Adjust the filter if you want to match on details.note or recent time.
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
  console.log("[cleanup] deleting sample alerts…")

  // Delete by note (matches what we inserted)
  const { error } = await sb
    .from("wca_alerts")
    .delete()
    .or("details->>note.eq.sample dq ≤ 5%,details->>note.eq.sample drawdown 10% in 2d")

  if (error) throw error

  console.log("[cleanup] done.")
}

main().catch((e) => {
  console.error("[cleanup] error:", e)
  process.exit(1)
})
