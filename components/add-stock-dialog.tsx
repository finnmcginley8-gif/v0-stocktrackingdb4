"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"

export function AddStockDialog() {
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState("")
  const [targetPrice, setTargetPrice] = useState("")
  const [priority, setPriority] = useState("None")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
          priority,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({ type: "success", text: `Added ${data.stock.symbol}` })
        setSymbol("")
        setTargetPrice("")
        setPriority("None")

        // Close dialog after 1.5 seconds on success
        setTimeout(() => {
          setOpen(false)
          setMessage(null)
          // Refresh the page to show the new stock
          window.location.reload()
        }, 1500)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-7 px-3 py-1 bg-transparent">
          <Plus className="w-3 h-3 mr-1" />
          Add Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Add Stock</DialogTitle>
          <DialogDescription className="text-xs">
            Add a new stock to your watchlist with a target price
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="symbol" className="text-xs">
              Stock Symbol
            </Label>
            <Input
              id="symbol"
              type="text"
              placeholder="AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              disabled={isSubmitting}
              className="text-sm h-9"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="target_price" className="text-xs">
              Target Price
            </Label>
            <Input
              id="target_price"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="150.00"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              disabled={isSubmitting}
              className="text-sm h-9"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="priority" className="text-xs">
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None" className="text-sm">
                  None
                </SelectItem>
                <SelectItem value="High" className="text-sm">
                  High
                </SelectItem>
                <SelectItem value="Medium" className="text-sm">
                  Medium
                </SelectItem>
                <SelectItem value="Low" className="text-sm">
                  Low
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {message && (
            <div
              className={`text-xs p-2 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <Button type="submit" className="w-full text-sm h-9" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? "Saving..." : "Add Stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
