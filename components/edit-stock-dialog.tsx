"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import Image from "next/image"

interface Stock {
  symbol: string
  uid: string
  target_price: number
  current_quote: number | null
  sma200: number | null
  delta_to_quote: number | null
  delta_to_sma: number | null
  priority: string
  logo_url?: string | null // Added logo_url field
}

interface EditStockDialogProps {
  stock: Stock | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditStockDialog({ stock, open, onOpenChange }: EditStockDialogProps) {
  const [targetPrice, setTargetPrice] = useState("")
  const [priority, setPriority] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Update form when stock changes
  useEffect(() => {
    if (stock) {
      setTargetPrice("")
      setPriority(stock.priority || "None")
      setMessage(null)
    }
  }, [stock])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stock) return

    const price = Number(targetPrice)

    if (!price || price <= 0) {
      setMessage({ type: "error", text: "Target price must be greater than 0" })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/wca_main", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: stock.uid,
          target_price: price,
          priority,
        }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Stock updated successfully" })

        // Close dialog and refresh after 1 second
        setTimeout(() => {
          onOpenChange(false)
          setMessage(null)
          window.location.reload()
        }, 1000)
      } else {
        const errorData = await response.json()
        setMessage({ type: "error", text: errorData.error || "Failed to update stock" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!stock) return

    if (!confirm(`Are you sure you want to remove ${stock.symbol} from your watchlist?`)) {
      return
    }

    setIsDeleting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/wca_main", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: stock.uid,
        }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Stock removed successfully" })

        // Close dialog and refresh after 1 second
        setTimeout(() => {
          onOpenChange(false)
          setMessage(null)
          window.location.reload()
        }, 1000)
      } else {
        const errorData = await response.json()
        setMessage({ type: "error", text: errorData.error || "Failed to remove stock" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error occurred" })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!stock) return null

  const isFormValid = Number(targetPrice) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            <div className="flex items-center gap-2">
              {stock.logo_url ? (
                <Image
                  src={stock.logo_url || "/placeholder.svg"}
                  alt={`${stock.symbol} logo`}
                  width={24}
                  height={24}
                  className="rounded-sm flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-200 rounded-sm flex-shrink-0" />
              )}
              <span>Edit {stock.symbol}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update target price and priority or remove from watchlist
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-3">
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
              disabled={isSubmitting || isDeleting}
              className="text-sm h-9 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="priority" className="text-xs">
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority} disabled={isSubmitting || isDeleting}>
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

          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="text-sm h-9"
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {isDeleting ? "Removing..." : "Remove"}
            </Button>
            <Button type="submit" className="flex-1 text-sm h-9" disabled={!isFormValid || isSubmitting || isDeleting}>
              {isSubmitting ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
