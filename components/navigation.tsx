"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Eye, TrendingUp, Bell, Settings, PieChart, LogOut } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Watchlist", href: "/watchlist", icon: Eye },
  { name: "Charts", href: "/charts", icon: TrendingUp },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Portfolio", href: "/portfolio", icon: PieChart },
  { name: "Settings", href: "/settings", icon: Settings },
]

// Check if we're in dev/preview mode where auth is bypassed
const isDev = process.env.NODE_ENV === "development"
const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
const isVercelApp = typeof window !== "undefined" && window.location.hostname.includes("vercel.app")
const shouldBypassAuth = isDev || isPreview || isVercelApp

export function Navigation() {
  const pathname = usePathname()
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const activeIndex = navigation.findIndex((item) => item.href === pathname)
    const updateIndicator = () => {
      if (activeIndex !== -1 && navRefs.current[activeIndex] && containerRef.current) {
        const activeElement = navRefs.current[activeIndex]
        const container = containerRef.current
        if (activeElement && container) {
          const containerRect = container.getBoundingClientRect()
          const elementRect = activeElement.getBoundingClientRect()
          setIndicatorStyle({
            left: elementRect.left - containerRect.left,
            width: elementRect.width,
          })
        }
      }
    }

    updateIndicator()
    const timer = setTimeout(updateIndicator, 50)

    return () => clearTimeout(timer)
  }, [pathname])

  // Get user email if in production
  useEffect(() => {
    if (!shouldBypassAuth) {
      supabase.auth.getUser().then(({ data }) => {
        setUserEmail(data.user?.email || null)
      })
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <nav className="bg-background/80 backdrop-blur-md mb-4 mt-3">
      <div className="w-full px-3 sm:px-4">
        <div className="flex h-12 items-center justify-center">
          <div
            ref={containerRef}
            className="relative flex items-center bg-muted/50 rounded-lg p-1 w-full max-w-2xl border border-black"
          >
            <div
              className="absolute top-1 bottom-1 bg-background rounded-md shadow-sm transition-all duration-300 ease-out border border-black/20"
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
              }}
            />
            {navigation.map((item, index) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    navRefs.current[index] = el
                  }}
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-2 rounded-md transition-colors duration-200",
                    "flex-1 px-2 py-1.5 flex-col sm:flex-row sm:px-6",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm font-medium">{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* Logout button for production */}
          {!shouldBypassAuth && userEmail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="ml-2"
              title={`Logged in as ${userEmail}`}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
