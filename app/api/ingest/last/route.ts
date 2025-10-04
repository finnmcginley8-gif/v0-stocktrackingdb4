export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("wca_ingest_runs")
      .select(
        "id, trigger, started_at, finished_at, status, processed, updated_main, upserted_history, upserted_5y, error",
      )
      .order("started_at", { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Failed to fetch last run: ${error.message}`)
    }

    const lastRun = data && data.length > 0 ? data[0] : null

    return Response.json({ lastRun })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: "Failed to fetch last run", details: errorMsg }, { status: 500 })
  }
}
