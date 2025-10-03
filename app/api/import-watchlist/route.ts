export const runtime = "nodejs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
  timestamp: string
}

// Extract spreadsheet ID from various Google Sheets URL formats
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

// Try multiple CSV export URL patterns
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
        // Check if we got actual CSV data (not an error page)
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

// Parse CSV and extract ticker and target price from columns B and D
function parseCSV(csvText: string): Array<{ symbol: string; target_price: number }> {
  const lines = csvText.split("\n")
  const stocks: Array<{ symbol: string; target_price: number }> = []
  const errors: string[] = []

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

    // Column B is index 1 (ticker), Column D is index 3 (target price)
    const ticker = columns[1]?.replace(/"/g, "").trim().toUpperCase()
    const targetPriceStr = columns[3]?.replace(/"/g, "").trim()

    if (!ticker || !targetPriceStr) {
      continue // Skip rows with missing data
    }

    const targetPrice = Number.parseFloat(targetPriceStr)
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      errors.push(`Row ${i + 1}: Invalid target price for ${ticker}`)
      continue
    }

    stocks.push({
      symbol: ticker,
      target_price: targetPrice,
    })
  }

  return stocks
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sheetUrl } = body

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

    // Parse CSV
    const stocks = parseCSV(csvText)

    if (stocks.length === 0) {
      return NextResponse.json({ error: "No tickers found in sheet" }, { status: 400 })
    }

    // Clear existing watchlist and insert new stocks
    const errors: string[] = []
    let imported = 0
    let skipped = 0

    // Delete all existing stocks
    const { error: deleteError } = await supabaseAdmin.from("wca_main").delete().neq("symbol", "")

    if (deleteError) {
      console.error("Error clearing watchlist:", deleteError)
      return NextResponse.json({ error: "Failed to clear existing watchlist" }, { status: 500 })
    }

    // Insert new stocks
    for (const stock of stocks) {
      try {
        const { error } = await supabaseAdmin
          .from("wca_main")
          .upsert(
            {
              symbol: stock.symbol,
              target_price: stock.target_price,
              priority: "None",
            },
            { onConflict: "symbol" },
          )
          .select()
          .single()

        if (error) {
          errors.push(`${stock.symbol}: ${error.message}`)
          skipped++
        } else {
          imported++
        }
      } catch (error) {
        errors.push(`${stock.symbol}: ${error instanceof Error ? error.message : "Unknown error"}`)
        skipped++
      }
    }

    const result: ImportResult = {
      success: true,
      imported,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 })
  }
}
