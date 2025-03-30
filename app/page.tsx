import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Heart, FileText, Calendar, Users } from "lucide-react"

export default function Home() {
  return (
    <div className="mobile-container">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Together App</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A prayer management application for tracking prayer requests, organizing groups, and managing follow-ups.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <FileText className="h-6 w-6 text-shrub mb-2" />
            <CardTitle>Intuitive Note-taking</CardTitle>
            <CardDescription>Capture prayer requests with special syntax</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use @PersonName to create people and #MMDD to set follow-up dates. Our smart parser automatically
              structures your notes.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/notes">Listen</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Heart className="h-6 w-6 text-shrub mb-2" />
            <CardTitle>Prayer Tracking</CardTitle>
            <CardDescription>Track prayer requests and mark them as prayed for</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Organize prayer requests by person and group. Mark prayers as complete and track your prayer history.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/prayer">Pray</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Calendar className="h-6 w-6 text-shrub mb-2" />
            <CardTitle>Follow-up Management</CardTitle>
            <CardDescription>Never forget to follow up on prayer requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set follow-up dates and get reminders. Track completed and upcoming follow-ups in one place.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/followups">Follow-up</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Users className="h-6 w-6 text-shrub mb-2" />
            <CardTitle>Group Management</CardTitle>
            <CardDescription>Organize people into prayer groups</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create groups and assign prayer days. Configure how many people to pray for each day.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/assignments">Assign</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

