export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { fetchCurrent, fetchCurrentBulk, fetchSMA200, fetch5yCloses } from "@/lib/vendor"
import { evaluateAlerts } from "@/lib/alertEvaluator"

interface ProcessingSummary {
  processed: number
  updated_tickers: number
  updated_watchlist: number
  upserted_history: number
  upserted_5y: number
  alerts_triggered: number
  errors: string[]
}

interface TickerToProcess {
  symbol: string
  uid: string
  users: Array<{
    user_id: string
    target_price: number
  }>
}

interface StockRow {
  uid: string
  symbol: string
  target_price: number
}

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Get today's date in UTC format (YYYY-MM-DD)
function getTodayUTC(): string {
  const today = new Date()
  return today.toISOString().split("T")[0]
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const isCron = url.searchParams.get("cron") === "1"
  const trigger = isCron ? "cron" : "manual"

  const { data: runData, error: runInsertError } = await supabaseAdmin
    .from("wca_ingest_runs")
    .insert({
      trigger,
      status: "running",
    })
    .select("id")
    .single()

  if (runInsertError || !runData) {
    return Response.json({ error: "Failed to create run record", details: runInsertError?.message }, { status: 500 })
  }

  const runId = runData.id

  const summary: ProcessingSummary = {
    processed: 0,
    updated_tickers: 0,
    updated_watchlist: 0,
    upserted_history: 0,
    upserted_5y: 0,
    alerts_triggered: 0,
    errors: [],
  }

  try {
    const { data: watchlistItems, error: fetchError } = await supabaseAdmin
      .from("user_watchlist")
      .select("symbol, user_id, target_price")

    if (fetchError) {
      throw new Error(`Failed to fetch watchlist: ${fetchError.message}`)
    }

    if (!watchlistItems || watchlistItems.length === 0) {
      await supabaseAdmin
        .from("wca_ingest_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          processed: 0,
          updated_main: 0,
          upserted_history: 0,
          upserted_5y: 0,
        })
        .eq("id", runId)

      return Response.json({
        runId,
        message: "No stocks found to process",
        summary,
        status: "success",
      })
    }

    const tickersMap = new Map<string, TickerToProcess>()

    for (const item of watchlistItems) {
      if (!tickersMap.has(item.symbol)) {
        tickersMap.set(item.symbol, {
          symbol: item.symbol,
          uid: `wca_${item.symbol.toLowerCase()}`,
          users: [],
        })
      }
      tickersMap.get(item.symbol)!.users.push({
        user_id: item.user_id,
        target_price: item.target_price,
      })
    }

    const uniqueTickers = Array.from(tickersMap.values())
    console.log(
      `[v0] Starting ingest for ${uniqueTickers.length} unique tickers (${watchlistItems.length} total watchlist items)`,
    )

    const BULK_QUOTE_SIZE = 100
    const bulkQuotesMap = new Map<string, number>()

    for (let i = 0; i < uniqueTickers.length; i += BULK_QUOTE_SIZE) {
      const chunk = uniqueTickers.slice(i, i + BULK_QUOTE_SIZE)
      const symbols = chunk.map((t) => t.symbol)

      console.log(
        `[v0] Fetching bulk quotes for batch ${Math.floor(i / BULK_QUOTE_SIZE) + 1}/${Math.ceil(uniqueTickers.length / BULK_QUOTE_SIZE)} (${symbols.length} symbols)`,
      )

      try {
        const quotes = await fetchCurrentBulk(symbols)
        for (const [symbol, price] of quotes.entries()) {
          bulkQuotesMap.set(symbol, price)
        }
        console.log(`[v0] Successfully fetched ${quotes.size} quotes in this batch`)
      } catch (error) {
        const errorMsg = `Bulk quote fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`
        summary.errors.push(errorMsg)
        console.error(`[v0] ${errorMsg}`)
      }

      // Small delay between bulk fetches
      if (i + BULK_QUOTE_SIZE < uniqueTickers.length) {
        await delay(500)
      }
    }

    console.log(`[v0] Total bulk quotes fetched: ${bulkQuotesMap.size}/${uniqueTickers.length}`)

    // Process stocks in chunks of 5 to respect rate limits for SMA and historical data
    const CHUNK_SIZE = 5
    const DELAY_BETWEEN_CHUNKS = 1000 // 1 second
    const DELAY_BETWEEN_CALLS = 200 // 200ms between individual API calls

    for (let i = 0; i < uniqueTickers.length; i += CHUNK_SIZE) {
      const chunk = uniqueTickers.slice(i, i + CHUNK_SIZE)
      console.log(
        `[v0] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(uniqueTickers.length / CHUNK_SIZE)}`,
      )

      for (const ticker of chunk) {
        try {
          await processTicker(ticker, summary, bulkQuotesMap)
          summary.processed++

          if (chunk.indexOf(ticker) < chunk.length - 1) {
            await delay(DELAY_BETWEEN_CALLS)
          }
        } catch (error) {
          const errorMsg = `Ticker ${ticker.symbol}: ${error instanceof Error ? error.message : "Unknown error"}`
          summary.errors.push(errorMsg)
          console.error(`[v0] ${errorMsg}`)
        }
      }

      if (i + CHUNK_SIZE < uniqueTickers.length) {
        console.log(`[v0] Waiting ${DELAY_BETWEEN_CHUNKS}ms before next chunk...`)
        await delay(DELAY_BETWEEN_CHUNKS)
      }
    }

    console.log(`[v0] Ingest completed. Summary:`, summary)

    await supabaseAdmin
      .from("wca_ingest_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        processed: summary.processed,
        updated_main: summary.updated_tickers + summary.updated_watchlist,
        upserted_history: summary.upserted_history,
        upserted_5y: summary.upserted_5y,
      })
      .eq("id", runId)

    return Response.json({
      runId,
      message: "Stock data refresh completed",
      summary,
      processed: summary.processed,
      updated_tickers: summary.updated_tickers,
      updated_watchlist: summary.updated_watchlist,
      upserted_history: summary.upserted_history,
      upserted_5y: summary.upserted_5y,
      alerts_triggered: summary.alerts_triggered,
      status: "success",
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    summary.errors.push(`Global error: ${errorMsg}`)

    await supabaseAdmin
      .from("wca_ingest_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: errorMsg.substring(0, 1000), // Truncate to 1000 chars
        processed: summary.processed,
        updated_main: summary.updated_tickers + summary.updated_watchlist,
        upserted_history: summary.upserted_history,
        upserted_5y: summary.upserted_5y,
      })
      .eq("id", runId)

    return Response.json(
      {
        runId,
        message: "Stock data refresh failed",
        summary,
        error: errorMsg,
        status: "error",
      },
      { status: 500 },
    )
  }
}

