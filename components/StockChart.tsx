"use client"

import { useState, useEffect, useMemo } from "react"
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface ChartData {
  date: string
  close_quote: number
}

interface StockChartProps {
  uid: string
  symbol: string
  dateRange: string
}

export function StockChart({ uid, symbol, dateRange }: StockChartProps) {
  const [data, setData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true)
        setError(null)

        const url = `/api/chart/5y?uid=${uid}&range=${dateRange}&t=${Date.now()}`
        const response = await fetch(url, { cache: "no-store" })

        if (!response.ok) {
          throw new Error(`Failed to fetch chart data: ${response.status}`)
        }

        const json = await response.json()

        const processedData = (json.items ?? [])
          .map((d: any) => ({
            date: String(d.date),
            close_quote: Number(d.close_quote),
          }))
          .sort((a: ChartData, b: ChartData) => a.date.localeCompare(b.date))

        console.debug(
          symbol,
          `${dateRange} first:`,
          processedData[0]?.date,
          "last:",
          processedData[processedData.length - 1]?.date,
        )
        console.debug(symbol, "api lastDate:", json.lastDate)

        setData(processedData)
      } catch (err) {
        console.error("Chart fetch error:", err)
        setError(err instanceof Error ? err.message : "Failed to load chart data")
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [uid, symbol, dateRange])

  const yAxisDomain = useMemo(() => {
    if (data.length === 0) return ["auto", "auto"]

    const prices = data.map((d) => d.close_quote)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min
    const padding = range * 0.05 // 5% padding on each side

    // Calculate median
    const sorted = [...prices].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    // Center domain around median with padding
    const domainMin = Math.floor(min - padding)
    const domainMax = Math.ceil(max + padding)

    return [domainMin, domainMax]
  }, [data])

  if (loading) {
    return (
      <div className="h-24 rounded-xl bg-card p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-24 rounded-xl bg-card p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Error loading chart</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-24 rounded-xl bg-card p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No data yet. Run refresh.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-24 rounded-xl bg-card p-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <YAxis domain={yAxisDomain} hide />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Close"]}
            labelFormatter={(label) => {
              const [year, month, day] = String(label).split("-")
              return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString()
            }}
          />
          <Area
            type="monotone"
            dataKey="close_quote"
            stroke="#000000"
            strokeWidth={2}
            fill="url(#colorClose)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
