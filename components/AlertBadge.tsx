"use client"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown } from "lucide-react"

interface AlertBadgeProps {
  type: string
  count?: number
  className?: string
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

function getAlertIcon(type: string) {
  if (type.includes("drawdown")) {
    return <TrendingDown className="h-3 w-3" />
  }
  if (type.includes("dq_le_neg") || type.includes("dsma_le_neg")) {
    return <TrendingDown className="h-3 w-3" />
  }
  return <AlertTriangle className="h-3 w-3" />
}

export function AlertBadge({ type, count, className }: AlertBadgeProps) {
  const severity = getAlertSeverity(type)
  const icon = getAlertIcon(type)

  return (
    <Badge
      variant={severity === "high" ? "destructive" : severity === "medium" ? "default" : "secondary"}
      className={className}
    >
      {icon}
      {count !== undefined && <span className="ml-1">{count}</span>}
    </Badge>
  )
}
