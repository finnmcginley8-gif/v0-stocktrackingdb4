"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AddStockPage() {
  const [symbol, setSymbol] = useState("")
  const [targetPrice, setTargetPrice] = useState("")
  const [priority, setPriority] = useState("None") // Added priority state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validation
    const trimmedSymbol = symbol.trim()
    const price = Number(targetPrice)

    if (!trimmedSymbol) {
      setMessage({ type: "error", text: "Symbol is required" })
      return
    }

    if (!price || price <= 0) {
      setMessage({ type: "error", text: "Target price must be greater than 0" })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/wca_main", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: trimmedSymbol,
          target_price: price,
          priority, // Include priority in request body
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({ type: "success", text: `Added ${data.stock.uid}` })
        setSymbol("")
        setTargetPrice("")
        setPriority("None") // Reset priority to default
      } else {
        const errorData = await response.json()
        setMessage({ type: "error", text: errorData.error || "Failed to add stock" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = symbol.trim() && Number(targetPrice) > 0

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add Stock</CardTitle>
          <CardDescription>Add a new stock to your watchlist with a target price</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="symbol">Stock Symbol</Label>
              <Input
                id="symbol"
                type="text"
                placeholder="AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="target_price">Target Price</Label>
              <Input
                id="target_price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="150.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {message && (
              <div
                className={`text-sm p-3 rounded-md ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                    : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                }`}
              >
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? "Saving..." : "Add Stock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
