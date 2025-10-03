export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "test-user-1"

    const { data: transactions, error } = await supabaseAdmin
      .from("portfolio_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("include_in_portfolio", true)

    if (error) {
      console.error("Error fetching portfolio:", error)
      return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 })
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        positions: [],
        lastSynced: null,
      })
    }

    const netPositions = new Map<string, number>()
    for (const txn of transactions) {
      const current = netPositions.get(txn.ticker) || 0
      if (txn.transaction_type.toUpperCase() === "BUY") {
        netPositions.set(txn.ticker, current + txn.quantity)
      } else if (txn.transaction_type.toUpperCase() === "SELL") {
        netPositions.set(txn.ticker, current - txn.quantity)
      }
    }

    // Remove closed positions (net shares = 0)
    for (const [ticker, shares] of netPositions.entries()) {
      if (shares === 0) {
        netPositions.delete(ticker)
      }
    }

    if (netPositions.size === 0) {
      return NextResponse.json({
        totalValue: 0,
        positions: [],
        lastSynced: transactions[0]?.updated_at || null,
      })
    }

    const symbols = Array.from(netPositions.keys())
    const { data: tickers, error: tickersError } = await supabaseAdmin
      .from("tickers")
      .select("symbol, current_quote, logo_url")
      .in("symbol", symbols)

    if (tickersError) {
      console.error("Error fetching ticker prices:", tickersError)
      return NextResponse.json({ error: "Failed to fetch current prices" }, { status: 500 })
    }

    const priceMap = new Map<string, number>()
    const logoMap = new Map<string, string | null>()
    for (const ticker of tickers || []) {
      if (ticker.current_quote) {
        priceMap.set(ticker.symbol, ticker.current_quote)
      }
      logoMap.set(ticker.symbol, ticker.logo_url || null)
    }

    const portfolioPositions = Array.from(netPositions.entries())
      .map(([symbol, shares]) => {
        const currentPrice = priceMap.get(symbol)
        const value = currentPrice ? shares * currentPrice : 0

        return {
          symbol,
          shares,
          currentPrice: currentPrice || null,
          value,
          missingPrice: !currentPrice,
          logo_url: logoMap.get(symbol) || null,
        }
      })
      .sort((a, b) => b.value - a.value) // Sort by value descending

    const totalValue = portfolioPositions.reduce((sum, p) => sum + p.value, 0)

    const lastSynced = transactions.length > 0 ? transactions[0].updated_at : null

    return NextResponse.json({
      totalValue,
      positions: portfolioPositions,
      lastSynced,
    })
  } catch (error) {
    console.error("Portfolio data error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 })
  }
}
