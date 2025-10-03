export const dynamic = "force-dynamic"
export const revalidate = 0

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const uid = searchParams.get("uid")
    const range = searchParams.get("range") || "2Y"

    if (!uid) {
      return NextResponse.json({ error: "uid parameter is required" }, { status: 400 })
    }

    const timestamp = Date.now()
    console.log(`[v0] Chart API for ${uid}: fetching ${range} data at ${timestamp}`)

    const now = new Date()
    const cutoffDate = new Date()

    switch (range) {
      case "1M":
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case "3M":
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case "6M":
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case "1Y":
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      case "2Y":
        cutoffDate.setFullYear(now.getFullYear() - 2)
        break
      case "5Y":
        cutoffDate.setFullYear(now.getFullYear() - 5)
        break
      case "10Y":
        cutoffDate.setFullYear(now.getFullYear() - 10)
        break
      default:
        cutoffDate.setFullYear(now.getFullYear() - 2)
    }

    const cutoffDateStr = cutoffDate.toISOString().split("T")[0]
    console.log(`[v0] Chart API for ${uid}: filtering data from ${cutoffDateStr}`)

    const { data: items, error } = await supabaseAdmin
      .from("wca_chart_5y")
      .select("date, close_quote")
      .eq("wca_uid", uid)
      .gte("date", cutoffDateStr)
      .order("date", { ascending: false })
      .limit(2000)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[v0] Chart API for ${uid}: raw query returned ${items?.length || 0} records`)

    if (items && items.length > 0) {
      const sortedItems = items.reverse()
      console.log(`[v0] Chart API for ${uid}: after sorting, first date = ${sortedItems[0].date}`)
      console.log(`[v0] Chart API for ${uid}: after sorting, last date = ${sortedItems[sortedItems.length - 1].date}`)

      const lastDate = new Date(sortedItems[sortedItems.length - 1].date)
      const today = new Date()
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`[v0] Chart API for ${uid}: last candle is ${daysDiff} days old`)
    }

    const processedItems = (items || []).map((item) => ({
      date: String(item.date),
      close_quote: Number(item.close_quote),
    }))

    processedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    console.log(`[v0] Chart API for ${uid}: returning ${processedItems.length} candles for ${range}`)
    if (processedItems.length > 0) {
      console.log(`[v0] Chart API for ${uid}: first date = ${processedItems[0].date}`)
      console.log(`[v0] Chart API for ${uid}: last date = ${processedItems[processedItems.length - 1].date}`)
    }

    const response = NextResponse.json({
      uid,
      range,
      items: processedItems,
      count: processedItems.length,
      firstDate: processedItems[0]?.date ?? null,
      lastDate: processedItems[processedItems.length - 1]?.date ?? null,
      timestamp,
    })

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")

    return response
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
