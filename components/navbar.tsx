"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, Calendar, Users, Settings, Heart, LogOut, User as UserIcon, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/context/AuthContext"
import { auth } from "@/lib/firebaseConfig"
import { signOut } from "firebase/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { LucideIcon } from "lucide-react"

// Define an interface for nav items
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  // Apply the type to the array
  const navItems: NavItem[] = [
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const renderUserAuth = () => {
    if (loading) {
      return <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>;
    }

    if (user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                <AvatarFallback>{user.email ? user.email[0].toUpperCase() : <UserIcon size={16} />}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.displayName || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      return (
        <Link href="/login">
          <Button variant="ghost">
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </Button>
        </Link>
      );
    }
  };

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
                <item.icon className={cn("mr-2 h-4 w-4", pathname === item.href ? "stroke-[2.5px]" : "")} />
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
          {renderUserAuth()}
          <ModeToggle />
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
              <item.icon className={cn("h-5 w-5", pathname === item.href ? "stroke-[2.5px]" : "")} />
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

