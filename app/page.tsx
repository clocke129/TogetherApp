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
          A quick guide for managing your prayer requests and follow-ups.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Link href="/notes" className="flex items-center gap-2 underline hover:text-shrub">
                <FileText className="h-6 w-6 text-shrub" />
                <CardTitle>Note</CardTitle>
              </Link>
              <CardDescription>Quickly capture prayer details and follow-ups.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  <code>@Name</code> tags or creates a person. Text on the following line adds a prayer request for that person.
                </li>
                <li>
                  <code>#MMDD</code> (e.g., <code>#0315</code> for March 15th) creates a follow-up task for text on that line.
                </li>
                <li>
                  Preview pane shows automatic structuring live.
                </li>
              </ul>
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
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Assign people to prayer groups you create.</li>
                <li>Select which days to pray for each group.</li>
                <li>Click on groups or people to add, edit, or delete.</li>
              </ul>
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
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>See the specific people/requests assigned for you to pray for today based on your group assignments.</li>
                <li>Mark items as 'Prayed' to track your progress.</li>
                <li>Review your prayer history.</li>
              </ul>
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
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Track follow-up items created from notes (using <code>#MMDD</code>).</li>
                <li>View upcoming/overdue tasks and set dates.</li>
                <li>Mark tasks as complete when finished.</li>
              </ul>
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

