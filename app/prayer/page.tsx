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
import { PrayerListItem } from "./PrayerListItem"
import type { Person, Group, PrayerRequest, FollowUp } from '@/lib/types'
import { formatDate } from "@/lib/utils"

// Firestore and Auth Imports
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, doc, getDoc, Timestamp, updateDoc, serverTimestamp, orderBy, deleteField, limit } from 'firebase/firestore'

export default function PrayerPage() {
  const { user, loading: authLoading } = useAuth(); // Auth hook
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)

  // NEW State to hold detailed data for the EXPANDED person
  const [expandedData, setExpandedData] = useState<{
    requests: PrayerRequest[];
    followUps: FollowUp[];
    loading: boolean;
    error: string | null;
  }>({ requests: [], followUps: [], loading: false, error: null });

  // State for fetched data
  const [allUserGroups, setAllUserGroups] = useState<Group[]>([])
  const [allUserPeople, setAllUserPeople] = useState<Array<Person & { mostRecentRequest?: PrayerRequest }>>([])

  // State for today's prayer list derived from fetched data
  const [todaysPrayerList, setTodaysPrayerList] = useState<Array<Person & { mostRecentRequest?: PrayerRequest }>>([])

  // Loading and error states
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMarkingPrayedId, setIsMarkingPrayedId] = useState<string | null>(null)
  const [isCompletingFollowUpId, setIsCompletingFollowUpId] = useState<string | null>(null); // Loading state for follow-up completion

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

  // Toggle expanded state and fetch/clear details
  const toggleExpandPerson = (personId: string) => {
    const currentlyExpanded = expandedPersonId === personId
    if (currentlyExpanded) {
      setExpandedPersonId(null)
      // Clear expanded data
      setExpandedData({ requests: [], followUps: [], loading: false, error: null })
    } else {
      setExpandedPersonId(personId)
      // Fetch details for the newly expanded person
      fetchExpandedDetails(personId)
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

  // Format date with time for display
  const formatDateWithTime = (date: Date | undefined) => {
    if (!date) return "";
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

  // NEW: Function to mark a follow-up as complete
  const handleCompleteFollowUp = async (personId: string, followUpId: string) => {
    if (isCompletingFollowUpId) return; // Prevent double clicks
    console.log(`Completing follow-up ${followUpId} for person ${personId}`);
    setIsCompletingFollowUpId(followUpId); // Set loading state for this specific follow-up

    try {
      const followUpRef = doc(db, "persons", personId, "followUps", followUpId);
      await updateDoc(followUpRef, {
        completed: true,
        completedAt: serverTimestamp()
      });

      // Optimistic UI update: Update the follow-up in the expandedData state
      setExpandedData(prevData => ({
        ...prevData,
        followUps: prevData.followUps.map(fu =>
          fu.id === followUpId ? { ...fu, completed: true } : fu
        )
      }));
      console.log(`Follow-up ${followUpId} marked as complete.`);

    } catch (err) {
      console.error("Error completing follow-up:", err);
      // Consider adding specific error state for the expanded item
      setExpandedData(prevData => ({ ...prevData, error: "Failed to update follow-up." }));
    } finally {
      setIsCompletingFollowUpId(null); // Clear loading state
    }
  };

  // Get completed prayers - Filter based on lastPrayedFor date
  const getCompletedPrayers = (): Array<Person & { mostRecentRequest?: PrayerRequest }> => {
    return todaysPrayerList.filter(person => isSameDay(person.lastPrayedFor, currentDate));
  };

  // Get active prayers - Filter based on lastPrayedFor date
  const getActivePrayers = (): Array<Person & { mostRecentRequest?: PrayerRequest }> => {
    return todaysPrayerList.filter(person => !isSameDay(person.lastPrayedFor, currentDate));
  };

  // Fetch initial data (groups, people, and determine today's list)
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
          let peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));

          // 3. Fetch the MOST RECENT prayer request for EACH person (for collapsed view)
          // This adds extra reads but simplifies the list item component
          const peopleWithRecentRequestPromises = peopleData.map(async (person) => {
            const requestsQuery = query(
              collection(db, "persons", person.id, "prayerRequests"),
              orderBy("createdAt", "desc"),
              limit(1) // Only get the most recent one
            );
            const requestSnapshot = await getDocs(requestsQuery);
            const mostRecentRequest = requestSnapshot.empty ? undefined : { id: requestSnapshot.docs[0].id, ...requestSnapshot.docs[0].data() } as PrayerRequest;
            return { ...person, mostRecentRequest }; // Add it to the person object
          });

          const peopleWithRecentRequests = await Promise.all(peopleWithRecentRequestPromises);
          setAllUserPeople(peopleWithRecentRequests); // Update state with enhanced person data
          console.log("[Prayer Debug] Fetched People with recent request:", JSON.stringify(peopleWithRecentRequests, null, 2))

          // 4. Identify active groups for today
          const activeGroups = groupsData.filter(group =>
            group.prayerDays?.includes(currentDayIndex)
          )
          console.log(`[Prayer Debug] Filtering for day index: ${currentDayIndex}`)
          console.log("[Prayer Debug] Active groups for today:", JSON.stringify(activeGroups, null, 2))

          // 5. Get all personIds from active groups
          let personIdsToPrayFor = new Set<string>()
          activeGroups.forEach(group => {
            // TODO: Apply group.prayerSettings logic here later (e.g., random, recent)
            // For now, assume "all"
            if (group.personIds) {
              group.personIds.forEach(id => personIdsToPrayFor.add(id))
            }
          })
          console.log("[Prayer Debug] Person IDs collected from active groups:", Array.from(personIdsToPrayFor))

          // 6. Filter all ENHANCED people data to get today's list
          const todaysList = peopleWithRecentRequests.filter(person => personIdsToPrayFor.has(person.id))
          setTodaysPrayerList(todaysList)
          console.log("[Prayer Debug] Final Today's Prayer List (with recent request):", JSON.stringify(todaysList, null, 2))

        } catch (err) {
          console.error("Error fetching prayer data:", err)
          setError("Failed to load prayer data. Please try again later.")
          setTodaysPrayerList([]) // Clear list on error
          setAllUserPeople([])
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

  // NEW: Fetch expanded details (Prayer Requests & Follow-ups) for a specific person
  const fetchExpandedDetails = async (personId: string) => {
    if (!personId) return;
    console.log(`Fetching expanded details for person ${personId}...`);
    setExpandedData({ requests: [], followUps: [], loading: true, error: null });

    try {
      // Fetch Prayer Requests (ordered by newest)
      const requestsQuery = query(
        collection(db, "persons", personId, "prayerRequests"),
        orderBy("createdAt", "desc")
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestsData = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrayerRequest));

      // Fetch Follow-ups (consider ordering if needed, e.g., by dueDate)
      const followUpsQuery = query(
        collection(db, "persons", personId, "followUps")
        // Add orderBy("dueDate", "asc") if desired
      );
      const followUpsSnapshot = await getDocs(followUpsQuery);
      const followUpsData = followUpsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FollowUp));

      setExpandedData({
        requests: requestsData,
        followUps: followUpsData,
        loading: false,
        error: null
      });
      console.log(`Fetched ${requestsData.length} requests and ${followUpsData.length} follow-ups for ${personId}.`);

    } catch (err) {
      console.error("Error fetching expanded details:", err);
      setExpandedData({ requests: [], followUps: [], loading: false, error: "Could not load details." });
    } finally {
      // loading is already set to false inside try/catch
    }
  };

  // Render the main prayer screen
  const renderMainPrayerScreen = () => {
    const activePrayers = getActivePrayers()
    const completedPrayers = getCompletedPrayers()

    const getGroupName = (groupId?: string): string | undefined => {
      if (!groupId) return undefined;
      return allUserGroups.find(g => g.id === groupId)?.name;
    }

    return (
      <>
        {/* Simplified Header: Always row layout */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          {/* Title */}
          <h1 className="page-title">Prayer List</h1>
          {/* Removed Date Navigation */}

          {/* Action Button */}
          <Dialog open={false} onOpenChange={() => {}}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-shrub hover:bg-shrub/90" disabled>
                <Plus className="mr-2 h-4 w-4" />
                Request
              </Button>
            </DialogTrigger>
            {/* DialogContent commented out or simplified previously */}
          </Dialog>
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
                  const groupName = getGroupName(person.groupId);
                  const isExpanded = expandedPersonId === person.id;

                  return (
                    // USE PrayerListItem Component
                    <PrayerListItem
                      key={person.id}
                      person={person}
                      mostRecentRequest={person.mostRecentRequest} // Passed from fetched data
                      groupName={groupName}
                      isExpanded={isExpanded}
                      isLoadingExpanded={isExpanded && expandedData.loading} // Only loading if this item is expanded
                      expandedRequests={isExpanded ? expandedData.requests : []} // Pass data only if expanded
                      expandedFollowUps={isExpanded ? expandedData.followUps : []} // Pass data only if expanded
                      onToggleExpand={toggleExpandPerson}
                      onMarkPrayed={markAsPrayedFor}
                      onCompleteFollowUp={handleCompleteFollowUp} // Pass the new handler
                      isMarkingPrayed={isMarkingPrayedId === person.id}
                      // TODO: Pass expanded error state if needed for display within the item
                    />
                  );
                })
              )}
            </TabsContent>

            {/* Completed Tab */} 
            <TabsContent value="completed" className="space-y-4">
              {completedPrayers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No prayers completed today.</p>
              ) : (
                completedPrayers.map((person) => {
                   const groupName = getGroupName(person.groupId);
                  const isExpanded = expandedPersonId === person.id;

                  // USE PrayerListItem Component here too
                   return (
                     <PrayerListItem
                      key={person.id}
                      person={person}
                      mostRecentRequest={person.mostRecentRequest}
                      groupName={groupName}
                      isExpanded={isExpanded}
                      isLoadingExpanded={isExpanded && expandedData.loading}
                      expandedRequests={isExpanded ? expandedData.requests : []}
                      expandedFollowUps={isExpanded ? expandedData.followUps : []}
                      onToggleExpand={toggleExpandPerson}
                      onMarkPrayed={markAsPrayedFor} // Use the same function to 'un-complete'
                      onCompleteFollowUp={handleCompleteFollowUp}
                      isMarkingPrayed={isMarkingPrayedId === person.id} // Reflects loading state for toggle
                    />
                  );
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
    <div className="container mx-auto px-4 py-6 md:py-8">
      {/* Ensure main screen is always rendered for now */}
      {renderMainPrayerScreen()}
    </div>
  )
}

