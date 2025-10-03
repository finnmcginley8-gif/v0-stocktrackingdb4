"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, PieChartIcon, Calculator } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/hooks/use-debounce"

interface PortfolioPosition {
  symbol: string
  shares: number
  currentPrice: number | null
  value: number
  missingPrice?: boolean
  logo_url?: string | null
}

interface PortfolioData {
  totalValue: number
  positions: PortfolioPosition[]
  lastSynced: string | null
}

const BLUE_COLORS = [
  "#2563eb", // vibrant true blue (start)
  "#3b82f6", // bright blue
  "#4f8ff7", // medium-bright blue
  "#60a5fa", // sky blue
  "#74b3fb", // light sky blue
  "#86c0fc", // lighter sky blue
  "#93c5fd", // pale sky blue
  "#a5d0fd", // very pale blue
  "#b8dcfe", // soft pale blue
  "#bfdbfe", // lighter soft blue
  "#d0e7fe", // very light blue
  "#dbeafe", // pale blue-white
  "#e8f3fe", // almost white blue
  "#f0f7ff", // lightest blue
  "#f8fbff", // barely blue white
]

const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent, name, logo_url, index }: any) => {
  const RADIAN = Math.PI / 180

  // Only show label if slice is large enough (>3%)
  if (percent < 0.03) return null

  const labelRadius = outerRadius + 25
  const x = cx + labelRadius * Math.cos(-midAngle * RADIAN)
  const y = cy + labelRadius * Math.sin(-midAngle * RADIAN)

  // Logo centered at x (16px wide, so x-8 to x+8)
  const logoX = x - 8
  const logoY = y - 18 // Position logo above the center point

  // Ticker text centered below logo
  const tickerY = logoY + 16 + 4 // Logo height (16) + gap (4)

  // Percentage text centered below ticker
  const percentY = tickerY + 12 // Ticker line height + gap

  const clipPathId = `logo-clip-${index}`

  return (
    <g>
      <defs>
        <clipPath id={clipPathId}>
          <rect x={logoX} y={logoY} width={16} height={16} rx={3} ry={3} />
        </clipPath>
      </defs>
      {/* Logo centered */}
      {logo_url ? (
        <image
          x={logoX}
          y={logoY}
          width={16}
          height={16}
          href={logo_url}
          clipPath={`url(#${clipPathId})`}
          style={{ pointerEvents: "none" }}
        />
      ) : (
        <rect x={logoX} y={logoY} width={16} height={16} fill="#9ca3af" rx={3} />
      )}
      {/* Ticker text - always centered */}
      <text
        x={x}
        y={tickerY}
        fill="black"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: "10px", fontWeight: "600" }}
      >
        {name}
      </text>
      {/* Percentage text - always centered */}
      <text
        x={x}
        y={percentY}
        fill="#6b7280"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: "9px", fontWeight: "400" }}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  )
}

