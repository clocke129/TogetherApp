"use client"

import { useState, useEffect } from "react"
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

// Firestore and Auth Imports
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore'
import type { Person, Group } from '@/lib/types' // Import shared types

// Types
// type Person = {
//   id: string
//   name: string
//   prayerRequests: PrayerRequest[]
//   followUps: FollowUp[]
//   lastPrayedFor?: Date
//   group?: string
// }

// type PrayerRequest = {
//   id: string
//   content: string
//   createdAt: Date
//   prayedForDates?: Date[]
// }

// type FollowUp = {
//   id: string
//   content: string
//   dueDate: Date
//   completed: boolean
// }

export default function PrayerPage() {
  const { user, loading: authLoading } = useAuth(); // Auth hook
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)

  // State for fetched data
  const [allUserGroups, setAllUserGroups] = useState<Group[]>([])
  const [allUserPeople, setAllUserPeople] = useState<Person[]>([])

  // State for today's prayer list derived from fetched data
  const [todaysPrayerList, setTodaysPrayerList] = useState<Person[]>([])

  // Loading and error states
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
    setExpandedPersonId(null) // Collapse items on date change
  }

  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
    setExpandedPersonId(null) // Collapse items on date change
  }

  // Toggle expanded state for a person
  const toggleExpandPerson = (personId: string) => {
    setExpandedPersonId(expandedPersonId === personId ? null : personId)
  }

  // Mark a person as prayed for - TODO: Implement with Firestore update (e.g., update lastPrayedFor)
  const markAsPrayedFor = (personId: string) => {
    console.log(`Marked person ${personId} as prayed for (needs Firestore implementation)`)
    // Needs Firestore update logic
    // Optimistically update UI? (e.g., move from active to completed tab)
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

  // Open all prayer requests dialog - Adapt later
  const openAllPrayerRequests = (person: Person) => {
    // setSelectedPerson(person)
    // setShowAllPrayerRequests(true)
    console.log("Open all requests for:", person.name)
  }

  // Open view all prayer requests screen - Adapt later
  const openViewAllRequestsScreen = (person: Person) => {
    // setSelectedPerson(person)
    // setViewAllRequestsScreen(true)
    console.log("View all requests screen for:", person.name)
  }

  // Add a new prayer request - Adapt later
  const handleAddPrayerRequest = () => {
    // if (!newPrayerRequest.content || !newPrayerRequest.personId) return

    // In a real app, this would add to the database
    // console.log("Adding prayer request:", newPrayerRequest)

    // Reset form and close dialog
    // setNewPrayerRequest({ content: "", personId: "" })
    // setShowAddPrayerRequest(false)
    console.log("Add prayer request clicked (needs implementation)")
  }

  // Toggle follow-up completion - Handled on Followups page
  // const toggleFollowUpCompletion = (followUpId: string) => { ... };

  // Get completed prayers - Placeholder, needs Firestore logic later
  const getCompletedPrayers = (): Person[] => {
    // This needs logic based on how we track completion (e.g., lastPrayedFor date)
    return []
  }

  // Get active prayers - Returns the list fetched for today
  const getActivePrayers = () => {
    // TODO: This should eventually filter out people already marked as prayed for *today*
    return todaysPrayerList
  }

  // Fetch groups and people, then determine today's prayer list
  useEffect(() => {
    if (!authLoading && user) {
      const fetchDataAndDetermineList = async () => {
        setLoadingData(true)
        setError(null)
        console.log("Fetching prayer data for user:", user.uid)

        try {
          const userId = user.uid
          const currentDayIndex = currentDate.getDay() // 0 for Sunday, 1 for Monday, etc.
          console.log(`[Prayer Debug] Current Date: ${currentDate.toISOString()}, Day Index: ${currentDayIndex} (${getDayName(currentDate)})`)

          // 1. Fetch all groups created by the user
          const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId))
          const groupsSnapshot = await getDocs(groupsQuery)
          const groupsData = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group))
          setAllUserGroups(groupsData)
          console.log("[Prayer Debug] Fetched Groups:", JSON.stringify(groupsData, null, 2))

          // 2. Fetch all people created by the user
          const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId))
          const peopleSnapshot = await getDocs(peopleQuery)
          const peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person))
          setAllUserPeople(peopleData)
          console.log("[Prayer Debug] Fetched People:", JSON.stringify(peopleData, null, 2))

          // 3. Identify active groups for today
          const activeGroups = groupsData.filter(group =>
            group.prayerDays?.includes(currentDayIndex)
          )
          console.log(`[Prayer Debug] Filtering for day index: ${currentDayIndex}`)
          console.log("[Prayer Debug] Active groups for today:", JSON.stringify(activeGroups, null, 2))

          // 4. Get all personIds from active groups
          let personIdsToPrayFor = new Set<string>()
          activeGroups.forEach(group => {
            // TODO: Apply group.prayerSettings logic here later (e.g., random, recent)
            // For now, assume "all"
            if (group.personIds) {
              group.personIds.forEach(id => personIdsToPrayFor.add(id))
            }
          })
          console.log("[Prayer Debug] Person IDs collected from active groups:", Array.from(personIdsToPrayFor))

          // 5. Filter all people data to get the final list for today
          const todaysList = peopleData.filter(person => personIdsToPrayFor.has(person.id))
          setTodaysPrayerList(todaysList)
          console.log("[Prayer Debug] Final Today's Prayer List:", JSON.stringify(todaysList, null, 2))

        } catch (err) {
          console.error("Error fetching prayer data:", err)
          setError("Failed to load prayer data. Please try again later.")
          setTodaysPrayerList([]) // Clear list on error
        } finally {
          setLoadingData(false)
        }
      }

      fetchDataAndDetermineList()
    } else if (!authLoading && !user) {
      // Handle logged out state
      setLoadingData(false)
      setError("Please log in to view your prayer list.")
      setAllUserGroups([])
      setAllUserPeople([])
      setTodaysPrayerList([])
    }
    // Dependency array: refetch if user logs in/out or date changes
  }, [user, authLoading, currentDate])

  // Render the main prayer screen
  const renderMainPrayerScreen = () => {
    const activePrayers = getActivePrayers()
    const completedPrayers = getCompletedPrayers() // Will be empty for now

    return (
      <>
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div>
            <h1 className="page-title">Prayer List</h1>
            {/* Date Navigation */}
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" size="icon" onClick={goToPreviousDay} className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-medium text-center min-w-[160px]">
                {getDayName(currentDate)}, {formatDate(currentDate)}
              </h2>
              <Button variant="outline" size="icon" onClick={goToNextDay} className="h-7 w-7">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* --- Simplified Add Request Dialog Trigger --- */}
          <Dialog open={false} onOpenChange={() => {}}>
            <DialogTrigger asChild>
              <Button className="bg-shrub hover:bg-shrub/90" disabled>
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </DialogTrigger>
            {/* DialogContent commented out or simplified previously */}
          </Dialog>
          {/* --- End Add Request Dialog --- */}
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {loadingData ? (
          <div className="text-center py-10 text-muted-foreground">Loading prayer list...</div>
        ) : (
          <Tabs defaultValue="pray" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pray">Pray</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            {/* Pray Tab */}
            <TabsContent value="pray" className="space-y-4">
              {activePrayers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No one scheduled for prayer today.</p>
              ) : (
                activePrayers.map((person) => (
                  <Card key={person.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => toggleExpandPerson(person.id)}>
                      <CardTitle className="text-lg font-semibold">{person.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        {/* Placeholder for prayed button */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-shrub" onClick={(e) => { e.stopPropagation(); markAsPrayedFor(person.id); }}>
                          <Heart className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {expandedPersonId === person.id ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                      </div>
                    </CardHeader>
                    {expandedPersonId === person.id && (
                      <CardContent className="pt-4 space-y-4">
                        {/* --- Simplified Content: Remove prayer request/followup details --- */}
                        <p className="text-sm text-muted-foreground">Prayer requests and follow-ups will appear here.</p>
                        {/* TODO: Add logic to fetch and display actual PrayerRequests and FollowUps subcollections */}
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Completed Tab */}
            <TabsContent value="completed" className="space-y-4">
              {completedPrayers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No prayers marked completed yet.</p>
              ) : (
                completedPrayers.map((person) => (
                  <Card key={person.id} className="opacity-70">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-lg font-normal italic">{person.name}</CardTitle>
                      {/* Optionally show when they were prayed for */}
                      <Check className="h-5 w-5 text-green-600" />
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </>
    )
  }

  // --- Commented out Dialogs and Screens relying on old data structure ---
  /*
  // All Prayer Requests Dialog
  <Dialog open={false} onOpenChange={() => {}}>
    ... dialog content ...
  </Dialog>

  // Render the "View All Prayer Requests" screen
  const renderViewAllRequestsScreen = () => { ... }
  */

  return (
    <div className="mobile-container pb-16 md:pb-6">
      {/* Ensure main screen is always rendered for now */}
      {renderMainPrayerScreen()}
    </div>
  )
}

