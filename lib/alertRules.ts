// Alert Rules Configuration
// Defines all alert rules with thresholds and cooldown periods

export interface AlertRule {
  key: string
  metric?: "delta_to_quote" | "delta_to_sma"
  thr?: number
  cooldown: number // Trading days
  crossing: boolean
  description: string
}

export const ALERT_RULES: readonly AlertRule[] = [
  // Delta to Quote crossing rules
  {
    key: "dq_le_10pct",
    metric: "delta_to_quote",
    thr: 0.1,
    cooldown: 10,
    crossing: true,
    description: "Stock crossed below +10% vs target price",
  },
  {
    key: "dq_le_5pct",
    metric: "delta_to_quote",
    thr: 0.05,
    cooldown: 10,
    crossing: true,
    description: "Stock crossed below +5% vs target price",
  },
  {
    key: "dq_le_0pct",
    metric: "delta_to_quote",
    thr: 0.0,
    cooldown: 5,
    crossing: true,
    description: "Stock crossed below target price",
  },
  {
    key: "dq_le_neg10pct",
    metric: "delta_to_quote",
    thr: -0.1,
    cooldown: 5,
    crossing: true,
    description: "Stock crossed below -10% vs target price",
  },

  // Delta to SMA crossing rules
  {
    key: "dsma_le_0pct",
    metric: "delta_to_sma",
    thr: 0.0,
    cooldown: 10,
    crossing: true,
    description: "Stock crossed below SMA200",
  },
  {
    key: "dsma_le_neg5pct",
    metric: "delta_to_sma",
    thr: -0.05,
    cooldown: 10,
    crossing: true,
    description: "Stock crossed below -5% vs SMA200",
  },
  {
    key: "dsma_le_neg10pct",
    metric: "delta_to_sma",
    thr: -0.1,
    cooldown: 10,
    crossing: true,
    description: "Stock crossed below -10% vs SMA200",
  },

  // Drawdown rule
  {
    key: "drawdown_10pct_2d",
    cooldown: 5,
    crossing: false,
    description: "Stock dropped 10% or more in 2 days",
  },
] as const

export type AlertRuleKey = (typeof ALERT_RULES)[number]["key"]

// Helper function to get rule by key
export function getAlertRule(key: string): AlertRule | undefined {
  return ALERT_RULES.find((rule) => rule.key === key)
}

// Helper function to format alert message
export function formatAlertMessage(
  rule: AlertRule,
  symbol: string,
  actualValue?: number,
  thresholdValue?: number,
): string {
  const baseMessage = `${symbol}: ${rule.description}`

  if (actualValue !== undefined && thresholdValue !== undefined) {
    if (rule.metric) {
      const actualPct = (actualValue * 100).toFixed(1)
      const thresholdPct = (thresholdValue * 100).toFixed(1)
      return `${baseMessage} (${actualPct}% vs ${thresholdPct}% threshold)`
    }
  }

  return baseMessage
}
