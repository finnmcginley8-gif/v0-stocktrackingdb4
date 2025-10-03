"use client"

import { cn } from "@/lib/utils"

type PriorityValue = "All" | "High" | "Medium" | "Low"

interface PriorityPillsProps {
  value: PriorityValue
  onChange: (value: PriorityValue) => void
}

const priorities: { value: PriorityValue; label: string }[] = [
  { value: "All", label: "All" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
]

export function PriorityPills({ value, onChange }: PriorityPillsProps) {
  return (
    <div
      role="tablist"
      className="flex w-full h-7 rounded border border-border overflow-hidden"
      aria-label="Filter stocks by priority"
    >
      {priorities.map((priority, index) => (
        <button
          key={priority.value}
          role="tab"
          aria-selected={value === priority.value}
          onClick={() => onChange(priority.value)}
          className={cn(
            "flex-1 px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap relative",
            "focus:outline-none",
            value === priority.value
              ? "bg-muted text-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground",
            index < priorities.length - 1 &&
              "after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:h-1/2 after:w-px after:bg-border",
          )}
        >
          {priority.label}
        </button>
      ))}
    </div>
  )
}
