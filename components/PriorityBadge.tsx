import { cn } from "@/lib/utils"

type Priority = "None" | "High" | "Medium" | "Low"

interface PriorityBadgeProps {
  priority: Priority
  className?: string
}

const priorityStyles = {
  None: "bg-gray-100 text-gray-800 border-gray-200",
  High: "bg-red-100 text-red-800 border-red-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-green-100 text-green-800 border-green-200",
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        priorityStyles[priority],
        className,
      )}
    >
      {priority}
    </span>
  )
}
