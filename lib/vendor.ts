/**
 * Alpha Vantage API adapter interface
 * Server-only utility for fetching stock market data
 */

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY
if (!ALPHA_VANTAGE_API_KEY) {
  throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required")
}

/**
 * Safely parse JSON response with better error handling
 */
async function safeJsonParse(response: Response, symbol: string): Promise<any> {
  // Read the response body as text first (can only read once)
  const text = await response.text()

  // Check if response looks like JSON
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    throw new Error(`Expected JSON response but got plain text. Response: ${text.substring(0, 200)}`)
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response for ${symbol}: ${error instanceof Error ? error.message : "Unknown error"}. Response: ${text.substring(0, 200)}`,
    )
  }
}

/**
 * Fetch current quote for a symbol using Alpha Vantage GLOBAL_QUOTE
 */
export async function fetchCurrent(symbol: string): Promise<{ current_quote: number }> {
  const normalizedSymbol = symbol.trim().toUpperCase()

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${normalizedSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Alpha Vantage API ${response.status}: ${response.statusText}`)
    }

    const data = await safeJsonParse(response, normalizedSymbol)

    // Check for API error messages
    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage error: ${data["Error Message"]}`)
    }

    if (data["Note"]) {
      throw new Error(`Alpha Vantage rate limit: ${data["Note"]}`)
    }

    // Extract price from Global Quote response
    const quote = data["Global Quote"]
    if (!quote || typeof quote["05. price"] !== "string") {
      throw new Error(`No quote data available for symbol ${normalizedSymbol}`)
    }

    const price = Number.parseFloat(quote["05. price"])
    if (isNaN(price)) {
      throw new Error(`Invalid price format for symbol ${normalizedSymbol}`)
    }

    return {
      current_quote: price,
    }
  } catch (error) {
    throw new Error(
      `Failed to fetch current quote for ${normalizedSymbol}: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Fetch 5 years of closing prices for a symbol using TIME_SERIES_DAILY
 */
export async function fetch5yCloses(symbol: string): Promise<Array<{ date: string; close_quote: number }>> {
  const normalizedSymbol = symbol.trim().toUpperCase()

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${normalizedSymbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Alpha Vantage API ${response.status}: ${response.statusText}`)
    }

    const data = await safeJsonParse(response, normalizedSymbol)

    // Check for API error messages
    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage error: ${data["Error Message"]}`)
    }

    if (data["Note"]) {
      throw new Error(`Alpha Vantage rate limit: ${data["Note"]}`)
    }

    const timeSeries = data["Time Series (Daily)"]
    if (!timeSeries || typeof timeSeries !== "object") {
      throw new Error(`No historical data available for symbol ${normalizedSymbol}`)
    }

    // Calculate date 5 years ago
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    // Convert object to array and filter for last 5 years
    const results: Array<{ date: string; close_quote: number }> = []

    for (const [date, values] of Object.entries(timeSeries)) {
      const dateObj = new Date(date)

      // Only include dates from last 5 years
      if (dateObj >= fiveYearsAgo) {
        const closePrice = Number.parseFloat((values as any)["4. close"])

        if (isNaN(closePrice)) {
          throw new Error(`Invalid close price format for ${normalizedSymbol} on ${date}`)
        }

        results.push({
          date: date, // Already in YYYY-MM-DD format
          close_quote: closePrice,
        })
      }
    }

    // Sort by date ascending (oldest first)
    results.sort((a, b) => a.date.localeCompare(b.date))

    if (results.length === 0) {
      throw new Error(`No data found in the last 5 years for symbol ${normalizedSymbol}`)
    }

    return results
  } catch (error) {
    throw new Error(
      `Failed to fetch 5-year closes for ${normalizedSymbol}: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Fetch 200-day simple moving average for a symbol using Alpha Vantage SMA
 */
export async function fetchSMA200(symbol: string): Promise<{ sma200: number }> {
  const normalizedSymbol = symbol.trim().toUpperCase()

  const url = `https://www.alphavantage.co/query?function=SMA&symbol=${normalizedSymbol}&interval=daily&time_period=200&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Alpha Vantage API ${response.status}: ${response.statusText}`)
    }

    const data = await safeJsonParse(response, normalizedSymbol)

    // Check for API error messages
    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage error: ${data["Error Message"]}`)
    }

    if (data["Note"]) {
      throw new Error(`Alpha Vantage rate limit: ${data["Note"]}`)
    }

    const technicalAnalysis = data["Technical Analysis: SMA"]
    if (!technicalAnalysis || typeof technicalAnalysis !== "object") {
      throw new Error(`No SMA data available for symbol ${normalizedSymbol}`)
    }

    // Get the most recent SMA value (first entry in the object)
    const dates = Object.keys(technicalAnalysis)
    if (dates.length === 0) {
      throw new Error(`No SMA values found for symbol ${normalizedSymbol}`)
    }

    // Sort dates descending to get most recent
    dates.sort((a, b) => b.localeCompare(a))
    const mostRecentDate = dates[0]
    const smaValue = Number.parseFloat(technicalAnalysis[mostRecentDate]["SMA"])

    if (isNaN(smaValue)) {
      throw new Error(`Invalid SMA value format for symbol ${normalizedSymbol}`)
    }

    return {
      sma200: smaValue,
    }
  } catch (error) {
    throw new Error(
      `Failed to fetch SMA200 for ${normalizedSymbol}: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Fetch current quotes for multiple symbols in bulk using Alpha Vantage REALTIME_BULK_QUOTES (Premium)
 * Can fetch up to 100 symbols per API call
 */
export async function fetchCurrentBulk(symbols: string[]): Promise<Map<string, number>> {
  if (symbols.length === 0) {
    return new Map()
  }

  if (symbols.length > 100) {
    throw new Error(`Cannot fetch more than 100 symbols at once. Received ${symbols.length} symbols.`)
  }

  const normalizedSymbols = symbols.map((s) => s.trim().toUpperCase())
  const symbolsParam = normalizedSymbols.join(",")

  const url = `https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=${symbolsParam}&apikey=${ALPHA_VANTAGE_API_KEY}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Alpha Vantage API ${response.status}: ${response.statusText}`)
    }

    const data = await safeJsonParse(response, `bulk[${normalizedSymbols.length}]`)

    // Check for API error messages
    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage error: ${data["Error Message"]}`)
    }

    if (data["Note"]) {
      throw new Error(`Alpha Vantage rate limit: ${data["Note"]}`)
    }

    // Extract quotes from response
    const quotes = data["data"]
    if (!Array.isArray(quotes)) {
      throw new Error(`Invalid bulk quotes response format`)
    }

    // Build map of symbol -> price
    const resultMap = new Map<string, number>()

    for (const quote of quotes) {
      const symbol = quote["symbol"]
      const priceStr = quote["price"]

      if (!symbol || typeof priceStr !== "string") {
        console.warn(`[v0] Skipping invalid quote entry:`, quote)
        continue
      }

      const price = Number.parseFloat(priceStr)
      if (isNaN(price)) {
        console.warn(`[v0] Invalid price format for ${symbol}: ${priceStr}`)
        continue
      }

      resultMap.set(symbol.toUpperCase(), price)
    }

    console.log(`[v0] Bulk fetched ${resultMap.size} quotes out of ${normalizedSymbols.length} requested symbols`)

    return resultMap
  } catch (error) {
    throw new Error(
      `Failed to fetch bulk quotes for ${normalizedSymbols.length} symbols: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}