async function processTicker(ticker: TickerToProcess, summary: ProcessingSummary, bulkQuotesMap: Map<string, number>) {
  const { symbol, uid, users } = ticker

  console.log(`[v0] Processing ${symbol} (${uid}) for ${users.length} user(s)`)

  let currentQuote: number
  if (bulkQuotesMap.has(symbol)) {
    currentQuote = bulkQuotesMap.get(symbol)!
    console.log(`[v0] Using bulk-fetched quote for ${symbol}: $${currentQuote}`)
  } else {
    console.log(`[v0] Bulk quote not available for ${symbol}, fetching individually...`)
    const currentData = await fetchCurrent(symbol)
    currentQuote = currentData.current_quote
    await delay(100)
  }

  // b) Fetch SMA200
  const smaData = await fetchSMA200(symbol)
  await delay(100)

  let logoUrl: string | null = null

  // Check if logo already exists
  const { data: existingTicker } = await supabaseAdmin.from("tickers").select("logo_url").eq("symbol", symbol).single()

  if (!existingTicker?.logo_url) {
    // Logo doesn't exist, fetch it
    try {
      const logoResponse = await fetch(`https://api.elbstream.com/logos/symbol/${symbol}`, {
        method: "HEAD", // Use HEAD to check existence without downloading
      })
      if (logoResponse.ok) {
        logoUrl = `https://api.elbstream.com/logos/symbol/${symbol}`
        console.log(`[v0] Fetched logo for ${symbol}`)
      } else {
        console.log(`[v0] No logo available for ${symbol} (${logoResponse.status})`)
      }
    } catch (logoError) {
      console.error(`[v0] Failed to fetch logo for ${symbol}:`, logoError)
    }
    await delay(100)
  } else {
    // Logo already exists, reuse it
    logoUrl = existingTicker.logo_url
    console.log(`[v0] Using existing logo for ${symbol}`)
  }

  // c) Compute delta to SMA (shared across all users)
  const delta_to_sma = (currentQuote - smaData.sma200) / smaData.sma200

  // d) Update tickers table (shared data)
  const tickerUpdatePayload = {
    symbol,
    current_quote: currentQuote,
    sma200: smaData.sma200,
    delta_to_sma,
    logo_url: logoUrl,
    last_updated: new Date().toISOString(),
  }

  const { error: tickerUpdateError } = await supabaseAdmin
    .from("tickers")
    .upsert(tickerUpdatePayload, { onConflict: "symbol" })

  if (tickerUpdateError) {
    throw new Error(`Failed to update tickers table: ${tickerUpdateError.message}`)
  }
  summary.updated_tickers++

  // e) Update each user's watchlist with their specific delta_to_quote
  for (const user of users) {
    const delta_to_quote = (currentQuote - user.target_price) / user.target_price

    const { error: watchlistUpdateError } = await supabaseAdmin
      .from("user_watchlist")
      .update({ delta_to_quote })
      .eq("user_id", user.user_id)
      .eq("symbol", symbol)

    if (watchlistUpdateError) {
      console.error(`[v0] Failed to update watchlist for user ${user.user_id}:`, watchlistUpdateError)
    } else {
      summary.updated_watchlist++
    }

    // f) Evaluate alerts for this user
    try {
      console.log(`[v0] Evaluating alerts for ${symbol} (user: ${user.user_id})`)

      const { count: alertsBefore } = await supabaseAdmin
        .from("wca_alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user_id)
        .eq("symbol", symbol)

      await evaluateAlerts(
        uid,
        symbol,
        {
          target_price: user.target_price,
          current_quote: currentQuote,
          sma200: smaData.sma200,
          delta_to_quote,
          delta_to_sma,
        },
        user.user_id,
      )

      const { count: alertsAfter } = await supabaseAdmin
        .from("wca_alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user_id)
        .eq("symbol", symbol)

      const newAlerts = (alertsAfter || 0) - (alertsBefore || 0)
      if (newAlerts > 0) {
        summary.alerts_triggered += newAlerts
        console.log(`[v0] Triggered ${newAlerts} new alerts for ${symbol} (user: ${user.user_id})`)
      }
    } catch (alertError) {
      console.error(`[v0] Alert evaluation failed for ${symbol} (user: ${user.user_id}):`, alertError)
      summary.errors.push(
        `Alert evaluation failed for ${symbol}: ${alertError instanceof Error ? alertError.message : "Unknown error"}`,
      )
    }
  }

  // g) Upsert into wca_history for today's UTC date
  const todayUTC = getTodayUTC()
  const historyPayload = {
    wca_uid: uid,
    symbol,
    date: todayUTC,
    current_quote: currentQuote,
    sma200: smaData.sma200,
    delta_to_sma,
    delta_to_quote: null, // History doesn't track user-specific deltas
  }

  const { error: historyError } = await supabaseAdmin.from("wca_history").upsert(historyPayload, {
    onConflict: "wca_uid,date",
    ignoreDuplicates: false,
  })

  if (historyError) {
    throw new Error(`Failed to upsert history: ${historyError.message}`)
  }
  summary.upserted_history++

  // h) Fetch and upsert 5-year chart data
  const chartData = await fetch5yCloses(symbol)

  if (chartData.length > 0) {
    const chartPayloads = chartData.map((item) => ({
      wca_uid: uid,
      symbol,
      date: item.date,
      close_quote: item.close_quote,
    }))

    const CHART_BATCH_SIZE = 1000
    for (let i = 0; i < chartPayloads.length; i += CHART_BATCH_SIZE) {
      const batch = chartPayloads.slice(i, i + CHART_BATCH_SIZE)

      const { error: chartError } = await supabaseAdmin.from("wca_chart_5y").upsert(batch, {
        onConflict: "wca_uid,date",
        ignoreDuplicates: false,
      })

      if (chartError) {
        throw new Error(`Failed to upsert chart data batch: ${chartError.message}`)
      }
    }

    summary.upserted_5y += chartData.length
    console.log(`[v0] Upserted ${chartData.length} chart records for ${symbol}`)
  }

  console.log(`[v0] Completed processing ${symbol}`)
}
