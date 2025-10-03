export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"
import { makeMessage } from "@/lib/formatAlert"
import { TEST_USER_ID } from "@/lib/constants"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit") || "50"
    const statusFilter = searchParams.get("status") || "triggered"
    const symbolFilter = searchParams.get("symbol")

    console.log("[v0] Alerts API: received params:", { limitParam, statusFilter, symbolFilter })

    let limit = Number(limitParam)
    if (!Number.isInteger(limit) || limit <= 0) {
      limit = 50
    }
    if (limit > 200) {
      limit = 200
    }

    let supabaseQuery = supabaseAdmin
      .from("wca_alerts")
      .select(`
        id,
        wca_uid,
        symbol,
        type,
        status,
        message,
        threshold_value,
        actual_value,
        created_at,
        details,
        user_id
      `)
      .eq("user_id", TEST_USER_ID)
      .eq("status", statusFilter)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (symbolFilter?.trim()) {
      supabaseQuery = supabaseQuery.eq("symbol", symbolFilter.trim().toUpperCase())
      console.log("[v0] Alerts API: applying symbol filter for:", symbolFilter.trim().toUpperCase())
    }

    const { data: alerts, error, count } = await supabaseQuery

    console.log("[v0] Alerts API: database query result:", {
      alertsCount: alerts?.length || 0,
      error: error?.message || null,
      count,
    })

    if (error) {
      console.error("[v0] Alerts API: Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const alertsWithPriority = await Promise.all(
      (alerts || []).map(async (alert: any) => {
        const { data: watchlistItem } = await supabaseAdmin
          .from("user_watchlist")
          .select("priority")
          .eq("user_id", alert.user_id)
          .eq("symbol", alert.symbol)
          .single()

        return {
          id: alert.id,
          wca_uid: alert.wca_uid,
          type: alert.type,
          status: alert.status,
          message: alert.message ?? makeMessage(alert.type, alert.details ?? { symbol: alert.symbol }),
          threshold_value: alert.threshold_value,
          actual_value: alert.actual_value,
          created_at: alert.created_at,
          details: alert.details,
          symbol: alert.symbol,
          priority: watchlistItem?.priority || "None",
        }
      }),
    )

    const result = {
      alerts: alertsWithPriority,
      count: count || 0,
    }

    console.log("[v0] Alerts API: returning result:", {
      alertsCount: result.alerts.length,
      count: result.count,
      firstFewTypes: result.alerts.slice(0, 3).map((alert) => alert.type),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Alerts API: API error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { alertId, status } = body

    if (!alertId || !status) {
      return NextResponse.json({ error: "alertId and status are required" }, { status: 400 })
    }

    const validStatuses = ["triggered", "acknowledged", "cleared"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "status must be one of: triggered, acknowledged, cleared" }, { status: 400 })
    }

    const { data: alert, error } = await supabaseAdmin
      .from("wca_alerts")
      .update({ status })
      .eq("id", alertId)
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      alert,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 500 })
  }
}
