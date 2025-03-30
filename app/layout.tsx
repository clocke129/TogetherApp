import type React from "react"
import type { Metadata } from "next/types"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
// Remove this import
// import { MobileFAB } from "@/components/mobile-fab"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Together App",
  description: "Prayer management application",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <div className="h-16 md:hidden"></div> {/* Spacer for mobile navigation */}
            {/* Remove the MobileFAB component */}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'