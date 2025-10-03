export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"

function extractSpreadsheetId(url: string): string | null {
  try {
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/spreadsheets\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/,
      /key=([a-zA-Z0-9-_]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchGoogleSheetCSV(spreadsheetId: string): Promise<string> {
  const urlPatterns = [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=0`,
    `https://docs.google.com/spreadsheets/u/0/d/${spreadsheetId}/export?format=csv&gid=0`,
  ]

  let lastError: Error | null = null

  for (const url of urlPatterns) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StockTracker/1.0)",
        },
      })

      if (response.ok) {
        const text = await response.text()
        if (text && text.length > 0 && !text.includes("<!DOCTYPE html>")) {
          return text
        }
      }

      if (response.status === 403 || response.status === 401) {
        throw new Error("Permission denied. Please publish your sheet to the web.")
      }
    } catch (error) {
      lastError = error as Error
      continue
    }
  }

  throw lastError || new Error("Failed to fetch data from all URL patterns")
}

function parseTransactionsCSV(csvText: string): Array<{
  trade_date: string
  transaction_type: string
  ticker: string
  quantity: number
  local_price: number
  trade_currency: string
  include_in_portfolio: boolean
}> {
  const lines = csvText.split("\n")
  const transactions: Array<{
    trade_date: string
    transaction_type: string
    ticker: string
    quantity: number
    local_price: number
    trade_currency: string
    include_in_portfolio: boolean
  }> = []

  function convertDateToISO(dateStr: string): string | null {
    // Try DD/MM/YYYY format
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }

    // Try MM/DD/YYYY format
    const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (mmddyyyyMatch) {
      const [, first, second, year] = mmddyyyyMatch
      // Assume DD/MM/YYYY if first number > 12
      if (Number.parseInt(first) > 12) {
        return `${year}-${second.padStart(2, "0")}-${first.padStart(2, "0")}`
      }
      // Otherwise assume MM/DD/YYYY
      return `${year}-${first.padStart(2, "0")}-${second.padStart(2, "0")}`
    }

    // Try YYYY-MM-DD format (already ISO)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }

    return null
  }

  // Skip header row (index 0), start from row 2 (index 1)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line (handle quoted fields)
    const columns: string[] = []
    let currentField = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        columns.push(currentField.trim())
        currentField = ""
      } else {
        currentField += char
      }
    }
    columns.push(currentField.trim())

    // Column A (index 0): Date
    // Column B (index 1): Transaction Type (Buy/Sell)
    // Column C (index 2): Ticker
    // Column D (index 3): Quantity
    // Column E (index 4): Local Price
    // Column F (index 5): Trade Currency
    // Column G (index 6): Portfolio (TRUE/FALSE)
    const dateStr = columns[0]?.replace(/"/g, "").trim()
    const transactionType = columns[1]?.replace(/"/g, "").trim()
    const ticker = columns[2]?.replace(/"/g, "").trim().toUpperCase()
    const quantityStr = columns[3]?.replace(/"/g, "").trim()
    const priceStr = columns[4]?.replace(/"/g, "").trim()
    const currency = columns[5]?.replace(/"/g, "").trim().toUpperCase()
    const includeStr = columns[6]?.replace(/"/g, "").trim().toUpperCase()

    // Validate required fields
    if (!dateStr || !transactionType || !ticker || !quantityStr || !priceStr || !currency) {
      continue
    }

    const isoDate = convertDateToISO(dateStr)
    if (!isoDate) {
      console.warn(`[v0] Skipping row ${i + 1}: Invalid date format "${dateStr}"`)
      continue
    }

    const quantity = Number.parseFloat(quantityStr)
    const price = Number.parseFloat(priceStr)

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      continue
    }

    transactions.push({
      trade_date: isoDate,
      transaction_type: transactionType,
      ticker,
      quantity,
      local_price: price,
      trade_currency: currency,
      include_in_portfolio: includeStr === "TRUE",
    })
  }

  return transactions
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sheetUrl, userId = "test-user-1" } = body

    if (!sheetUrl || typeof sheetUrl !== "string") {
      return NextResponse.json({ error: "Sheet URL is required" }, { status: 400 })
    }

    // Validate and extract spreadsheet ID
    const spreadsheetId = extractSpreadsheetId(sheetUrl)
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Please provide a valid Google Sheets URL" }, { status: 400 })
    }

    // Fetch CSV data
    let csvText: string
    try {
      csvText = await fetchGoogleSheetCSV(spreadsheetId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch data"
      if (errorMessage.includes("Permission denied")) {
        return NextResponse.json(
          { error: "Please publish your sheet to the web (File → Share → Publish to web → CSV format)" },
          { status: 403 },
        )
      }
      return NextResponse.json({ error: "Failed to fetch data, please try again" }, { status: 500 })
    }

    const transactions = parseTransactionsCSV(csvText)

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No transactions found in sheet" }, { status: 400 })
    }

    const uniqueTickers = [...new Set(transactions.map((t) => t.ticker))]

    // Check which tickers already exist
    const { data: existingTickers } = await supabaseAdmin.from("tickers").select("symbol").in("symbol", uniqueTickers)

    const existingSymbols = new Set(existingTickers?.map((t) => t.symbol) || [])
    const missingTickers = uniqueTickers.filter((ticker) => !existingSymbols.has(ticker))

    // Add missing tickers to tickers table
    if (missingTickers.length > 0) {
      const tickersToInsert = missingTickers.map((symbol) => ({
        symbol,
        name: symbol, // Use symbol as name initially
        current_price: null,
        last_updated: new Date().toISOString(),
      }))

      await supabaseAdmin.from("tickers").insert(tickersToInsert)
    }

    // Save portfolio sheet URL to user
    await supabaseAdmin.from("users").upsert({ id: userId, portfolio_sheet_url: sheetUrl }, { onConflict: "id" })

    await supabaseAdmin.from("portfolio_transactions").delete().eq("user_id", userId)

    const transactionsToInsert = transactions.map((t) => ({
      user_id: userId,
      trade_date: t.trade_date,
      transaction_type: t.transaction_type,
      ticker: t.ticker,
      quantity: t.quantity,
      local_price: t.local_price,
      trade_currency: t.trade_currency,
      include_in_portfolio: t.include_in_portfolio,
    }))

    const { error: insertError } = await supabaseAdmin.from("portfolio_transactions").insert(transactionsToInsert)

    if (insertError) {
      console.error("Error inserting portfolio transactions:", insertError)
      return NextResponse.json({ error: "Failed to save portfolio transactions" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      transactions: transactions.length,
      tickersAdded: missingTickers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Portfolio sync error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 })
  }
}
