export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/get-current-user-id"
import { createServerClient } from "@/lib/supabase/server"

async function getUserId(request: NextRequest): Promise<string> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return getCurrentUserId(user?.id)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol: rawSymbol, target_price: rawTargetPrice, priority: rawPriority } = body

    // Normalize and validate symbol
    const symbol = String(rawSymbol || "")
      .trim()
      .toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required and cannot be empty" }, { status: 400 })
    }

    // Normalize and validate target_price
    const target_price = Number(rawTargetPrice)
    if (!Number.isFinite(target_price) || target_price <= 0) {
      return NextResponse.json({ error: "target_price must be a finite number greater than 0" }, { status: 400 })
    }

    const priority = rawPriority || "None"
    const validPriorities = ["None", "High", "Medium", "Low"]
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: "priority must be one of: None, High, Medium, Low" }, { status: 400 })
    }

    // Step 1: Ensure ticker exists in tickers table
    const { error: tickerError } = await supabaseAdmin
      .from("tickers")
      .upsert({ symbol }, { onConflict: "symbol", ignoreDuplicates: true })

    if (tickerError) {
      console.error("Ticker upsert error:", tickerError)
      return NextResponse.json({ error: tickerError.message }, { status: 500 })
    }

    const userId = await getUserId(request)

    // Step 2: Add to user's watchlist
    const watchlistPayload = {
      user_id: userId,
      symbol,
      target_price,
      priority,
    }

    const { data: watchlistItem, error: watchlistError } = await supabaseAdmin
      .from("user_watchlist")
      .upsert(watchlistPayload, { onConflict: "user_id,symbol" })
      .select()
      .single()

    if (watchlistError) {
      console.error("Watchlist upsert error:", watchlistError)
      return NextResponse.json({ error: watchlistError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      stock: watchlistItem,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limitParam = searchParams.get("limit") || "100"

    console.log("[v0] wca_main API: received params:", { query, limitParam })

    // Validate and constrain limit
    let limit = Number(limitParam)
    if (!Number.isInteger(limit) || limit <= 0) {
      limit = 100
    }
    if (limit > 500) {
      limit = 500
    }

    const userId = await getUserId(request)

    // Build the query with JOIN
    let supabaseQuery = supabaseAdmin
      .from("user_watchlist")
      .select(`
        id,
        symbol,
        target_price,
        delta_to_quote,
        priority,
        notes,
        added_at,
        tickers!inner(
          uid,
          current_quote,
          sma200,
          delta_to_sma,
          last_updated,
          logo_url
        )
      `)
      .eq("user_id", userId)
      .limit(limit)

    // Add case-insensitive search if query provided
    if (query.trim()) {
      supabaseQuery = supabaseQuery.ilike("symbol", `%${query.trim()}%`)
      console.log("[v0] wca_main API: applying search filter for:", query.trim())
    } else {
      console.log("[v0] wca_main API: no search filter, fetching all stocks")
    }

    const { data: items, error, count } = await supabaseQuery

    console.log("[v0] wca_main API: database query result:", {
      itemsCount: items?.length || 0,
      error: error?.message || null,
      count,
    })

    if (error) {
      console.error("[v0] wca_main API: Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform the joined data to match the old structure
    const transformedItems = (items || []).map((item: any) => ({
      symbol: item.symbol,
      uid: item.tickers.uid,
      target_price: item.target_price,
      current_quote: item.tickers.current_quote,
      sma200: item.tickers.sma200,
      delta_to_quote: item.delta_to_quote,
      delta_to_sma: item.tickers.delta_to_sma,
      priority: item.priority,
      notes: item.notes,
      added_at: item.added_at,
      last_updated: item.tickers.last_updated,
      logo_url: item.tickers.logo_url,
    }))

    const result = {
      items: transformedItems,
      count: count || 0,
    }

    console.log("[v0] wca_main API: returning result:", {
      itemsCount: result.items.length,
      count: result.count,
      firstFewSymbols: result.items.slice(0, 3).map((item) => item.symbol),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] wca_main API: API error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, symbol: rawSymbol, target_price: rawTargetPrice, priority: rawPriority } = body

    // We need either uid or symbol to identify the stock
    let symbol = rawSymbol?.trim().toUpperCase()

    if (uid && !symbol) {
      // Extract symbol from uid (format: wca_symbol)
      symbol = uid.replace("wca_", "").toUpperCase()
    }

    if (!symbol) {
      return NextResponse.json({ error: "Symbol or uid is required" }, { status: 400 })
    }

    const target_price = Number(rawTargetPrice)
    if (!Number.isFinite(target_price) || target_price <= 0) {
      return NextResponse.json({ error: "target_price must be a finite number greater than 0" }, { status: 400 })
    }

    const priority = rawPriority || "None"
    const validPriorities = ["None", "High", "Medium", "Low"]
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: "priority must be one of: None, High, Medium, Low" }, { status: 400 })
    }

    const userId = await getUserId(request)

    // Update user's watchlist entry
    const { data: updated, error } = await supabaseAdmin
      .from("user_watchlist")
      .update({ target_price, priority })
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .select()
      .single()

    if (error) {
      console.error("Update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      stock: updated,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, symbol: rawSymbol } = body

    // We need either uid or symbol to identify the stock
    let symbol = rawSymbol?.trim().toUpperCase()

    if (uid && !symbol) {
      // Extract symbol from uid (format: wca_symbol)
      symbol = uid.replace("wca_", "").toUpperCase()
    }

    if (!symbol) {
      return NextResponse.json({ error: "Symbol or uid is required" }, { status: 400 })
    }

    const userId = await getUserId(request)

    // Delete from user's watchlist
    const { error } = await supabaseAdmin.from("user_watchlist").delete().eq("user_id", userId).eq("symbol", symbol)

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${symbol} from watchlist`,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 500 })
  }
}
