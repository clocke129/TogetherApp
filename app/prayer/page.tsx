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
import { collection, query, where, getDocs, doc, getDoc, Timestamp, updateDoc, serverTimestamp, orderBy, deleteField } from 'firebase/firestore'
import type { Person, Group, PrayerRequest } from '@/lib/types' // Import shared types

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
  const [isMarkingPrayedId, setIsMarkingPrayedId] = useState<string | null>(null) // Loading state for marking prayed

  // State for expanded person's prayer requests
  const [expandedPersonRequests, setExpandedPersonRequests] = useState<PrayerRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

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
    const currentlyExpanded = expandedPersonId === personId
    if (currentlyExpanded) {
      // Collapse: Clear requests and ID
      setExpandedPersonId(null)
      setExpandedPersonRequests([])
      setRequestError(null)
      setLoadingRequests(false)
    } else {
      // Expand: Set ID and fetch requests
      setExpandedPersonId(personId)
      fetchPrayerRequests(personId) // Trigger fetch
    }
  }

  // Helper function to check if a Firestore Timestamp is on the same day as a JS Date
  const isSameDay = (timestamp: Timestamp | undefined, date: Date): boolean => {
    if (!timestamp) return false;
    const tsDate = timestamp.toDate();
    return (
      tsDate.getFullYear() === date.getFullYear() &&
      tsDate.getMonth() === date.getMonth() &&
      tsDate.getDate() === date.getDate()
    );
  };

  // Mark a person as prayed for - Implement with Firestore update & Undo
  const markAsPrayedFor = async (person: Person) => { // Pass the whole person object
    if (isMarkingPrayedId) return; // Prevent concurrent updates
    
    const personId = person.id;
    const alreadyPrayedToday = isSameDay(person.lastPrayedFor, currentDate);

    console.log(`Toggling prayed status for person ${personId}. Already prayed today: ${alreadyPrayedToday}`);
    setIsMarkingPrayedId(personId);
    setError(null);

    try {
      const personRef = doc(db, "persons", personId);
      let updatedData: { lastPrayedFor: any }; // Use 'any' for FieldValue union
      let optimisticTimestamp: Timestamp | undefined;

      if (alreadyPrayedToday) {
        // Undo: Remove the lastPrayedFor field
        updatedData = { lastPrayedFor: deleteField() };
        optimisticTimestamp = undefined; 
        console.log(`Undoing prayed status for ${personId}.`);
      } else {
        // Mark as prayed: Set server timestamp
        updatedData = { lastPrayedFor: serverTimestamp() };
        optimisticTimestamp = Timestamp.now(); // Use current time for optimistic update
        console.log(`Marking ${personId} as prayed for.`);
      }

      await updateDoc(personRef, updatedData);

      // Optimistic UI update: Update local state to move person
      setTodaysPrayerList(prevList =>
        prevList.map(p =>
          p.id === personId ? { ...p, lastPrayedFor: optimisticTimestamp } : p
        )
      );
      console.log(`Prayed status toggled successfully for ${personId}.`);

    } catch (err) {
      console.error("Error toggling prayed status:", err);
      setError(`Failed to update prayer status. Please try again.`);
    } finally {
      setIsMarkingPrayedId(null); // Clear loading state
    }
  };

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

  // Get completed prayers - Filter based on lastPrayedFor date
  const getCompletedPrayers = (): Person[] => {
    // Filters todaysPrayerList for people whose lastPrayedFor is today
    return todaysPrayerList.filter(person => isSameDay(person.lastPrayedFor, currentDate));
  };

  // Get active prayers - Filter based on lastPrayedFor date
  const getActivePrayers = (): Person[] => {
    // Filters todaysPrayerList for people whose lastPrayedFor is NOT today
    return todaysPrayerList.filter(person => !isSameDay(person.lastPrayedFor, currentDate));
  };

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

  // Fetch Prayer Requests for a specific person
  const fetchPrayerRequests = async (personId: string) => {
    if (!personId) return;
    console.log(`Fetching prayer requests for person ${personId}...`);
    setLoadingRequests(true);
    setRequestError(null);
    setExpandedPersonRequests([]); // Clear previous requests

    try {
      const requestsQuery = query(
        collection(db, "persons", personId, "prayerRequests"),
        orderBy("createdAt", "desc") // Order by newest first
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestsData = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrayerRequest));
      setExpandedPersonRequests(requestsData);
      console.log(`Fetched ${requestsData.length} requests for ${personId}.`);
    } catch (err) {
      console.error("Error fetching prayer requests:", err);
      setRequestError("Could not load prayer requests.");
    } finally {
      setLoadingRequests(false);
    }
  };

  // Render the main prayer screen
  const renderMainPrayerScreen = () => {
    const activePrayers = getActivePrayers()
    const completedPrayers = getCompletedPrayers()

    // Helper to find group name
    const getGroupName = (groupId?: string): string | undefined => {
      if (!groupId) return undefined;
      return allUserGroups.find(g => g.id === groupId)?.name;
    }

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
                activePrayers.map((person) => {
                  // Find the most recent prayer request for collapsed view (if already fetched)
                  // This assumes requests are fetched on expand, might need adjustment if prefetched
                  const mostRecentRequest = expandedPersonId === person.id 
                                             ? expandedPersonRequests[0] // Use fetched if expanded
                                             : undefined; // Or fetch separately later
                  const groupName = getGroupName(person.groupId);
                  const isExpanded = expandedPersonId === person.id;

                  return (
                    <Card key={person.id}>
                      <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-2">
                        <div className="flex-1 space-y-1">
                          <CardTitle className="text-lg font-semibold">{person.name}</CardTitle>
                          {groupName && (
                            <Badge variant="outline">{groupName}</Badge>
                          )}
                          {/* Display recent request content if not expanded */}
                          {!isExpanded && mostRecentRequest && (
                             <p className="text-sm text-muted-foreground pt-1">{mostRecentRequest.content}</p>
                          )}
                          {/* Metadata Line */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
                             {mostRecentRequest?.createdAt && (
                               <span className="flex items-center">
                                 <Clock className="h-3 w-3 mr-1" />
                                 Added {formatDate(mostRecentRequest.createdAt.toDate())}
                               </span>
                             )}
                             {/* Heart count placeholder - requires prayedForDates logic */} 
                             {/* {mostRecentRequest?.prayedForDates && mostRecentRequest.prayedForDates.length > 0 && (
                               <span className="flex items-center">
                                 <Heart className="h-3 w-3 mr-1" />
                                 {mostRecentRequest.prayedForDates.length}
                               </span>
                             )} */}                              
                           </div>
                        </div>
                        {/* Pray Button */}                       
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 bg-shrub hover:bg-shrub/90 text-white min-w-[80px]"
                          onClick={() => markAsPrayedFor(person)}
                          disabled={isMarkingPrayedId === person.id}
                        >
                          {isMarkingPrayedId === person.id ? (
                            <span className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
                          ) : (
                            <><Heart className="h-4 w-4" /> Pray</>
                          )}
                        </Button>
                      </CardHeader>

                      {/* Collapsible Content Trigger */} 
                      <CardFooter className="pt-0 pb-3">
                         <Button 
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => toggleExpandPerson(person.id)}
                         >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {isExpanded ? "Show less" : "Show more"}
                         </Button>
                      </CardFooter>
                      
                      {/* Expanded Content */} 
                      {isExpanded && (
                        <CardContent className="pt-0 pb-4 border-t">
                           <div className="pt-4 space-y-4">
                              {/* Display Prayer Requests List */} 
                              <h4 className="text-sm font-medium text-muted-foreground">Prayer Requests:</h4>
                              {loadingRequests ? (
                                <p className="text-sm text-muted-foreground">Loading requests...</p>
                              ) : requestError ? (
                                <p className="text-sm text-red-500">{requestError}</p>
                              ) : expandedPersonRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No prayer requests found.</p>
                              ) : (
                                <ul className="space-y-3 pl-1 text-sm">
                                  {expandedPersonRequests.map((request) => (
                                    <li key={request.id} className="border-b pb-2 last:border-b-0">
                                       <p>{request.content}</p>
                                       <p className="text-xs text-muted-foreground mt-1">Added: {formatDate(request.createdAt.toDate())}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {/* --- End Display Prayer Requests --- */}
                              
                              {/* TODO: Add Follow-up display logic similarly later */}                           
                           </div>
                        </CardContent>
                      )}
                    </Card>
                  )
                })
              )}
            </TabsContent>

            {/* Completed Tab */} 
            <TabsContent value="completed" className="space-y-4">
              {completedPrayers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No prayers marked completed yet.</p>
              ) : (
                completedPrayers.map((person) => {
                   const groupName = getGroupName(person.groupId);
                   // Find the most recent prayer request for display 
                   // Note: This assumes requests were fetched if the card was expanded previously.
                   // A more robust solution might involve fetching requests here too if needed.
                   const mostRecentRequest = expandedPersonRequests.find(req => req.id === person.id) 
                                             ? expandedPersonRequests[0] // Simplified: Just show first loaded if any
                                             : undefined;
                   return (
                     <Card key={person.id} className="bg-muted/50">
                        <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-2">
                           <div className="flex-1 space-y-1">
                              <CardTitle className="text-lg font-normal">{person.name}</CardTitle>
                              {groupName && (
                                 <Badge variant="secondary">{groupName}</Badge>
                              )}
                              {/* Optionally show recent request content */}
                              {mostRecentRequest && (
                                 <p className="text-sm text-muted-foreground pt-1">{mostRecentRequest.content}</p>
                              )}
                              {/* Metadata Line */} 
                              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
                                 {mostRecentRequest?.createdAt && (
                                    <span className="flex items-center">
                                       <Clock className="h-3 w-3 mr-1" />
                                       Added {formatDate(mostRecentRequest.createdAt.toDate())}
                                    </span>
                                 )}
                                 {/* Heart count placeholder */} 
                              </div>
                           </div>
                           {/* Prayed Button (Undo) */} 
                           <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 min-w-[80px]"
                              onClick={() => markAsPrayedFor(person)}
                              disabled={isMarkingPrayedId === person.id}
                           >
                              {isMarkingPrayedId === person.id ? (
                                 <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                              ) : (
                                 <><Check className="h-4 w-4" /> Prayed</>
                              )}
                           </Button>
                        </CardHeader>
                        <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
                           Prayed today
                        </CardFooter>
                     </Card>
                  )
                })
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

