'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Heart, FileText, Calendar, Users, Lightbulb } from "lucide-react"

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="mobile-container">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Together!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Your guide to managing prayer requests, groups, and follow-ups effectively.
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <Link href="/notes" className="flex items-center gap-2 underline hover:text-shrub">
                <FileText className="h-6 w-6 text-shrub" />
                <CardTitle>Note</CardTitle>
              </Link>
              <CardDescription>Quickly capture prayer details and follow-ups.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use `@Name` to tag someone (or create a new person if they don't exist) and add their prayer
                requests. Use `#MMDD` (e.g., `#0315` for March 15th) for follow-up dates/tasks. Check the preview pane to see how your
                notes are automatically structured.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Link href="/assignments" className="flex items-center gap-2 underline hover:text-shrub">
                <Users className="h-6 w-6 text-shrub" />
                <CardTitle>Assign</CardTitle>
              </Link>
              <CardDescription>Organize people into groups and set prayer schedules.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Assign people to prayer groups you create. Then, select which days each group should pray. This is also
                your central hub for adding, editing, or deleting people and groups.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Link href="/prayer" className="flex items-center gap-2 underline hover:text-shrub">
                <Heart className="h-6 w-6 text-shrub" />
                <CardTitle>Pray</CardTitle>
              </Link>
              <CardDescription>View your daily prayer list and track completion.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                See the specific people/requests assigned for you to pray for today based on your group assignments.
                Mark items as 'Prayed' to track your progress and review your prayer history.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Link href="/followups" className="flex items-center gap-2 underline hover:text-shrub">
                <Calendar className="h-6 w-6 text-shrub" />
                <CardTitle>Follow-up</CardTitle>
              </Link>
              <CardDescription>Manage upcoming and completed follow-up tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track follow-up items created from your notes (using `#MMDD`). View upcoming or overdue tasks, set
                dates if needed, and mark them as complete when finished.
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="mt-6 flex justify-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 text-shrub flex-shrink-0" />
          <span>(Tip: Click the "Together" logo in the top bar anytime to return here)</span>
        </p>
      </div>
    </div>
  )
}

