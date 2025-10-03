export function fmtPct(n: unknown) {
  if (n == null || !isFinite(Number(n))) return "—"
  const v = Number(n) * 100
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(2)}%`
}

export function fmtNum(n: unknown, digits = 2) {
  if (n == null || !isFinite(Number(n))) return "—"
  return Number(n).toFixed(digits)
}

export function makeMessage(
  ruleKey: string,
  c: {
    symbol?: string
    target_price?: number
    current_quote?: number
    sma200?: number
    delta_to_quote?: number
    delta_to_sma?: number
    latest_close?: number
    two_days_ago_close?: number
  },
) {
  const s = c.symbol ?? "This stock"
  const map: Record<string, (c: any) => string> = {
    dq_le_10pct: (x) =>
      `${s} is now within 10% of your target price. (Price ${fmtNum(x.current_quote)}, target ${fmtNum(x.target_price)}, gap ${fmtPct(x.delta_to_quote)}).`,
    dq_le_5pct: (x) =>
      `${s} is now within 5% of your target price. (Price ${fmtNum(x.current_quote)}, target ${fmtNum(x.target_price)}, gap ${fmtPct(x.delta_to_quote)}).`,
    dq_le_0pct: (x) =>
      `${s} has reached your target price. (Price ${fmtNum(x.current_quote)}, target ${fmtNum(x.target_price)}).`,
    dq_le_neg10pct: (x) =>
      `${s} is trading at least 10% below your target price. (Price ${fmtNum(x.current_quote)}, target ${fmtNum(x.target_price)}, gap ${fmtPct(x.delta_to_quote)}).`,

    dsma_le_0pct: (x) =>
      `${s} just crossed below its 200-day average. (Price ${fmtNum(x.current_quote)}, 200-day avg ${fmtNum(x.sma200)}, gap ${fmtPct(x.delta_to_sma)}).`,
    dsma_le_neg5pct: (x) =>
      `${s} is about 5% under its 200-day average. (Gap ${fmtPct(x.delta_to_sma)}; price ${fmtNum(x.current_quote)}, 200-day avg ${fmtNum(x.sma200)}).`,
    dsma_le_neg10pct: (x) =>
      `${s} is roughly 10% under its 200-day average. (Gap ${fmtPct(x.delta_to_sma)}; price ${fmtNum(x.current_quote)}, 200-day avg ${fmtNum(x.sma200)}).`,

    drawdown_10pct_2d: (x) =>
      `${s} fell ~10% in two trading days. (${fmtNum(x.two_days_ago_close)} → ${fmtNum(x.latest_close)}).`,
  }
  const fn = map[ruleKey]
  return fn ? fn(c) : `${s}: ${ruleKey.replaceAll("_", " ")}`
}
