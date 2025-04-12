'use client' // Needs to be a client component for hooks and interaction

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation" // Add useRouter back
import { FileText, Calendar, Users, Settings, Heart, LogOut, User as UserIcon, LogIn } from "lucide-react" // Add icons back
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/context/AuthContext" // Import useAuth
import { auth } from "@/lib/firebaseConfig" // Import auth
import { signOut } from "firebase/auth" // Import signOut
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
import type { LucideIcon } from "lucide-react";

// Define an interface for nav items
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter() // Add router hook back
  const { user, loading } = useAuth() // Get user and loading state

  // Apply the type to the array
  const navItems: NavItem[] = [
    {
      name: "Note",
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
  ]

  // Re-add handleLogout function
  const handleLogout = async () => {
    if (!auth) {
      console.error("Logout failed: Firebase Auth not initialized.");
      return; // Prevent logout if auth isn't ready
    }
    try {
      console.log("Logging out...");
      await signOut(auth);
      console.log("Logout successful, redirecting...");
      router.push('/'); // Optional: redirect
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // Re-add renderUserAuth function
  const renderUserAuth = () => {
    // Show loading indicator
    if (loading) {
      return <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>;
    }

    // Show User Dropdown if logged in
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
                <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
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
    }
    // Show Login button if logged out
    else {
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
        </nav>
      </div>
    </header>
  )
}

