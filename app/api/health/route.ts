export const runtime = "nodejs"

export async function GET() {
  try {
    // Check if required environment variables are present
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return Response.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL environment variable" }, { status: 500 })
    }

    if (!supabaseServiceRoleKey) {
      return Response.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY environment variable" }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: "Health check failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
