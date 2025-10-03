"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Clock, CheckCircle, XCircle, Upload } from "lucide-react"

interface ProcessingSummary {
  processed: number
  updated_main: number
  upserted_history: number
  upserted_5y: number
  errors: string[]
}

interface IngestResponse {
  runId: number
  message: string
  summary: ProcessingSummary
  error?: string
  status: string
}

interface LastRun {
  id: number
  trigger: string
  started_at: string
  finished_at: string | null
  status: string
  processed: number
  updated_main: number
  upserted_history: number
  upserted_5y: number
  error: string | null
}

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
  timestamp: string
}

export default function SettingsPage() {
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [isLoadingLastRun, setIsLoadingLastRun] = useState(true)

  const [sheetUrl, setSheetUrl] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [portfolioSheetUrl, setPortfolioSheetUrl] = useState("")
  const [isPortfolioSyncing, setIsPortfolioSyncing] = useState(false)
  const [portfolioSyncResult, setPortfolioSyncResult] = useState<{
    success: boolean
    positions: number
    timestamp: string
  } | null>(null)
  const [portfolioSyncError, setPortfolioSyncError] = useState<string | null>(null)

  useEffect(() => {
    fetchLastRun()
  }, [])

  const fetchLastRun = async () => {
    try {
      const response = await fetch("/api/ingest/last")
      const data = await response.json()
      setLastRun(data.lastRun)
    } catch (error) {
      console.error("Failed to fetch last run:", error)
    } finally {
      setIsLoadingLastRun(false)
    }
  }

  const handleImportFromSheet = async () => {
    if (!sheetUrl.trim()) {
      setImportError("Please enter a Google Sheets URL")
      return
    }

    setIsImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const response = await fetch("/api/import-watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sheetUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        setImportError(data.error || "Failed to import watchlist")
        return
      }

      setImportResult(data)
      setSheetUrl("")
    } catch (error) {
      setImportError("Network error occurred")
    } finally {
      setIsImporting(false)
    }
  }

  const handlePortfolioSync = async () => {
    if (!portfolioSheetUrl.trim()) {
      setPortfolioSyncError("Please enter a Google Sheets URL")
      return
    }

    setIsPortfolioSyncing(true)
    setPortfolioSyncResult(null)
    setPortfolioSyncError(null)

    try {
      const response = await fetch("/api/portfolio/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sheetUrl: portfolioSheetUrl, userId: "test-user-1" }),
      })

      const data = await response.json()

      if (!response.ok) {
        setPortfolioSyncError(data.error || "Failed to sync portfolio")
        return
      }

      setPortfolioSyncResult(data)
    } catch (error) {
      setPortfolioSyncError("Network error occurred")
    } finally {
      setIsPortfolioSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "running":
        return { icon: Clock, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", label: "Running" }
      case "success":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
          label: "Success",
        }
      case "error":
        return { icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", label: "Error" }
      default:
        return { icon: Clock, color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", label: status }
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your stock tracking system</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Google Sheet</CardTitle>
            <CardDescription>
              Sync your portfolio from a published Google Sheet. The sheet should contain transaction history with
              columns: Date, Buy/Sell, Ticker, Quantity, Price, Currency, Include in Portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-sheet-url">Google Sheets URL</Label>
              <Input
                id="portfolio-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={portfolioSheetUrl}
                onChange={(e) => setPortfolioSheetUrl(e.target.value)}
                disabled={isPortfolioSyncing}
              />
              <p className="text-xs text-muted-foreground">
                Make sure your sheet is published to the web (File → Share → Publish to web → CSV format)
              </p>
            </div>

            <Button onClick={handlePortfolioSync} disabled={isPortfolioSyncing} className="w-full">
              {isPortfolioSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Sync Portfolio
                </>
              )}
            </Button>

            {portfolioSyncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
                <strong>Error:</strong> {portfolioSyncError}
              </div>
            )}

            {portfolioSyncResult && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300">
                  <strong>Success!</strong> Synced {portfolioSyncResult.positions} positions
                </div>

                <div className="text-xs text-muted-foreground">
                  Last sync: {formatDate(portfolioSyncResult.timestamp)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import from Google Sheets</CardTitle>
            <CardDescription>
              Upload your watchlist from a published Google Sheet. The sheet will overwrite your current watchlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheet-url">Google Sheets URL</Label>
              <Input
                id="sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                disabled={isImporting}
              />
              <p className="text-xs text-muted-foreground">
                Make sure your sheet is published to the web (File → Share → Publish to web → CSV format)
              </p>
            </div>

            <Button onClick={handleImportFromSheet} disabled={isImporting} className="w-full">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Watchlist
                </>
              )}
            </Button>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
                <strong>Error:</strong> {importError}
              </div>
            )}

            {importResult && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300">
                  <strong>Success!</strong> Imported {importResult.imported} stocks
                  {importResult.skipped > 0 && `, skipped ${importResult.skipped}`}
                </div>

                <div className="text-xs text-muted-foreground">Last import: {formatDate(importResult.timestamp)}</div>

                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-300">
                    <strong>Warnings:</strong>
                    <ul className="mt-1 space-y-1">
                      {importResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {importResult.errors.length > 5 && <li>• ... and {importResult.errors.length - 5} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Refresh Status</CardTitle>
            <CardDescription>Status of the most recent data refresh</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLastRun ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading last run...</span>
              </div>
            ) : lastRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const { icon: StatusIcon, color, label } = getStatusDisplay(lastRun.status)
                      return (
                        <>
                          <StatusIcon className="h-4 w-4" />
                          <Badge className={color}>{label}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {lastRun.trigger === "cron" ? "Automatic" : "Manual"}
                          </span>
                        </>
                      )
                    })()}
                  </div>
                  {lastRun.status === "running" && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Refresh in progress...
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  <div>Started: {formatDate(lastRun.started_at)}</div>
                  {lastRun.finished_at && <div>Finished: {formatDate(lastRun.finished_at)}</div>}
                </div>

                {lastRun.status !== "running" && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      Processed: <span className="font-medium">{lastRun.processed}</span>
                    </div>
                    <div>
                      Updated: <span className="font-medium">{lastRun.updated_main}</span>
                    </div>
                    <div>
                      History: <span className="font-medium">{lastRun.upserted_history}</span>
                    </div>
                    <div>
                      Chart: <span className="font-medium">{lastRun.upserted_5y}</span>
                    </div>
                  </div>
                )}

                {lastRun.error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
                    <strong>Error:</strong> {lastRun.error}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No refresh runs found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
