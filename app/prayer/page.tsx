"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Heart,
  Calendar,
  Clock,
  List,
  Check,
  ArrowLeft,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Types
type Person = {
  id: string
  name: string
  prayerRequests: PrayerRequest[]
  followUps: FollowUp[]
  lastPrayedFor?: Date
  group?: string
}

type PrayerRequest = {
  id: string
  content: string
  createdAt: Date
  prayedForDates?: Date[]
}

type FollowUp = {
  id: string
  content: string
  dueDate: Date
  completed: boolean
}

export default function PrayerPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [prayedFor, setPrayedFor] = useState<Record<string, boolean>>({})
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [showAllPrayerRequests, setShowAllPrayerRequests] = useState(false)
  const [showAddPrayerRequest, setShowAddPrayerRequest] = useState(false)
  const [viewAllRequestsScreen, setViewAllRequestsScreen] = useState(false)
  const [newPrayerRequest, setNewPrayerRequest] = useState({
    content: "",
    personId: "",
  })
  const [followUps, setFollowUps] = useState<Record<string, boolean>>({})

  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
  }

  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
  }

  // Toggle expanded state for a person
  const toggleExpandPerson = (personId: string) => {
    setExpandedPersonId(expandedPersonId === personId ? null : personId)
  }

  // Mark a person as prayed for
  const markAsPrayedFor = (personId: string) => {
    setPrayedFor((prev) => ({
      ...prev,
      [personId]: !prev[personId],
    }))
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Format date with time for display
  const formatDateWithTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Get day name
  const getDayName = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "long" })
  }

  // Get most recent prayer request
  const getMostRecentPrayerRequest = (person: Person) => {
    if (person.prayerRequests.length === 0) return null

    return person.prayerRequests.reduce((mostRecent, request) => {
      return request.createdAt > mostRecent.createdAt ? request : mostRecent
    }, person.prayerRequests[0])
  }

  // Get past prayer requests (excluding the most recent)
  const getPastPrayerRequests = (person: Person) => {
    if (person.prayerRequests.length <= 1) return []

    const mostRecent = getMostRecentPrayerRequest(person)
    if (!mostRecent) return []

    return person.prayerRequests
      .filter((request) => request.id !== mostRecent.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Calculate times prayed since most recent prayer request
  const getTimesPrayedSinceLastRequest = (person: Person) => {
    const mostRecentRequest = getMostRecentPrayerRequest(person)
    if (!mostRecentRequest) return 0

    let count = 0
    person.prayerRequests.forEach((request) => {
      if (request.prayedForDates) {
        count += request.prayedForDates.filter((date) => date > mostRecentRequest.createdAt).length
      }
    })

    return count
  }

  // Open all prayer requests dialog
  const openAllPrayerRequests = (person: Person) => {
    setSelectedPerson(person)
    setShowAllPrayerRequests(true)
  }

  // Open view all prayer requests screen
  const openViewAllRequestsScreen = (person: Person) => {
    setSelectedPerson(person)
    setViewAllRequestsScreen(true)
  }

  // Add a new prayer request
  const handleAddPrayerRequest = () => {
    if (!newPrayerRequest.content || !newPrayerRequest.personId) return

    // In a real app, this would add to the database
    console.log("Adding prayer request:", newPrayerRequest)

    // Reset form and close dialog
    setNewPrayerRequest({
      content: "",
      personId: "",
    })
    setShowAddPrayerRequest(false)
  }

  // Toggle follow-up completion
  const toggleFollowUpCompletion = (followUpId: string) => {
    setFollowUps((prev) => ({
      ...prev,
      [followUpId]: !prev[followUpId],
    }))
  }

  // Get completed prayers (those that have been prayed for)
  const getCompletedPrayers = () => {
    return people.filter((person) => prayedFor[person.id])
  }

  // Get active prayers (those that haven't been prayed for today)
  const getActivePrayers = () => {
    return people.filter((person) => !prayedFor[person.id])
  }

  // Render the main prayer screen
  const renderMainPrayerScreen = () => {
    return (
      <>
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div>
            <h1 className="page-title">Prayer List</h1>
            <p className="page-description">Track and manage your prayer requests</p>
          </div>
          <Dialog open={showAddPrayerRequest} onOpenChange={setShowAddPrayerRequest}>
            <DialogTrigger asChild>
              <Button className="bg-shrub hover:bg-shrub/90">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Prayer Request</DialogTitle>
                <DialogDescription>Create a new prayer request for someone</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="person">Person</Label>
                  <Select
                    value={newPrayerRequest.personId}
                    onValueChange={(value) => setNewPrayerRequest({ ...newPrayerRequest, personId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="content">Prayer Request</Label>
                  <Textarea
                    id="content"
                    value={newPrayerRequest.content}
                    onChange={(e) => setNewPrayerRequest({ ...newPrayerRequest, content: e.target.value })}
                    placeholder="What would you like to pray for?"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddPrayerRequest(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPrayerRequest} className="bg-shrub hover:bg-shrub/90">
                  Add Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center">
            <h2 className="text-xl font-bold">{getDayName(currentDate)}</h2>
            <p className="text-sm text-muted-foreground">{formatDate(currentDate)}</p>
          </div>

          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="pray" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pray">Pray</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="pray" className="space-y-4">
            {getActivePrayers().length === 0 ? (
              <div className="text-center py-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto text-muted-foreground mb-4 h-12 w-12"
                >
                  <path d="M12 22V8" />
                  <path d="M8 12V8a4 4 0 0 1 8 0v4" />
                  <path d="M17 13.5V8a4 4 0 0 0-8 0v5.5" />
                  <path d="M12 2v6" />
                </svg>
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground mt-1">You've prayed for everyone today</p>
              </div>
            ) : (
              getActivePrayers().map((person) => {
                const mostRecentRequest = getMostRecentPrayerRequest(person)
                const timesPrayed = getTimesPrayedSinceLastRequest(person)

                return (
                  <Card key={person.id} className="transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{person.name}</CardTitle>
                          {person.group && (
                            <Badge variant="outline" className="mt-1">
                              {person.group}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 bg-shrub hover:bg-shrub/90 text-white"
                          onClick={() => markAsPrayedFor(person.id)}
                        >
                          <Heart className="h-4 w-4" />
                          Pray
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="pb-2">
                      {mostRecentRequest && (
                        <div className="space-y-1">
                          <p className="text-sm">{mostRecentRequest.content}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Added {formatDate(mostRecentRequest.createdAt)}
                            </span>
                            {timesPrayed > 0 && (
                              <span className="flex items-center">
                                <Heart className="h-3 w-3 mr-1" />
                                {timesPrayed}
                              </span>
                            )}
                            {person.lastPrayedFor && (
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Last prayed: {formatDate(person.lastPrayedFor)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex justify-between pt-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground"
                        onClick={() => toggleExpandPerson(person.id)}
                      >
                        {expandedPersonId === person.id ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show more
                          </>
                        )}
                      </Button>
                    </CardFooter>

                    {expandedPersonId === person.id && (
                      <div className="px-6 pb-4 space-y-4">
                        {/* Past Prayer Requests Section */}
                        {getPastPrayerRequests(person).length > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-medium">Prayer Requests:</h4>
                              {getPastPrayerRequests(person).length > 3 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs flex items-center gap-1 text-shrub"
                                  onClick={() => openViewAllRequestsScreen(person)}
                                >
                                  <List className="h-3 w-3" />
                                  View All
                                </Button>
                              )}
                            </div>
                            <div className="space-y-1 pl-4 border-l-2 border-primary/20">
                              {getPastPrayerRequests(person)
                                .slice(0, 3)
                                .map((request) => (
                                  <div key={request.id} className="text-sm flex justify-between">
                                    <p>{request.content}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Added {formatDate(request.createdAt)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Follow-ups Section */}
                        {person.followUps.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Follow-ups:</h4>
                            <div className="space-y-2 pl-4 border-l-2 border-destructive/20">
                              {person.followUps.map((followUp) => {
                                const isCompleted = followUps[followUp.id] || followUp.completed

                                return (
                                  <div key={followUp.id} className="flex items-start gap-2">
                                    <div className="pt-0.5">
                                      <Checkbox
                                        id={followUp.id}
                                        checked={isCompleted}
                                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                                      />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                      <button
                                        className={cn(
                                          "text-sm font-medium text-left w-full",
                                          isCompleted && "line-through text-muted-foreground",
                                        )}
                                        onClick={() => {
                                          // In a real app, this would navigate to the follow-up screen
                                          console.log("Navigate to follow-up screen for:", followUp.content)
                                        }}
                                      >
                                        {followUp.content}
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                          {formatDate(followUp.dueDate)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {getCompletedPrayers().length === 0 ? (
              <div className="text-center py-12">
                <Check className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No completed prayers</h3>
                <p className="text-muted-foreground mt-1">You haven't prayed for anyone today yet</p>
              </div>
            ) : (
              getCompletedPrayers().map((person) => {
                const mostRecentRequest = getMostRecentPrayerRequest(person)
                const timesPrayed = getTimesPrayedSinceLastRequest(person)

                return (
                  <Card key={person.id} className="transition-all bg-muted/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{person.name}</CardTitle>
                          {person.group && (
                            <Badge variant="outline" className="mt-1">
                              {person.group}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={() => markAsPrayedFor(person.id)}
                        >
                          <Check className="h-4 w-4" />
                          Prayed
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="pb-2">
                      {mostRecentRequest && (
                        <div className="space-y-1">
                          <p className="text-sm">{mostRecentRequest.content}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Added {formatDate(mostRecentRequest.createdAt)}
                            </span>
                            {timesPrayed > 0 && (
                              <span className="flex items-center">
                                <Heart className="h-3 w-3 mr-1" />
                                {timesPrayed}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex justify-between pt-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground"
                        onClick={() => openViewAllRequestsScreen(person)}
                      >
                        <List className="h-4 w-4" />
                        View all requests
                      </Button>

                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Prayed today
                      </span>
                    </CardFooter>
                  </Card>
                )
              })
            )}
          </TabsContent>
        </Tabs>

        {/* All Prayer Requests Dialog */}
        <Dialog open={showAllPrayerRequests} onOpenChange={setShowAllPrayerRequests}>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>All Prayer Requests</DialogTitle>
              <DialogDescription>
                {selectedPerson?.name} - {selectedPerson?.group}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedPerson?.prayerRequests.map((request) => (
                <div key={request.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium">{request.content}</p>
                    <Badge variant="outline" className="text-xs">
                      {formatDate(request.createdAt)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {request.prayedForDates && request.prayedForDates.length > 0 ? (
                      <div>
                        <p>Prayed for {request.prayedForDates.length} times</p>
                        <p>Last prayed: {formatDate(request.prayedForDates[request.prayedForDates.length - 1])}</p>
                      </div>
                    ) : (
                      <p>Not yet prayed for</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Render the "View All Prayer Requests" screen
  const renderViewAllRequestsScreen = () => {
    if (!selectedPerson) return null

    const sortedRequests = [...selectedPerson.prayerRequests].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setViewAllRequestsScreen(false)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-bold">{selectedPerson.name}</h1>
          <Badge variant="outline">{selectedPerson.group}</Badge>
        </div>

        <h2 className="text-lg font-semibold mb-2">All Prayer Requests</h2>

        {sortedRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No prayer requests yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="py-4">
                  <div className="space-y-2">
                    <p className="font-medium">{request.content}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Added {formatDateWithTime(request.createdAt)}
                      </span>
                      {request.prayedForDates && request.prayedForDates.length > 0 && (
                        <span className="flex items-center">
                          <Heart className="h-3 w-3 mr-1" />
                          Prayed for {request.prayedForDates.length} times
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mobile-container pb-16 md:pb-6">
      {viewAllRequestsScreen ? renderViewAllRequestsScreen() : renderMainPrayerScreen()}
    </div>
  )
}

