import { WatchlistSearch } from "./watchlist-search"

interface Stock {
  symbol: string
  uid: string
  target_price: number
  current_quote: number | null
  sma200: number | null
  delta_to_quote: number | null
  delta_to_sma: number | null
  priority: string // Added priority field
  logo_url: string | null // Added logo_url field
}

interface WatchlistResponse {
  items: Stock[]
  count: number
}

async function getStocks(): Promise<WatchlistResponse> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "production"
        ? "https://your-app-domain.vercel.app" // Replace with actual domain
        : "http://localhost:3000"

    const url = `${baseUrl}/api/wca_main?limit=100`

    console.log("[v0] Watchlist: fetching stocks from:", url)
    console.log("[v0] Watchlist: VERCEL_URL env var:", process.env.VERCEL_URL)
    console.log("[v0] Watchlist: NODE_ENV:", process.env.NODE_ENV)

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    })

    console.log("[v0] Watchlist: response status:", response.status, response.statusText)

    if (!response.ok) {
      console.log("[v0] Watchlist: Trying direct database query as fallback")
      return await getStocksDirectly()
    }

    const data = await response.json()
    console.log("[v0] Watchlist: received data:", {
      itemsCount: data.items?.length || 0,
      count: data.count,
      firstFewItems: data.items?.slice(0, 3) || [],
    })

    return data
  } catch (error) {
    console.error("[v0] Watchlist: Error fetching stocks:", error)

    console.log("[v0] Watchlist: Trying direct database query as fallback")
    return await getStocksDirectly()
  }
}

async function getStocksDirectly(): Promise<WatchlistResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin")

    console.log("[v0] Watchlist: Using direct database query")

    const { data: wcaData, error: wcaError } = await supabaseAdmin
      .from("wca_main")
      .select("symbol, uid, target_price, current_quote, sma200, delta_to_quote, delta_to_sma, priority")
      .limit(100)

    if (wcaError) {
      console.error("[v0] Watchlist: Direct database error:", wcaError)
      return { items: [], count: 0 }
    }

    // Fetch logos from tickers table
    const symbols = wcaData?.map((item) => item.symbol) || []
    const { data: tickersData } = await supabaseAdmin.from("tickers").select("symbol, logo_url").in("symbol", symbols)

    // Create a map of symbol to logo_url
    const logoMap = new Map(tickersData?.map((t) => [t.symbol, t.logo_url]) || [])

    // Merge the data
    const items =
      wcaData?.map((item) => ({
        ...item,
        logo_url: logoMap.get(item.symbol) || null,
      })) || []

    return {
      items,
      count: items.length,
    }
  } catch (error) {
    console.error("[v0] Watchlist: Direct database query failed:", error)
    return { items: [], count: 0 }
  }
}

function formatNumber(value: number | null): string {
  if (value === null) return "-"
  return value.toFixed(2)
}

function formatDelta(value: number | null): string {
  if (value === null) return "-"
  const formatted = value.toFixed(2)
  return value >= 0 ? `+${formatted}` : formatted
}

export default async function WatchlistPage() {
  const { items: initialStocks } = await getStocks()

  console.log("[v0] Watchlist: initialStocks count:", initialStocks.length)

  return (
    <div className="container mx-auto">
      <WatchlistSearch initialStocks={initialStocks} />
    </div>
  )
}