export default function PortfolioPage() {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cagr, setCagr] = useState(8) // Default 8% annual return
  const [monthlyContribution, setMonthlyContribution] = useState(0) // Default $0
  const debouncedCagr = useDebounce(cagr, 1000)
  const debouncedMonthlyContribution = useDebounce(monthlyContribution, 1000)

  useEffect(() => {
    fetchPortfolioData()
    fetchProjectionSettings()
  }, [])

  useEffect(() => {
    if (debouncedCagr !== 8 || debouncedMonthlyContribution !== 0) {
      saveProjectionSettings()
    }
  }, [debouncedCagr, debouncedMonthlyContribution])

  const fetchPortfolioData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/portfolio/data?userId=test-user-1")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to fetch portfolio data")
        return
      }

      setPortfolioData(data)
    } catch (err) {
      setError("Network error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProjectionSettings = async () => {
    try {
      const response = await fetch("/api/user/projection-settings?userId=test-user-1")
      const data = await response.json()

      if (response.ok) {
        setCagr(data.cagr)
        setMonthlyContribution(data.monthlyContribution)
      }
    } catch (err) {
      console.error("[v0] Error fetching projection settings:", err)
    }
  }

  const saveProjectionSettings = async () => {
    try {
      await fetch("/api/user/projection-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "test-user-1",
          cagr: debouncedCagr,
          monthlyContribution: debouncedMonthlyContribution,
        }),
      })
    } catch (err) {
      console.error("[v0] Error saving projection settings:", err)
    }
  }

  const formatCurrency = (value: number) => {
    return (
      "$ " +
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(value))
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const calculate5YearProjection = (currentValue: number) => {
    const years = 5
    const months = years * 12
    const monthlyRate = cagr / 100 / 12

    // Future value of current portfolio
    const futureValueOfCurrent = currentValue * Math.pow(1 + cagr / 100, years)

    // Future value of monthly contributions (annuity formula)
    const futureValueOfContributions =
      monthlyContribution > 0 ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) : 0

    return futureValueOfCurrent + futureValueOfContributions
  }

  // Prepare data for charts
  const positionsWithPrices = portfolioData?.positions.filter((p) => !p.missingPrice) || []
  const positionsWithoutPrices = portfolioData?.positions.filter((p) => p.missingPrice) || []

  const pieChartData =
    positionsWithPrices
      .sort((a, b) => b.value - a.value)
      .map((position, index) => ({
        name: position.symbol,
        value: position.value,
        fill: BLUE_COLORS[index % BLUE_COLORS.length],
        logo_url: position.logo_url,
      })) || []

  const barChartData =
    positionsWithPrices.map((position) => ({
      symbol: position.symbol,
      value: position.value,
    })) || []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-muted-foreground">Loading portfolio...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!portfolioData || portfolioData.positions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Portfolio Data</CardTitle>
            <CardDescription>
              Upload your portfolio data from Settings to see your holdings and total value.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-6xl mx-auto space-y-2">
        {/* Portfolio */}
        <Card className="py-3 px-2">
          <CardContent className="px-1 py-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Box 1: Current Portfolio Value */}
              <div className="flex flex-col text-center">
                <div className="text-sm text-muted-foreground leading-tight">Portfolio</div>
                <div className="text-xl font-bold text-foreground leading-tight">
                  {formatCurrency(portfolioData.totalValue)}
                </div>
              </div>
              {/* Box 2: 5Y Projection */}
              <div className="flex flex-col text-center">
                <div className="text-sm text-muted-foreground leading-tight">5Y Projection</div>
                <div className="text-xl font-bold text-foreground leading-tight">
                  {formatCurrency(calculate5YearProjection(portfolioData.totalValue))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        {positionsWithPrices.length > 0 && (
          <Card className="pt-3 px-0 pb-0">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center justify-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Portfolio Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    label={renderCustomLabel}
                    labelLine={false}
                    innerRadius={18}
                    outerRadius={110}
                    fill="#8884d8"
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    strokeWidth={0}
                    paddingAngle={1}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium w-24">Ticker</th>
                    <th className="text-right p-2 font-medium">%</th>
                    <th className="text-right p-2 font-medium">Shares</th>
                    <th className="text-right p-2 font-medium">Price</th>
                    <th className="text-right p-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.positions.map((position) => {
                    const percentage =
                      portfolioData.totalValue > 0 ? (position.value / portfolioData.totalValue) * 100 : 0
                    return (
                      <tr
                        key={position.symbol}
                        className="border-b"
                        style={{
                          background: `linear-gradient(to right, #e5e7eb ${percentage}%, transparent ${percentage}%)`,
                        }}
                      >
                        <td className="p-2 font-medium w-24">
                          <div className="flex items-center gap-2">
                            {position.logo_url ? (
                              <img
                                src={position.logo_url || "/placeholder.svg"}
                                alt={position.symbol}
                                className="w-4 h-4 rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                            ) : (
                              <div className="w-4 h-4 rounded bg-muted" />
                            )}
                            {position.symbol}
                          </div>
                        </td>
                        <td className="text-right p-2">
                          {percentage > 0 ? (
                            `${percentage.toFixed(1)}%`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-right p-2">
                          {position.shares % 1 === 0 ? position.shares.toFixed(0) : position.shares.toFixed(2)}
                        </td>
                        <td className="text-right p-2">
                          {position.currentPrice ? (
                            formatCurrency(position.currentPrice)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="text-right p-2 font-medium">
                          {position.value > 0 ? (
                            formatCurrency(position.value)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Projection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Projection Settings
            </CardTitle>
            <CardDescription>Adjust assumptions for 5-year projection</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cagr">CAGR (%)</Label>
                <Input
                  id="cagr"
                  type="number"
                  value={cagr}
                  onChange={(e) => setCagr(Number(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly">Monthly Contributions ($)</Label>
                <Input
                  id="monthly"
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  min="0"
                  step="100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
