import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// GET: Fetch user's projection settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("projection_cagr, projection_monthly_contribution")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[v0] Error fetching projection settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      cagr: data.projection_cagr || 8,
      monthlyContribution: data.projection_monthly_contribution || 0,
    })
  } catch (error) {
    console.error("[v0] Error in GET /api/user/projection-settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Save user's projection settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, cagr, monthlyContribution } = body

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    if (cagr === undefined || monthlyContribution === undefined) {
      return NextResponse.json({ error: "cagr and monthlyContribution are required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        projection_cagr: cagr,
        projection_monthly_contribution: monthlyContribution,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (error) {
      console.error("[v0] Error saving projection settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in POST /api/user/projection-settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
