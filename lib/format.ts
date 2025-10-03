export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n >= 0 ? "+" : ""
  return `${sign}${(n * 100).toFixed(2)}%`
}

export function formatNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}
