// Alert Evaluation Logic
// Handles checking alert conditions and managing cooldowns

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { ALERT_RULES, type AlertRule } from "@/lib/alertRules"
import { makeMessage } from "@/lib/formatAlert"

interface HistoryRow {
  date: string
  delta_to_quote: number | null
  delta_to_sma: number | null
}

interface ChartRow {
  date: string
  close_quote: number
}

interface AlertTrigger {
  rule: AlertRule
  symbol: string
  uid: string
  actualValue?: number
  thresholdValue?: number
  message: string
  context: AlertContext
}

interface AlertContext {
  target_price?: number
  current_quote?: number
  sma200?: number
  delta_to_quote?: number
  delta_to_sma?: number
  latest_close?: number
  two_days_ago_close?: number
}

// Get the last 3 history rows for crossing detection
async function getRecentHistory(uid: string): Promise<HistoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("wca_history")
    .select("date, delta_to_quote, delta_to_sma")
    .eq("wca_uid", uid)
    .order("date", { ascending: false })
    .limit(3)

  if (error) {
    throw new Error(`Failed to fetch history for ${uid}: ${error.message}`)
  }

  return (data || []).reverse() // Return in ascending date order
}

// Get the last 3 chart rows for drawdown detection
async function getRecentChart(uid: string): Promise<ChartRow[]> {
  const { data, error } = await supabaseAdmin
    .from("wca_chart_5y")
    .select("date, close_quote")
    .eq("wca_uid", uid)
    .order("date", { ascending: false })
    .limit(3)

  if (error) {
    throw new Error(`Failed to fetch chart data for ${uid}: ${error.message}`)
  }

  return data || []
}

// Check if alert is still in cooldown period
async function isInCooldown(uid: string, ruleKey: string, cooldownDays: number, userId: string): Promise<boolean> {
  // Get the last alert of this type for this user
  const { data: lastAlert, error } = await supabaseAdmin
    .from("wca_alerts")
    .select("created_at")
    .eq("wca_uid", uid)
    .eq("type", ruleKey)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !lastAlert) {
    // No previous alert found, not in cooldown
    return false
  }

  // Count distinct trading days since last alert
  const { data: tradingDays, error: countError } = await supabaseAdmin
    .from("wca_history")
    .select("date")
    .eq("wca_uid", uid)
    .gt("date", lastAlert.created_at.split("T")[0]) // Compare with date part only
    .order("date")

  if (countError) {
    console.error(`Error counting trading days for cooldown: ${countError.message}`)
    return true // Assume in cooldown on error to be safe
  }

  const daysSinceAlert = tradingDays?.length || 0
  return daysSinceAlert < cooldownDays
}

// Insert a new alert
async function insertAlert(trigger: AlertTrigger, userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("wca_alerts").insert({
    wca_uid: trigger.uid,
    symbol: trigger.symbol,
    user_id: userId,
    type: trigger.rule.key,
    status: "triggered",
    message: trigger.message,
    threshold_value: trigger.thresholdValue,
    actual_value: trigger.actualValue,
    details: {
      ...trigger.context,
      symbol: trigger.symbol,
      rule_description: trigger.rule.description,
      timestamp: new Date().toISOString(),
    },
  })

  if (error) {
    throw new Error(`Failed to insert alert: ${error.message}`)
  }

  console.log(`[v0] Alert triggered for user ${userId}: ${trigger.message}`)
}

// Evaluate crossing rules (delta_to_quote, delta_to_sma)
function evaluateCrossingRule(rule: AlertRule, history: HistoryRow[]): boolean {
  if (!rule.crossing || !rule.metric || rule.thr === undefined || history.length < 2) {
    return false
  }

  const yesterday = history[history.length - 2]
  const today = history[history.length - 1]

  const yesterdayValue = yesterday[rule.metric]
  const todayValue = today[rule.metric]

  if (yesterdayValue === null || todayValue === null) {
    return false
  }

  // Trigger if yesterday > threshold && today <= threshold (crossing down)
  return yesterdayValue > rule.thr && todayValue <= rule.thr
}

// Evaluate drawdown rule
function evaluateDrawdownRule(chartData: ChartRow[]): boolean {
  if (chartData.length < 3) {
    return false
  }

  // Sort by date descending to get latest first
  const sorted = [...chartData].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const twoDaysAgo = sorted[2]

  if (!latest || !twoDaysAgo) {
    return false
  }

  // Trigger if latest_close <= twoDaysAgo_close * 0.90 (10% drop)
  return latest.close_quote <= twoDaysAgo.close_quote * 0.9
}

export async function evaluateAlerts(
  uid: string,
  symbol: string,
  context: Partial<AlertContext> = {},
  userId: string,
): Promise<void> {
  console.log(`[v0] Evaluating alerts for ${symbol} (${uid}) for user ${userId}`)

  try {
    // Get recent data
    const history = await getRecentHistory(uid)
    const chartData = await getRecentChart(uid)

    const triggers: AlertTrigger[] = []

    // Evaluate each rule
    for (const rule of ALERT_RULES) {
      let shouldTrigger = false
      let actualValue: number | undefined
      let thresholdValue: number | undefined
      const alertContext: AlertContext = { symbol, ...context }

      if (rule.crossing && rule.metric && rule.thr !== undefined) {
        // Crossing rule
        shouldTrigger = evaluateCrossingRule(rule, history)
        if (shouldTrigger && history.length > 0) {
          actualValue = history[history.length - 1][rule.metric] || undefined
          thresholdValue = rule.thr
        }
      } else if (rule.key === "drawdown_10pct_2d") {
        // Drawdown rule
        shouldTrigger = evaluateDrawdownRule(chartData)
        if (shouldTrigger && chartData.length >= 3) {
          const sorted = [...chartData].sort((a, b) => b.date.localeCompare(a.date))
          const latest = sorted[0]
          const twoDaysAgo = sorted[2]
          actualValue = (latest.close_quote - twoDaysAgo.close_quote) / twoDaysAgo.close_quote
          thresholdValue = -0.1 // -10%
          alertContext.latest_close = latest.close_quote
          alertContext.two_days_ago_close = twoDaysAgo.close_quote
        }
      }

      if (shouldTrigger) {
        // Check cooldown for this user
        const inCooldown = await isInCooldown(uid, rule.key, rule.cooldown, userId)
        if (inCooldown) {
          console.log(`[v0] Alert ${rule.key} for ${symbol} (user ${userId}) is in cooldown, skipping`)
          continue
        }

        const message = makeMessage(rule.key, alertContext)
        triggers.push({
          rule,
          symbol,
          uid,
          actualValue,
          thresholdValue,
          message,
          context: alertContext,
        })
      }
    }

    // Insert all triggered alerts for this user
    for (const trigger of triggers) {
      await insertAlert(trigger, userId)
    }

    if (triggers.length > 0) {
      console.log(`[v0] Triggered ${triggers.length} alerts for ${symbol} (user ${userId})`)
    }
  } catch (error) {
    console.error(`[v0] Error evaluating alerts for ${symbol} (user ${userId}):`, error)
  }
}
