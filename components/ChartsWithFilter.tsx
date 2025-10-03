"use client"

import { useState, useEffect } from "react"
import { StockChart } from "@/components/StockChart"
import { PriorityPills } from "@/components/PriorityPills"
import { formatPct, formatNum } from "@/lib/format"
import { ChevronUp, ChevronDown } from "lucide-react"
import Image from "next/image"

interface Stock {
  symbol: string
  uid: string
  target_price: number | null
  current_quote: number | null
  sma200: number | null
  delta_to_quote: number | null
  delta_to_sma: number | null
  priority: string
  logo_url: string | null // Added logo_url field
}

interface ChartsWithFilterProps {
  stocks: Stock[]
}

type PriorityFilter = "All" | "High" | "Medium" | "Low"
type SortColumn = "name" | "delta" | "trend" | null
type SortDirection = "asc" | "desc"
type DateRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "10Y"

export function ChartsWithFilter({ stocks }: ChartsWithFilterProps) {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All")

  const [dateRange, setDateRange] = useState<DateRange>("2Y")

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("charts-sort-column") as SortColumn) || null
    }
    return null
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("charts-sort-direction") as SortDirection) || "asc"
    }
    return "asc"
  })

  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem("charts-sort-column", sortColumn)
      localStorage.setItem("charts-sort-direction", sortDirection)
    }
  }, [sortColumn, sortDirection])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return sortDirection === "asc" ? (
      <ChevronUp className="inline-block w-3 h-3 ml-0.5" />
    ) : (
      <ChevronDown className="inline-block w-3 h-3 ml-0.5" />
    )
  }

  const visibleStocks = stocks
    .filter((stock) => {
      if (priorityFilter === "All") return true
      return stock.priority === priorityFilter
    })
    .sort((a, b) => {
      if (!sortColumn) return 0

      let comparison = 0
      if (sortColumn === "name") {
        comparison = a.symbol.localeCompare(b.symbol)
      } else if (sortColumn === "delta") {
        const aVal = a.delta_to_quote
        const bVal = b.delta_to_quote
        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1
        comparison = aVal - bVal
      } else if (sortColumn === "trend") {
        const aVal = a.delta_to_sma
        const bVal = b.delta_to_sma
        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1
        comparison = aVal - bVal
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

  return (
    <div className="space-y-4 px-2">
      <div className="flex justify-end">
        <PriorityPills value={priorityFilter} onChange={setPriorityFilter} />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground border-b pb-2">
        <span className="font-medium">Sort:</span>
        <button
          onClick={() => handleSort("name")}
          className={`hover:text-foreground transition-colors ${sortColumn === "name" ? "text-foreground font-medium" : ""}`}
        >
          Name
          <SortIndicator column="name" />
        </button>
        <button
          onClick={() => handleSort("delta")}
          className={`hover:text-foreground transition-colors ${sortColumn === "delta" ? "text-foreground font-medium" : ""}`}
        >
          Delta
          <SortIndicator column="delta" />
        </button>
        <button
          onClick={() => handleSort("trend")}
          className={`hover:text-foreground transition-colors ${sortColumn === "trend" ? "text-foreground font-medium" : ""}`}
        >
          Trend
          <SortIndicator column="trend" />
        </button>

        <div className="flex items-center gap-4 ml-auto">
          {(["10Y", "5Y", "2Y", "1Y", "6M", "3M"] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`hover:text-foreground transition-colors ${dateRange === range ? "text-foreground font-medium" : ""}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {visibleStocks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            {stocks.length === 0 ? "No stocks in your watchlist yet." : `No stocks with ${priorityFilter} priority.`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stocks.length === 0
              ? "Add some stocks to see their charts here."
              : "Try selecting a different priority filter."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {visibleStocks.map((stock) => (
            <div key={stock.uid} className="flex gap-3 px-3 pt-0.5 pb-0 hover:bg-muted/20 transition-colors">
              <div className="w-[30%] space-y-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {stock.logo_url ? (
                    <Image
                      src={stock.logo_url || "/placeholder.svg"}
                      alt={`${stock.symbol} logo`}
                      width={16} // Reduced from 24 to 16
                      height={16} // Reduced from 24 to 16
                      className="rounded-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 bg-gray-200 rounded-sm flex-shrink-0" /> // Reduced from w-6 h-6 to w-4 h-4
                  )}
                  <h2 className="text-sm font-semibold">{stock.symbol}</h2>
                  <p className="text-sm font-semibold">${formatNum(stock.current_quote)}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Target: </span>
                    <span className="font-semibold">${formatNum(stock.target_price)}</span>
                    <span
                      className={`ml-1 font-semibold ${(stock.delta_to_quote ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      ({formatPct(stock.delta_to_quote)})
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Trend: </span>
                    <span
                      className={`font-semibold ${(stock.delta_to_sma ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatPct(stock.delta_to_sma)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-[70%]">
                <StockChart uid={stock.uid} symbol={stock.symbol} dateRange={dateRange} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {visibleStocks.length} of {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
        {priorityFilter !== "All" && ` (filtered by ${priorityFilter} priority)`}
      </p>
    </div>
  )
}
