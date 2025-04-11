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
import { calculateAndSaveDailyPrayerList } from "@/lib/utils"
import { parseMapWithSets, stringifyMapWithSets } from "@/lib/utils"

// Firestore and Auth Imports
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, doc, getDoc, Timestamp, updateDoc, serverTimestamp, orderBy, deleteField, limit, writeBatch, addDoc } from 'firebase/firestore'

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
  // Initialize with empty map - will load from sessionStorage in useEffect
  const [dailySelectedIdsCache, setDailySelectedIdsCache] = useState<Map<string, Set<string>>>(new Map());

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
    // Implement Firestore addDoc logic here
    try {
      const requestRef = collection(db, "persons", selectedPersonIdForRequest, "prayerRequests");
      await addDoc(requestRef, {
        content: newRequestContent,
        createdAt: serverTimestamp(),
        createdBy: user.uid // Include the user ID
      });
      console.log("Prayer request added successfully.");
       setNewRequestContent("");
       setSelectedPersonIdForRequest("");
       setIsRequestDialogOpen(false); // Close the dialog
       alert("Prayer request added successfully!"); // Basic success feedback
       // TODO: Optionally refresh data or add optimistic update
    } catch (error) {
      console.error("Error adding prayer request:", error);
      // Provide a user-friendly error message
      alert("Failed to add prayer request. Please check the console for more details.");
    }
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

  // Fetch initial data and determine list
  useEffect(() => {
    if (!authLoading && user) {
      const userId = user.uid;
      const cacheKey = `prayerApp_dailyCache_${userId}`;
      const targetDate = prayerListDate; // Use state variable
      const dateKey = targetDate.toISOString().split('T')[0];

      const determineList = async () => {
        setLoadingData(true);
        console.log(`[Prayer Page] Determining list for User: ${userId}, Date: ${dateKey}`);

        try {
          // --- Always Fetch Base People Data (for display) --- //
          // Note: Groups are fetched inside the calculation function if needed
          console.log("[Prayer Page] Fetching base people data...");
          const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId));
          const peopleSnapshot = await getDocs(peopleQuery);
          const peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
          const peopleWithRecentRequestPromises = peopleData.map(async (person) => {
              const requestsQuery = query(
                  collection(db, "persons", person.id, "prayerRequests"),
                  orderBy("createdAt", "desc"),
                  limit(1)
              );
              const requestSnapshot = await getDocs(requestsQuery);
              const mostRecentRequest = requestSnapshot.empty ? undefined : { id: requestSnapshot.docs[0].id, ...requestSnapshot.docs[0].data() } as PrayerRequest;
              return { ...person, mostRecentRequest };
          });
          const fetchedPeopleWithRecentRequest = await Promise.all(peopleWithRecentRequestPromises);
          setAllUserPeople(fetchedPeopleWithRecentRequest);
          // Also fetch groups separately for getGroupName function
          const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId))
          const groupsSnapshot = await getDocs(groupsQuery)
          const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group))
          setAllUserGroups(fetchedGroups);
          console.log("[Prayer Page] Fetched base people and groups data.");
          // --- End Base Data Fetch --- //

          let personIdsToPrayFor: Set<string> | null = null;
          let source: 'session' | 'firestore' | 'calculated' = 'calculated';

          // --- 1. Check Firestore First (using NEW path) --- //
          const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
          console.log(`[Prayer Page] Checking Firestore for daily list at path: ${dailyListRef.path}`);
          const dailyListSnap = await getDoc(dailyListRef);

          if (dailyListSnap.exists()) {
            console.log(`[Prayer Page] Found list in FIRESTORE for date ${dateKey}`);
            const data = dailyListSnap.data();
            personIdsToPrayFor = new Set(data.personIds || []);
            source = 'firestore';

            // Save to session storage (and update state cache)
            setDailySelectedIdsCache(prevCache => {
              const newCache = new Map(prevCache);
              newCache.set(dateKey, personIdsToPrayFor!); // Update state map
              if (typeof window !== 'undefined') {
                try {
                   // Use the helper function to stringify the MAP
                   sessionStorage.setItem(cacheKey, stringifyMapWithSets(newCache)); 
                   console.log(`[Prayer Page] Saved Firestore list to session storage.`);
                } catch (e) {
                   console.error("Error saving Firestore list to session storage:", e);
                }
              }
              return newCache;
            });

          } else {
            console.log(`[Prayer Page] List NOT found in Firestore for date ${dateKey}. Checking session storage.`);
            // --- 2. Check Session Storage (Only if Firestore miss) --- //
            const storedSessionCache = sessionStorage.getItem(cacheKey);
            // Use the helper function to parse the MAP
            const loadedSessionCache = parseMapWithSets(storedSessionCache);
            if (loadedSessionCache.has(dateKey)) {
              console.log(`[Prayer Page] Found list in SESSION storage for date ${dateKey}`);
              personIdsToPrayFor = loadedSessionCache.get(dateKey)!;
              source = 'session';
              // Update state cache MAP if it's empty
              if (dailySelectedIdsCache.size === 0) {
                 setDailySelectedIdsCache(loadedSessionCache); 
              }
            } else {
              console.log(`[Prayer Page] List also NOT found in session storage. Calculating...`);
              // --- 3. Calculate if Both Miss --- //
              source = 'calculated';
              try {
                 personIdsToPrayFor = await calculateAndSaveDailyPrayerList(db, userId, targetDate);
                 console.log(`[Prayer Page] Calculation function finished. Saving result to caches.`);
                 // Save the *result* to session storage (and update state cache)
                 setDailySelectedIdsCache(prevCache => {
                   const newCache = new Map(prevCache);
                   newCache.set(dateKey, personIdsToPrayFor!); // Update state map
                   if (typeof window !== 'undefined') {
                     try {
                        // Use the helper function to stringify the MAP
                        sessionStorage.setItem(cacheKey, stringifyMapWithSets(newCache)); 
                        console.log(`[Prayer Page] Saved calculated list to session storage.`);
                     } catch (e) {
                        console.error("Error saving calculated list to session storage:", e);
                     }
                   }
                   return newCache;
                 });
              } catch (calcError) {
                 console.error(`[Prayer Page] Error during calculation:`, calcError);
                 // Handle calculation error (e.g., show error message, set empty list)
                 personIdsToPrayFor = new Set(); // Default to empty on error
              }
            }
          }

          // --- Update UI --- //
          if (personIdsToPrayFor) {
              const todaysList = fetchedPeopleWithRecentRequest.filter(person => personIdsToPrayFor!.has(person.id));
              setTodaysPrayerList(todaysList);
              console.log(`[Prayer Page] Final list ready (source: ${source}). Count: ${todaysList.length}`);
          } else {
             console.error("[Prayer Page] Failed to determine person IDs for today after all checks.");
             setTodaysPrayerList([]);
          }

        } catch (err) {
          console.error("[Prayer Page] General error in determineList:", err);
          setTodaysPrayerList([]);
          setAllUserGroups([]);
          setAllUserPeople([]);
        } finally {
          setLoadingData(false);
        }
      };

      determineList();

    } else if (!authLoading && !user) {
      // Handle logged out state
      setLoadingData(false)
      setDailySelectedIdsCache(new Map()); // Clear state cache on logout
      if (typeof window !== 'undefined') {
          Object.keys(sessionStorage)
              .filter(key => key.startsWith('prayerApp_dailyCache_'))
              .forEach(key => sessionStorage.removeItem(key));
          console.log("[Prayer Debug] User logged out, cleared state cache and relevant sessionStorage items.");
      } else {
          console.log("[Prayer Debug] User logged out, cleared state cache.");
      }
      setAllUserGroups([])
      setAllUserPeople([])
      setTodaysPrayerList([])
    }
  }, [user, authLoading, prayerListDate])

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

