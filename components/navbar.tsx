"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Calendar, Users, Settings, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"

export default function Navbar() {
  const pathname = usePathname()

  const navItems = [
    {
      name: "Listen",
      href: "/notes",
      icon: FileText,
    },
    {
      name: "Pray",
      href: "/prayer",
      icon: Heart,
    },
    {
      name: "Follow-up",
      href: "/followups",
      icon: Calendar,
    },
    {
      name: "Assign",
      href: "/assignments",
      icon: Users,
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold sm:inline-block">Together</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center transition-colors hover:text-shrub",
                  pathname === item.href ? "text-shrub font-semibold" : "text-foreground/60",
                )}
              >
                {typeof item.icon === "function" ? (
                  <div className="mr-2">
                    <item.icon />
                  </div>
                ) : (
                  <item.icon className={cn("mr-2 h-4 w-4", pathname === item.href ? "stroke-[2.5px]" : "")} />
                )}
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between md:hidden">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold">Together</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center">
            <ModeToggle />
          </nav>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
        <nav className="flex items-center justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center py-3 text-xs font-medium transition-colors hover:text-foreground/80",
                pathname === item.href ? "text-shrub font-semibold" : "text-foreground/60",
              )}
            >
              {typeof item.icon === "function" ? (
                <item.icon />
              ) : (
                <item.icon className={cn("h-5 w-5", pathname === item.href ? "stroke-[2.5px]" : "")} />
              )}
              <span>{item.name}</span>
            </Link>
          ))}
          <Link
            href="/settings"
            className={cn(
              "flex flex-1 flex-col items-center py-3 text-xs font-medium transition-colors hover:text-foreground/80",
              pathname === "/settings" ? "text-shrub font-semibold" : "text-foreground/60",
            )}
          >
            <Settings className={cn("h-5 w-5", pathname === "/settings" ? "stroke-[2.5px]" : "")} />
            <span>Settings</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

