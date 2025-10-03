import { ChartsWithFilter } from "@/components/ChartsWithFilter"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

interface Stock {
  symbol: string
  uid: string
  target_price: number | null
  current_quote: number | null
  sma200: number | null
  delta_to_quote: number | null
  delta_to_sma: number | null
  priority: string // Added priority field
}

async function getStocks(): Promise<Stock[]> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000"

  console.log("[v0] Charts: fetching stocks from:", `${baseUrl}/api/wca_main?limit=100`)
  console.log("[v0] Charts: VERCEL_URL env var:", process.env.VERCEL_URL)
  console.log("[v0] Charts: NODE_ENV:", process.env.NODE_ENV)

  try {
    const response = await fetch(`${baseUrl}/api/wca_main?limit=100`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Charts-SSR/1.0",
      },
    })

    console.log("[v0] Charts: response status:", response.status)

    if (!response.ok) {
      throw new Error(`Failed to fetch stocks: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] Charts: received data:", {
      itemsCount: data.items?.length || 0,
      count: data.count,
      firstFewItems: data.items?.slice(0, 3)?.map((item: any) => ({
        symbol: item.symbol,
        uid: item.uid,
        target_price: item.target_price,
        current_quote: item.current_quote,
        priority: item.priority,
      })),
    })

    const stocks = data.items || []
    console.log("[v0] Charts: initialStocks count:", stocks.length)
    return stocks
  } catch (error) {
    console.error("[v0] Charts: API fetch failed, trying direct database query:", error)

    try {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
          },
        },
      )

      const { data: stocks, error: dbError } = await supabase.from("wca_main").select("*").limit(100)

      if (dbError) {
        console.error("[v0] Charts: Database query failed:", dbError)
        return []
      }

      console.log("[v0] Charts: Direct database query successful, got", stocks?.length || 0, "stocks")
      return stocks || []
    } catch (dbError) {
      console.error("[v0] Charts: Direct database query failed:", dbError)
      return []
    }
  }
}

export default async function ChartsPage() {
  const stocks = await getStocks()

  return (
    <div className="container mx-auto max-w-6xl">
      <ChartsWithFilter stocks={stocks} />
    </div>
  )
}
