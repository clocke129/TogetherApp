'use client' // Needs to be a client component for hooks and interaction

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation" // Add useRouter back
import { Calendar, Users, Heart, LogOut, User as UserIcon, LogIn, Mail, RotateCcw } from "lucide-react"
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
import React, { useEffect, useState } from "react"; // Import useEffect
import { EmailPreferencesDialog } from "@/components/email-preferences-dialog"
import { useDemoData } from "@/context/DemoDataContext"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  const { resetAccount } = useDemoData()
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // --- Add this useEffect Hook --- 
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('SW registered manually: ', registration);
        })
        .catch(registrationError => {
          console.error('SW registration failed manually: ', registrationError);
        });
    } else if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported in this browser.');
    } else {
      console.log('Service Worker registration skipped in development.');
    }
  }, []); // Run only once on component mount
  // --- End of useEffect Hook ---

  // Apply the type to the array
  const navItems: NavItem[] = [
    {
      name: "Today",
      href: "/prayer",
      icon: Heart,
    },
    {
      name: "Follow-ups",
      href: "/followups",
      icon: Calendar,
    },
    {
      name: "Groups",
      href: "/assignments",
      icon: Users,
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

  const handleResetAccount = async () => {
    setIsResetting(true)
    await resetAccount()
    window.location.reload()
  }

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
            <DropdownMenuItem onClick={() => setResetDialogOpen(true)} className="cursor-pointer">
              <RotateCcw className="mr-2 h-4 w-4" />
              <span>Reset account</span>
            </DropdownMenuItem>
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
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEmailDialogOpen(true)}
              aria-label="Email digest settings"
            >
              <Mail className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          )}
          <ModeToggle />
        </div>
        {user && (
          <EmailPreferencesDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} />
        )}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all your people, groups, and prayer history, and restore the demo data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAccount} disabled={isResetting}>
                {isResetting ? 'Resetting...' : 'Reset account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

