"use client"

import { useState, useEffect } from "react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { PriorityPills } from "@/components/PriorityPills"
import { AddStockDialog } from "@/components/add-stock-dialog"
import { EditStockDialog } from "@/components/edit-stock-dialog"
import { ChevronUp, ChevronDown } from "lucide-react"
import Image from "next/image"

interface Stock {
  symbol: string
  uid: string
  target_price: number
  current_quote: number | null
  sma200: number | null
  delta_to_quote: number | null
  delta_to_sma: number | null
  priority: string
  logo_url: string | null // Added logo_url field
}

interface WatchlistSearchProps {
  initialStocks: Stock[]
}

type PriorityFilter = "All" | "High" | "Medium" | "Low"
type SortColumn = "ticker" | "delta" | "trend" | null
type SortDirection = "asc" | "desc"

function formatPrice(value: number | null): string {
  if (value === null) return "-"
  return `$ ${Math.round(value)}`
}

function formatPercent(value: number | null): string {
  if (value === null) return "-"
  const rounded = Math.round(value * 100)
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`
}

function getRowBackgroundClass(delta: number | null): string {
  if (delta === null) return ""
  const deltaPercent = delta * 100
  if (deltaPercent <= 0) return "bg-green-50"
  if (deltaPercent <= 15) return "bg-yellow-50"
  return ""
}

function getDeltaTextColor(delta: number | null): string {
  if (delta === null) return "text-muted-foreground"
  const deltaPercent = delta * 100
  if (deltaPercent <= 0) return "text-green-600"
  if (deltaPercent <= 15) return "text-yellow-700"
  return "text-red-600"
}

function getTrendTextColor(trend: number | null): string {
  if (trend === null) return "text-muted-foreground"
  const trendPercent = trend * 100
  if (trendPercent <= -5) return "text-green-600"
  if (trendPercent <= 1) return "text-yellow-700"
  return "text-red-600"
}

export function WatchlistSearch({ initialStocks }: WatchlistSearchProps) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All")
  const [editingStock, setEditingStock] = useState<Stock | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("watchlist-sort-column") as SortColumn) || null
    }
    return null
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("watchlist-sort-direction") as SortDirection) || "asc"
    }
    return "asc"
  })

  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem("watchlist-sort-column", sortColumn)
      localStorage.setItem("watchlist-sort-direction", sortDirection)
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

  const handleStockClick = (stock: Stock) => {
    setEditingStock(stock)
    setEditDialogOpen(true)
  }

  const visibleStocks = stocks
    .filter((stock) => {
      if (priorityFilter === "All") return true
      return stock.priority === priorityFilter
    })
    .sort((a, b) => {
      if (!sortColumn) return 0

      let comparison = 0
      if (sortColumn === "ticker") {
        comparison = a.symbol.localeCompare(b.symbol)
      } else if (sortColumn === "delta") {
        const aVal = a.delta_to_quote
        const bVal = b.delta_to_quote

        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1

        comparison = bVal - aVal
      } else if (sortColumn === "trend") {
        const aVal = a.delta_to_sma
        const bVal = b.delta_to_sma

        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1

        comparison = bVal - aVal
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return sortDirection === "asc" ? (
      <ChevronUp className="inline-block w-2 h-2 ml-0.5" />
    ) : (
      <ChevronDown className="inline-block w-2 h-2 ml-0.5" />
    )
  }

  return (
    <div className="space-y-2 px-2">
      <div className="flex items-center justify-between gap-2">
        <AddStockDialog />
        <PriorityPills value={priorityFilter} onChange={setPriorityFilter} />
      </div>

      <div className="overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="text-xs bg-gray-100 hover:bg-gray-100">
              <TableHead
                className="h-auto py-1 px-1.5 font-medium cursor-pointer whitespace-nowrap w-[80px]"
                onClick={() => handleSort("ticker")}
              >
                Ticker
                <SortIndicator column="ticker" />
              </TableHead>
              <TableHead className="h-auto py-1 px-1.5 font-medium text-right whitespace-nowrap w-[55px]">
                Target
              </TableHead>
              <TableHead className="h-auto py-1 px-1.5 font-medium text-right whitespace-nowrap w-[55px]">
                Current
              </TableHead>
              <TableHead
                className="h-auto py-1 px-1.5 font-medium text-right cursor-pointer whitespace-nowrap w-[55px]"
                onClick={() => handleSort("delta")}
              >
                Delta
                <SortIndicator column="delta" />
              </TableHead>
              <TableHead
                className="h-auto py-1 px-1.5 font-medium text-right cursor-pointer whitespace-nowrap w-[55px]"
                onClick={() => handleSort("trend")}
              >
                Trend
                <SortIndicator column="trend" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-xs">
                  {priorityFilter !== "All" ? `No stocks with ${priorityFilter} priority` : "No stocks in watchlist"}
                </TableCell>
              </TableRow>
            ) : (
              visibleStocks.map((stock, index) => (
                <TableRow
                  key={stock.uid}
                  onClick={() => handleStockClick(stock)}
                  className={`text-xs cursor-pointer hover:bg-gray-100 ${getRowBackgroundClass(stock.delta_to_quote)} ${
                    index === visibleStocks.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <TableCell className="py-1 px-1.5 font-medium whitespace-nowrap w-[80px]">
                    <div className="flex items-center gap-1.5">
                      {stock.logo_url ? (
                        <Image
                          src={stock.logo_url || "/placeholder.svg"}
                          alt={`${stock.symbol} logo`}
                          width={20}
                          height={20}
                          className="rounded-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-gray-200 rounded-sm flex-shrink-0" />
                      )}
                      <span>{stock.symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono whitespace-nowrap w-[55px]">
                    {formatPrice(stock.target_price)}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono whitespace-nowrap w-[55px]">
                    {stock.current_quote === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      formatPrice(stock.current_quote)
                    )}
                  </TableCell>
                  <TableCell
                    className={`py-1 px-1.5 text-right font-mono whitespace-nowrap w-[55px] ${getDeltaTextColor(stock.delta_to_quote)}`}
                  >
                    {formatPercent(stock.delta_to_quote)}
                  </TableCell>
                  <TableCell
                    className={`py-1 px-1.5 text-right font-mono whitespace-nowrap w-[55px] ${getTrendTextColor(stock.delta_to_sma)}`}
                  >
                    {formatPercent(stock.delta_to_sma)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {visibleStocks.length} of {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
        {priorityFilter !== "All" && ` (filtered by ${priorityFilter} priority)`}
      </p>
      <EditStockDialog stock={editingStock} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
    </div>
  )
}
