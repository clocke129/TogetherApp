'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Heart, Users, ArrowRight } from "lucide-react"

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="mobile-container">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Together</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Simple, systematic prayer management
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Heart className="h-8 w-8 text-shrub" />
                <div>
                  <CardTitle className="text-2xl">Today</CardTitle>
                  <CardDescription>Your daily prayer list</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground mb-4">
                Focus on who you're praying for today. Track your progress and build consistent prayer habits.
              </p>
              <Link href="/prayer">
                <Button className="w-full gap-2">
                  Go to Today
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-shrub" />
                <div>
                  <CardTitle className="text-2xl">People</CardTitle>
                  <CardDescription>Manage your prayer groups</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground mb-4">
                Organize people into groups and set prayer schedules. Everyone you add appears automatically.
              </p>
              <Link href="/assignments">
                <Button variant="outline" className="w-full gap-2">
                  Go to People
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Getting Started</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><strong>1. Add people</strong> - Start by adding people to your Everyone group</li>
            <li><strong>2. Create groups</strong> - Organize people by family, church, friends, etc.</li>
            <li><strong>3. Set schedules</strong> - Choose which days to pray for each group</li>
            <li><strong>4. Pray daily</strong> - Your Today screen shows who to pray for each day</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

