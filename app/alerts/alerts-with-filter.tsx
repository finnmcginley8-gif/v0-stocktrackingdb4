"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp } from "lucide-react"
import { PriorityBadge } from "@/components/PriorityBadge"

interface Alert {
  id: number
  wca_uid: string
  type: string
  status: string
  message: string
  threshold_value: number | null
  actual_value: number | null
  created_at: string
  details: any
  symbol: string
  priority: string
}

interface AlertsWithFilterProps {
  initialAlerts: Alert[]
}

type StatusFilter = "triggered" | "acknowledged" | "cleared"

function getAlertIcon(type: string) {
  if (type.includes("drawdown")) {
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }
  if (type.includes("dq_le_neg") || type.includes("dsma_le_neg")) {
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }
  return <AlertTriangle className="h-4 w-4 text-yellow-500" />
}

function getAlertSeverity(type: string): "high" | "medium" | "low" {
  if (type.includes("drawdown") || type.includes("neg10pct")) {
    return "high"
  }
  if (type.includes("neg5pct") || type.includes("0pct")) {
    return "medium"
  }
  return "low"
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export function AlertsWithFilter({ initialAlerts }: AlertsWithFilterProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("triggered")

  useEffect(() => {
    async function fetchAlerts() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          limit: "100",
          status: statusFilter,
        })

        const response = await fetch(`/api/alerts?${params}`)
        if (response.ok) {
          const data = await response.json()
          setAlerts(data.alerts || [])
        }
      } catch (error) {
        console.error("Fetch error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
  }, [statusFilter])

  const visibleAlerts = alerts

  const handleStatusChange = async (alertId: number, newStatus: string) => {
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alertId,
          status: newStatus,
        }),
      })

      if (response.ok) {
        // Update local state
        setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, status: newStatus } : alert)))
      }
    } catch (error) {
      console.error("Error updating alert status:", error)
    }
  }

  const groupedAlerts = visibleAlerts.reduce(
    (acc, alert) => {
      const severity = getAlertSeverity(alert.type)
      acc[severity].push(alert)
      return acc
    },
    { high: [] as Alert[], medium: [] as Alert[], low: [] as Alert[] },
  )

  return (
    <div className="space-y-4 px-2">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {(["triggered", "acknowledged", "cleared"] as StatusFilter[]).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize text-xs px-2 py-1 h-7 whitespace-nowrap"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <span className="text-xs text-muted-foreground">Loading...</span>}

      {/* Alert Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="text-[10px] font-medium">High</div>
            <TrendingDown className="h-3 w-3 text-red-500" />
          </div>
          <div className="text-lg font-bold text-red-600">{groupedAlerts.high.length}</div>
        </div>
        <div className="p-3">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="text-[10px] font-medium">Med</div>
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          </div>
          <div className="text-lg font-bold text-yellow-600">{groupedAlerts.medium.length}</div>
        </div>
        <div className="p-3">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="text-[10px] font-medium">Low</div>
            <TrendingUp className="h-3 w-3 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-blue-600">{groupedAlerts.low.length}</div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {visibleAlerts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No {statusFilter} alerts</p>
            <p className="text-xs text-muted-foreground mt-1">Alerts will appear here when stock conditions are met</p>
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <div key={alert.id} className="p-3 hover:bg-muted/20 transition-colors">
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm">{alert.symbol}</h3>
                      <PriorityBadge priority={alert.priority as "None" | "High" | "Medium" | "Low"} />
                      <Badge
                        variant={getAlertSeverity(alert.type) === "high" ? "destructive" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {getAlertSeverity(alert.type)}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateTime(alert.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Badge
                    variant={alert.status === "triggered" ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {alert.status}
                  </Badge>
                  {alert.status === "triggered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(alert.id, "acknowledged")}
                      className="h-7 text-[10px] px-2"
                    >
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />
                      Ack
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Text */}
      <p className="text-xs text-muted-foreground">
        Showing {visibleAlerts.length} of {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
