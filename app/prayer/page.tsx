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
import { Input } from "@/components/ui/input"

// Firestore and Auth Imports
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, doc, getDoc, Timestamp, updateDoc, serverTimestamp, orderBy, deleteField, limit, writeBatch } from 'firebase/firestore'

// Helper function to stringify Map with Sets
function stringifyMapWithSets(map: Map<string, Set<string>>): string {
  return JSON.stringify(Array.from(map.entries()).map(([key, value]) => [key, Array.from(value)]));
}

// Helper function to parse Map with Sets
function parseMapWithSets(jsonString: string | null): Map<string, Set<string>> {
  if (!jsonString) return new Map();
  try {
    const parsedArray = JSON.parse(jsonString);
    return new Map(parsedArray.map(([key, valueArray]: [string, string[]]) => [key, new Set(valueArray)]));
  } catch (e) {
    console.error("Error parsing cached data from sessionStorage:", e);
    return new Map(); // Return empty map on error
  }
}

export default function PrayerPage() {
  const { user, loading: authLoading } = useAuth(); // Auth hook
  const [prayerListDate, setPrayerListDate] = useState(new Date());
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false); // State for prayer request dialog
  const [newRequestContent, setNewRequestContent] = useState("");
  const [selectedPersonIdForRequest, setSelectedPersonIdForRequest] = useState<string | "">("");

  // State for formatted date string
  const [currentDateString, setCurrentDateString] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

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
  const [isMarkingPrayedId, setIsMarkingPrayedId] = useState<string | null>(null)
  const [isCompletingFollowUpId, setIsCompletingFollowUpId] = useState<string | null>(null); // Loading state for follow-up completion

  // NEW: State to cache the calculated person IDs for each day (DateString -> Set<PersonID>)
  // Initialize from sessionStorage if available
  const [dailySelectedIdsCache, setDailySelectedIdsCache] = useState<Map<string, Set<string>>>(() => {
    if (typeof window !== 'undefined' && user) {
        const cacheKey = `prayerApp_dailyCache_${user.uid}`;
        const storedCache = sessionStorage.getItem(cacheKey);
        return parseMapWithSets(storedCache);
    }
    return new Map();
  });

  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(prayerListDate)
    newDate.setDate(newDate.getDate() - 1)
    setPrayerListDate(newDate)
    setExpandedPersonId(null) // Collapse items on date change
  }

  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(prayerListDate)
    newDate.setDate(newDate.getDate() + 1)
    setPrayerListDate(newDate)
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
    const alreadyPrayedToday = isSameDay(person.lastPrayedFor, prayerListDate);

    console.log(`Toggling prayed status for person ${personId}. Already prayed today: ${alreadyPrayedToday}`);
    setIsMarkingPrayedId(personId);

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

  // Add a new prayer request - Implement logic
  const handleAddPrayerRequest = async () => {
    if (!user || !newRequestContent || !selectedPersonIdForRequest) {
      console.error("Missing user, content, or person ID for new request.");
      // TODO: Add user feedback (e.g., toast notification)
      return;
    }

    console.log(`Adding prayer request for person ${selectedPersonIdForRequest}: ${newRequestContent}`);
    // TODO: Implement Firestore addDoc logic here
    // try {
    //   const requestRef = collection(db, "persons", selectedPersonIdForRequest, "prayerRequests");
    //   await addDoc(requestRef, {
    //     content: newRequestContent,
    //     createdAt: serverTimestamp(),
    //     // createdBy: user.uid // Optional
    //   });
    //   console.log("Prayer request added successfully.");
       setNewRequestContent("");
       setSelectedPersonIdForRequest("");
       setIsRequestDialogOpen(false); // Close the dialog
    //   // TODO: Optionally refresh data or add optimistic update
    // } catch (error) {
    //   console.error("Error adding prayer request:", error);
    //   // TODO: Add user feedback for error
    // }
  };

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
    return todaysPrayerList.filter(person => isSameDay(person.lastPrayedFor, prayerListDate));
  };

  // Get active prayers - Filter based on lastPrayedFor date
  const getActivePrayers = (): Array<Person & { mostRecentRequest?: PrayerRequest }> => {
    return todaysPrayerList.filter(person => !isSameDay(person.lastPrayedFor, prayerListDate));
  };

  // Define getGroupName in the main component scope
  const getGroupName = (groupId?: string): string | undefined => {
    if (!groupId) return undefined;
    return allUserGroups.find(g => g.id === groupId)?.name;
  }

  // Fetch initial data (groups, people, and determine today's list)
  useEffect(() => {
    if (!authLoading && user) {
      const fetchDataAndDetermineList = async () => {
        setLoadingData(true)
        console.log("Fetching prayer data for user:", user.uid)

        try {
          const userId = user.uid
          const currentDayIndex = prayerListDate.getDay() // 0 for Sunday, 1 for Monday, etc.
          // Use YYYY-MM-DD format for the cache key
          const dateKey = prayerListDate.toISOString().split('T')[0];
          console.log(`[Prayer Debug] Current Date: ${prayerListDate.toISOString()}, Day Index: ${currentDayIndex} (${getDayName(prayerListDate)}), Date Key: ${dateKey}`)

          // --- Check Cache First --- //
          if (dailySelectedIdsCache.has(dateKey)) {
            console.log(`[Prayer Debug] Using cached person IDs for date ${dateKey}`);
            const cachedPersonIds = dailySelectedIdsCache.get(dateKey) || new Set<string>();

            // We still need the latest people data (in case names/requests changed), so fetch if needed
            // For simplicity, let's assume allUserPeople is up-to-date or refetched if necessary elsewhere
            // If allUserPeople could be stale, we'd need to fetch it here too.
            // Ensure allUserPeople is populated before filtering
            let currentPeopleData = allUserPeople;
            if (currentPeopleData.length === 0) {
                // Fetch people if not already available (e.g., first load)
                const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId));
                const peopleSnapshot = await getDocs(peopleQuery);
                const peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
                const peopleWithRecentRequestPromises = peopleData.map(async (person) => {
                    const requestsQuery = query(
                        collection(db, "persons", person.id, "prayerRequests"),
                        orderBy("createdAt"),
                        limit(1)
                    );
                    const requestSnapshot = await getDocs(requestsQuery);
                    const mostRecentRequest = requestSnapshot.empty ? undefined : { id: requestSnapshot.docs[0].id, ...requestSnapshot.docs[0].data() } as PrayerRequest;
                    return { ...person, mostRecentRequest };
                });
                currentPeopleData = await Promise.all(peopleWithRecentRequestPromises);
                setAllUserPeople(currentPeopleData); // Update state if fetched now
                console.log("[Prayer Debug] Fetched People data for cache hit.");
            }

            const todaysList = currentPeopleData.filter(person => cachedPersonIds.has(person.id));
            setTodaysPrayerList(todaysList);
            console.log("[Prayer Debug] Today's Prayer List from cache:", JSON.stringify(todaysList, null, 2));
            setLoadingData(false); // Stop loading
            return; // Exit early, calculation not needed
          }

          // --- Cache Miss: Proceed with Fetching and Calculation --- //
          console.log(`[Prayer Debug] Cache miss for date ${dateKey}. Calculating list...`);

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

          // 5. --- Determine people to pray for using Sequential Algorithm & Update nextIndex --- //
          const batch = writeBatch(db); // Initialize batch for nextIndex updates
          let personIdsToPrayFor = new Set<string>(); // Initialize set for today's assignments

          activeGroups.forEach(group => {
            const groupPersonIds = group.personIds ?? [];
            if (groupPersonIds.length === 0) {
              console.log(`[Prayer Debug] Skipping group ${group.id} (${group.name}) - no members.`);
              return; // Skip groups with no members
            }

            // Get settings or use defaults
            const settings = group.prayerSettings;
            // Default to 'null' (all) if not set or explicitly null
            const numPerDaySetting = settings?.numPerDay ?? null;
            const currentStartIndex = settings?.nextIndex ?? 0; // Default to index 0 if not set
            const totalPeople = groupPersonIds.length;

            // Determine actual number to assign based on setting
            const actualNumToAssign = numPerDaySetting === null ? totalPeople : Math.min(numPerDaySetting, totalPeople);

            console.log(`[Prayer Debug] Group: ${group.name} (ID: ${group.id}) - Settings: numPerDay=${numPerDaySetting ?? 'all'}(actual:${actualNumToAssign}), startIndex=${currentStartIndex}, total=${totalPeople}`);

            let assignedCount = 0;
            let newNextIndex = currentStartIndex;
            const assignedIdsInGroup = []; // Keep track of IDs assigned from THIS group

            for (let i = 0; i < actualNumToAssign; i++) {
              const personIndex = (currentStartIndex + i) % totalPeople;
              const personId = groupPersonIds[personIndex];
              personIdsToPrayFor.add(personId);
              assignedIdsInGroup.push(personId);
              assignedCount++;
            }

            // Calculate the index for the *next* assignment
            newNextIndex = (currentStartIndex + assignedCount) % totalPeople;

            console.log(`[Prayer Debug] Group: ${group.name} - Assigned IDs: [${assignedIdsInGroup.join(", ")}], New nextIndex: ${newNextIndex}`);

            // Stage update for nextIndex if it changed or wasn't set
            if (!settings || settings.nextIndex !== newNextIndex) {
              const groupRef = doc(db, "groups", group.id);
              // Update the specific field, merging with existing settings if they exist
              // Ensure strategy and numPerDay are preserved or defaulted if missing
              batch.update(groupRef, {
                "prayerSettings.nextIndex": newNextIndex,
                "prayerSettings.strategy": settings?.strategy ?? "sequential", // Ensure strategy exists
                // Preserve null if it was null, otherwise default to null if setting didn't exist before
                "prayerSettings.numPerDay": numPerDaySetting === undefined ? null : numPerDaySetting
              });
              console.log(`[Prayer Debug] Staging update for group ${group.id}: set prayerSettings.nextIndex to ${newNextIndex}`);
            }
          });
          // --- End Sequential Algorithm Processing --- //

          console.log("[Prayer Debug] Final Person IDs determined for today:", Array.from(personIdsToPrayFor))

          // 6. Commit the batch updates for nextIndex values
          try {
              console.log("[Prayer Debug] Committing batch updates for nextIndex...");
              await batch.commit();
              console.log("[Prayer Debug] Batch commit successful.");
          } catch (commitError) {
              console.error("[Prayer Debug] Error committing batch updates:", commitError);
              // Decide how to handle commit errors - maybe proceed without index updates?
              // setError("Failed to update prayer cycle state. List may be correct but future cycles might be affected.");
          }

          // 7. Filter all ENHANCED people data to get today's list
          const todaysList = peopleWithRecentRequests.filter(person => personIdsToPrayFor.has(person.id))
          setTodaysPrayerList(todaysList)

          // --- Store the calculated IDs in the cache AND sessionStorage --- //
          setDailySelectedIdsCache(prevCache => {
              const newCache = new Map(prevCache);
              newCache.set(dateKey, personIdsToPrayFor);
              console.log(`[Prayer Debug] Stored calculated IDs in cache for date ${dateKey}`);

              // Also save to sessionStorage
              if (typeof window !== 'undefined' && user) {
                  const cacheKey = `prayerApp_dailyCache_${user.uid}`;
                  try {
                      sessionStorage.setItem(cacheKey, stringifyMapWithSets(newCache));
                      console.log("[Prayer Debug] Saved updated cache to sessionStorage.");
                  } catch (e) {
                      console.error("Error saving cache to sessionStorage:", e);
                  }
              }
              return newCache;
          });

          console.log("[Prayer Debug] Final Today's Prayer List (calculated):", JSON.stringify(todaysList, null, 2))

        } catch (err) {
          console.error("Error fetching prayer data:", err)
          setTodaysPrayerList([])
          setAllUserPeople([])
        } finally {
          setLoadingData(false)
        }
      }

      // Attempt to load cache from session storage when user/auth changes initially
      if (user && dailySelectedIdsCache.size === 0) { // Only load initially if cache is empty
          const cacheKey = `prayerApp_dailyCache_${user.uid}`;
          const storedCache = sessionStorage.getItem(cacheKey);
          const loadedCache = parseMapWithSets(storedCache);
          if (loadedCache.size > 0) {
              console.log("[Prayer Debug] Loaded cache from sessionStorage on initial load/user change.");
              setDailySelectedIdsCache(loadedCache);
          }
      }

      fetchDataAndDetermineList()
    } else if (!authLoading && !user) {
      // Handle logged out state: Clear data, stop loading, message shown in return
      // Also clear sessionStorage for the logged-out user (if we knew the previous ID)
      // For simplicity, we might just clear the state cache here.
      setDailySelectedIdsCache(new Map()); // Clear state cache on logout
      console.log("[Prayer Debug] User logged out, cleared state cache.");
      setLoadingData(false)
      setAllUserGroups([])
      setAllUserPeople([])
      setTodaysPrayerList([])
    }
    // Dependency array: refetch if user logs in/out or date changes
    // Include getDayName in dependencies if it relies on external state/props (it doesn't currently)
  }, [user, authLoading, prayerListDate]) // Removed dailySelectedIdsCache from dependencies

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

  // Main return uses mobile-container and includes header/content directly
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  if (!user) {
    return (
      <div className="mobile-container pb-16 md:pb-6">
        {/* Header structure */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="page-title">Prayer List</h1>
            <p className="text-muted-foreground">{currentDateString}</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-shrub hover:bg-shrub/90 text-white" disabled={true}>
                <Plus className="mr-2 h-4 w-4" /> Request
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
        {/* Login Prompt */}
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">
            Please <strong className="text-foreground">log in</strong> or <strong className="text-foreground">sign up</strong> to view your prayer list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container pb-16 md:pb-6">
      {/* Header section copied from renderMainPrayerScreen */}
      <div className="mb-4 md:mb-6 flex items-center justify-between"> {/* Main row */}
        <div className="flex flex-col"> {/* Inner stack for Title and Date */}
          <h1 className="page-title">Prayer List</h1>
          <p className="text-muted-foreground">{currentDateString}</p> {/* Date text */}
        </div>
        {/* Action Button - Prayer Request Dialog */}
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-shrub hover:bg-shrub/90 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Request
            </Button>
          </DialogTrigger>
          {/* Dialog Content remains the same */}
          <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add New Prayer Request</DialogTitle>
              <DialogDescription>
                Enter the details for the new prayer request item.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Request Content Textarea */}
              <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="request-content" className="text-right pt-2">
                    Request
                  </Label>
                  <Textarea
                    id="request-content"
                    placeholder="What is the prayer request?"
                    value={newRequestContent}
                    onChange={(e) => setNewRequestContent(e.target.value)}
                    className="col-span-3"
                    rows={3} // Adjust rows as needed
                  />
                </div>
                {/* Person Select Dropdown */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="request-person" className="text-right">
                    Person
                  </Label>
                  <Select
                    value={selectedPersonIdForRequest}
                    onValueChange={setSelectedPersonIdForRequest}
                  >
                    <SelectTrigger id="request-person" className="col-span-3">
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUserPeople.length > 0 ? (
                        allUserPeople.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-people-placeholder" disabled>Loading people...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleAddPrayerRequest}
                className="bg-shrub hover:bg-shrub/90 text-white"
                disabled={!newRequestContent || !selectedPersonIdForRequest} // Basic validation
              >
                Save Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading or Tabs content copied from renderMainPrayerScreen */}
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
            {/* ... Pray tab content ... */}
            {getActivePrayers().length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No one scheduled for prayer today.</p>
            ) : (
              getActivePrayers().map((person) => {
                const groupName = getGroupName(person.groupId);
                const isExpanded = expandedPersonId === person.id;
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
                    onMarkPrayed={markAsPrayedFor}
                    onCompleteFollowUp={handleCompleteFollowUp}
                    isMarkingPrayed={isMarkingPrayedId === person.id}
                    isPrayedToday={false}
                  />
                );
              })
            )}
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="space-y-4">
              {/* ... Completed tab content ... */}
              {getCompletedPrayers().length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No prayers completed today.</p>
            ) : (
              getCompletedPrayers().map((person) => {
                  const groupName = getGroupName(person.groupId);
                  const isExpanded = expandedPersonId === person.id;
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
                      onMarkPrayed={markAsPrayedFor} // To 'un-complete'
                      onCompleteFollowUp={handleCompleteFollowUp}
                      isMarkingPrayed={isMarkingPrayedId === person.id}
                      isPrayedToday={true}
                    />
                  );
              })
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

