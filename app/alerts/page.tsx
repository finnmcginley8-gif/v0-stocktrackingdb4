import { AlertsWithFilter } from "./alerts-with-filter"

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

interface AlertsResponse {
  alerts: Alert[]
  count: number
}

async function getAlerts(): Promise<AlertsResponse> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "production"
        ? "https://your-app-domain.vercel.app" // Replace with actual domain
        : "http://localhost:3000"

    const url = `${baseUrl}/api/alerts?limit=100`

    console.log("[v0] Alerts: fetching alerts from:", url)
    console.log("[v0] Alerts: VERCEL_URL env var:", process.env.VERCEL_URL)
    console.log("[v0] Alerts: NODE_ENV:", process.env.NODE_ENV)

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    })

    console.log("[v0] Alerts: response status:", response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Alerts: API error response:", errorText)

      console.log("[v0] Alerts: Trying direct database query as fallback")
      return await getAlertsDirectly()
    }

    const data = await response.json()
    console.log("[v0] Alerts: received data:", {
      alertsCount: data.alerts?.length || 0,
      count: data.count,
      firstFewTypes: data.alerts?.slice(0, 3).map((alert: Alert) => alert.type) || [],
    })

    return data
  } catch (error) {
    console.error("[v0] Alerts: Error fetching alerts:", error)

    console.log("[v0] Alerts: Trying direct database query as fallback")
    return await getAlertsDirectly()
  }
}

async function getAlertsDirectly(): Promise<AlertsResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin")

    console.log("[v0] Alerts: Using direct database query")

    const { data: alerts, error } = await supabaseAdmin
      .from("wca_alerts")
      .select(`
        id,
        wca_uid,
        type,
        status,
        message,
        threshold_value,
        actual_value,
        created_at,
        details,
        wca_main!inner(symbol, priority)
      `)
      .eq("status", "triggered")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("[v0] Alerts: Direct database error:", error)
      return { alerts: [], count: 0 }
    }

    // Transform the data to flatten the joined wca_main data
    const transformedAlerts = (alerts || []).map((alert: any) => ({
      id: alert.id,
      wca_uid: alert.wca_uid,
      type: alert.type,
      status: alert.status,
      message: alert.message,
      threshold_value: alert.threshold_value,
      actual_value: alert.actual_value,
      created_at: alert.created_at,
      details: alert.details,
      symbol: alert.wca_main?.symbol,
      priority: alert.wca_main?.priority,
    }))

    console.log("[v0] Alerts: Direct database query returned:", {
      alertsCount: transformedAlerts?.length || 0,
      firstFewTypes: transformedAlerts?.slice(0, 3).map((alert) => alert.type) || [],
    })

    return {
      alerts: transformedAlerts || [],
      count: transformedAlerts?.length || 0,
    }
  } catch (error) {
    console.error("[v0] Alerts: Direct database query failed:", error)
    return { alerts: [], count: 0 }
  }
}

export default async function AlertsPage() {
  const { alerts: initialAlerts } = await getAlerts()

  console.log("[v0] Alerts: initialAlerts count:", initialAlerts.length)

  return (
    <div className="container mx-auto">
      <div className="space-y-6">
        <AlertsWithFilter initialAlerts={initialAlerts} />
      </div>
    </div>
  )
}
