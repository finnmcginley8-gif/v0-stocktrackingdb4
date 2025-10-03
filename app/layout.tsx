import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Navigation } from "@/components/navigation"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Stock Tracker",
  description: "Track your stock portfolio with real-time data",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <Navigation />
        </Suspense>
        {children}
        <footer className="fixed bottom-0 right-0 p-2 text-xs text-muted-foreground">
          <a href="https://elbstream.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Logos provided by Elbstream
          </a>
        </footer>
      </body>
    </html>
  )
}
