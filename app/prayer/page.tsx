"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"; // Import Link
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
  Users,
  UserPlus,
  RefreshCw
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
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
import { useRouter } from "next/navigation"

export default function PrayerPage() {
  const { user, loading: authLoading } = useAuth(); // Auth hook
  const router = useRouter(); // Add router if not present
  const [prayerListDate, setPrayerListDate] = useState(new Date());
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [newRequestContent, setNewRequestContent] = useState("");
  const [selectedPersonIdForRequest, setSelectedPersonIdForRequest] = useState<string | "">("");
  const [selectedGroupIdForFilter, setSelectedGroupIdForFilter] = useState<string | "all">("all"); // New state for group filter

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

  // Derived state for filtered people based on selected group
  const filteredPeopleForRequestDialog = useMemo(() => {
    if (selectedGroupIdForFilter === "all") {
      return allUserPeople;
    } else if (selectedGroupIdForFilter === "uncategorized") {
      return allUserPeople.filter(p => !p.groupId);
    }
    return allUserPeople.filter(p => p.groupId === selectedGroupIdForFilter);
  }, [allUserPeople, selectedGroupIdForFilter]);

  // State for today's prayer list derived from fetched data
  const [todaysPrayerList, setTodaysPrayerList] = useState<Array<Person & { mostRecentRequest?: PrayerRequest }>>([])

  // Loading and error states
  const [loadingData, setLoadingData] = useState(true)
  const [isMarkingPrayedId, setIsMarkingPrayedId] = useState<string | null>(null)
  const [isCompletingFollowUpId, setIsCompletingFollowUpId] = useState<string | null>(null); // Loading state for follow-up completion

  // NEW: State to cache the calculated person IDs for each day (DateString -> Set<PersonID>)
  // Initialize with empty map - will load from sessionStorage in useEffect
  const [dailySelectedIdsCache, setDailySelectedIdsCache] = useState<Map<string, Set<string>>>(new Map());

  // Ref to track effect runs in StrictMode
  const effectRan = useRef(false);

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
       setSelectedGroupIdForFilter("all"); // Reset group filter on close
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

  // Function to get group name by ID
  const getGroupName = (groupId?: string): string | undefined => {
    if (!groupId) return undefined;
    return allUserGroups.find(g => g.id === groupId)?.name;
  }

  // Placeholder for validation logic (depends on rules in lib/utils)
  const isPersonEligibleForDate = (person: Person, date: Date, groups: Group[]): boolean => {
    const currentDayIndex = date.getDay();
    // Find the person's group
    const group = groups.find(g => g.id === person.groupId);

    // If person has no group or group has no prayerDays, they are not eligible through group scheduling
    if (!group || !group.prayerDays) {
        // You might have other rules for uncategorized people, but based on
        // calculateAndSaveDailyPrayerList, only people in active groups are selected.
        // console.log(`Person ${person.id} not eligible: No group or group has no prayer days.`);
        return false;
    }

    // Check if the group prays on the current day index
    const isEligible = group.prayerDays.includes(currentDayIndex);
    // if (!isEligible) {
    //     console.log(`Person ${person.id} not eligible: Group ${group.id} does not pray on day index ${currentDayIndex}.`);
    // }
    return isEligible;
  };

  // Placeholder for getting the required number of people (depends on rules in lib/utils)
  const getRequiredPeopleCountForDate = (date: Date, groups: Group[]): number => {
    const currentDayIndex = date.getDay();
    let totalRequired = 0;

    const activeGroups = groups.filter(group =>
        group.prayerDays?.includes(currentDayIndex)
    );

    activeGroups.forEach(group => {
        const groupPersonIds = group.personIds ?? [];
        if (groupPersonIds.length === 0) {
            return; // Skip empty groups
        }
        const settings = group.prayerSettings;
        const numPerDaySetting = settings?.numPerDay ?? null;
        const totalPeople = groupPersonIds.length;
        const actualNumToAssign = numPerDaySetting === null ? totalPeople : Math.min(numPerDaySetting, totalPeople);
        totalRequired += actualNumToAssign;
    });

    // console.log(`Calculated required count for ${date.toDateString()} (Day ${currentDayIndex}): ${totalRequired}`);
    return totalRequired;
  };

  // Placeholder for selecting additional people (depends on rules in lib/utils)
  const selectAdditionalEligiblePeople = (
    countNeeded: number,
    currentPeopleIds: Set<string>,
    allPeople: Person[], // All fetched people for the user
    groups: Group[], // All fetched groups for the user
    date: Date
  ): Set<string> => {
    const currentDayIndex = date.getDay();
    const additionalIds = new Set<string>();

    // 1. Find all groups active on this day
    const activeGroups = groups.filter(group =>
        group.prayerDays?.includes(currentDayIndex)
    );

    // 2. Create a pool of all *potentially* eligible people from active groups
    const eligiblePoolIds = new Set<string>();
    activeGroups.forEach(group => {
        const groupPersonIds = group.personIds ?? [];
        groupPersonIds.forEach(pid => eligiblePoolIds.add(pid));
    });

    // 3. Iterate through the pool, add eligible people not already selected
    for (const personId of eligiblePoolIds) {
        if (additionalIds.size >= countNeeded) {
            break; // Stop if we have enough
        }

        // Check if the person is not already on the list
        if (!currentPeopleIds.has(personId)) {
             // We already know their group is active today from step 1 & 2
             // (No need to call isPersonEligibleForDate again here if the pool is built correctly)
            additionalIds.add(personId);
        }
    }

    console.log(`Selected ${additionalIds.size} additional people out of ${countNeeded} needed.`);
    return additionalIds;
  };

  // NEW: Function to refresh/determine the prayer list for the current prayerListDate
  const refreshPrayerList = async (forceRecalculate = false) => {
      setLoadingData(true);
    if (!user) {
          setLoadingData(false);
          return;
      }
      const userId = user.uid;
      const targetDate = prayerListDate;
      const dateKey = targetDate.toISOString().split('T')[0];
    console.log(`[Prayer Page Refresh] Refreshing list for User: ${userId}, Date: ${dateKey}, Force recalculate: ${forceRecalculate}`);

      try {
      // --- 1. Fetch latest base data (People and Groups) ---
      console.log("[Prayer Page Refresh] Fetching latest people and groups data...");
        const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId));
      const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId));

      const [peopleSnapshot, groupsSnapshot] = await Promise.all([
        getDocs(peopleQuery),
        getDocs(groupsQuery)
      ]);

      const fetchedPeople = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
      const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setAllUserGroups(fetchedGroups); // Update groups state

      // Fetch most recent request for each person (needed for display)
      const peopleWithRecentRequestPromises = fetchedPeople.map(async (person) => {
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
      setAllUserPeople(fetchedPeopleWithRecentRequest); // Update people state
      console.log("[Prayer Page Refresh] Fetched latest base data.");
      // --- End Base Data Fetch ---

        let personIdsToPrayFor: Set<string> | null = null;
      let source: 'session' | 'firestore' | 'validated' | 'adjusted' | 'calculated' | 'error' | 'firestore_validated' = 'calculated'; // Add 'firestore_validated'

      // --- 2. Check Firestore for Existing List ---
        const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
      console.log(`[Prayer Page Refresh] Checking Firestore for daily list at path: ${dailyListRef.path}`);
        const dailyListSnap = await getDoc(dailyListRef);

      if (dailyListSnap.exists() && !forceRecalculate) {
        // console.log(`[Prayer Page Refresh] Found list in FIRESTORE for date ${dateKey}. Validation is skipped. Proceeding to ensure calculation if needed.`);
          const data = dailyListSnap.data();
        const storedPersonIds = new Set<string>(data.personIds || []);
        const storedSettingsSnapshot = data.settingsSnapshot || {}; // Get stored snapshot

        // --- 3. NEW: Validate Existing List using Settings Snapshot ---
        const currentSettingsSnapshot: Record<string, { numPerDay: number | null }> = {};
        const currentDayIndex = targetDate.getDay();
        const activeGroups = fetchedGroups.filter(group => group.prayerDays?.includes(currentDayIndex));

        activeGroups.forEach(group => {
            const groupPersonIds = group.personIds ?? [];
            if (groupPersonIds.length > 0) {
                const settings = group.prayerSettings;
                const numPerDaySetting = settings?.numPerDay ?? null;
                const totalPeople = groupPersonIds.length;
                const actualNumToAssign = numPerDaySetting === null ? totalPeople : Math.min(numPerDaySetting, totalPeople);
                currentSettingsSnapshot[group.id] = { numPerDay: actualNumToAssign };
            }
        });

        // Compare snapshots (simple stringify comparison - might need deep compare if order issues arise)
        const storedSnapshotString = JSON.stringify(storedSettingsSnapshot, Object.keys(storedSettingsSnapshot).sort());
        const currentSnapshotString = JSON.stringify(currentSettingsSnapshot, Object.keys(currentSettingsSnapshot).sort());

        if (storedSnapshotString === currentSnapshotString) {
            // Settings match! Use the stored list for stability.
            console.log(`[Prayer Page Refresh] Settings snapshot MATCHES. Using stored list from Firestore for ${dateKey}.`);
            personIdsToPrayFor = storedPersonIds;
            source = 'firestore_validated'; // New source type
        } else {
            // Settings DON'T match. Need to recalculate.
            console.log(`[Prayer Page Refresh] Settings snapshot MISMATCH. Recalculation needed for ${dateKey}.`);
            console.log("[Prayer Page Refresh] Stored Snapshot:", storedSnapshotString);
            console.log("[Prayer Page Refresh] Current Snapshot:", currentSnapshotString);
            source = 'calculated';
            personIdsToPrayFor = null;
        }

        /* --- REMOVED BLOCK START ---
        // ... (old faulty validation logic was here) ...
         --- REMOVED BLOCK END --- */

      } else {
         // No list in Firestore OR forceRecalculate is true
         if (forceRecalculate) {
             console.log(`[Prayer Page Refresh] Force recalculate requested.`);
         } else {
             console.log(`[Prayer Page Refresh] List NOT found in Firestore for date ${dateKey}.`);
         }
         source = 'calculated';
         personIdsToPrayFor = null; // Ensure calculation is triggered if needed
      }

      // --- 4. Check Session Cache (Only if Firestore didn't provide a validated list) ---
      if (source !== 'firestore_validated' && source !== 'calculated') { // Adjusted condition
        const storedSessionCache = sessionStorage.getItem(`prayerApp_dailyCache_${userId}`);
          const loadedSessionCache = parseMapWithSets(storedSessionCache);
          if (loadedSessionCache.has(dateKey)) {
             console.log(`[Prayer Page Refresh] Found list in SESSION storage for date ${dateKey}. Using it as fallback.`);
            // If Firestore failed validation or wasn't found, session is just a fallback, no need to re-validate here.
            personIdsToPrayFor = loadedSessionCache.get(dateKey)!;
            source = 'session';
            if (dailySelectedIdsCache.size === 0) {
               setDailySelectedIdsCache(loadedSessionCache); // Load into state if state is empty
            }
          }
      }


      // --- 5. Calculate if Necessary ---
      if (source === 'calculated') {
        console.log(`[Prayer Page Refresh] Proceeding with CALCULATION...`);
        try {
           // calculateAndSaveDailyPrayerList should ideally fetch its own required data
           // or accept the already fetched data to avoid redundant fetches.
           // Assuming it fetches internally for now.
               personIdsToPrayFor = await calculateAndSaveDailyPrayerList(db, userId, targetDate);
           console.log(`[Prayer Page Refresh] Calculation function finished.`);
               // Save the *result* to session storage (and update state cache)
               setDailySelectedIdsCache(prevCache => {
                 const newCache = new Map(prevCache);
             newCache.set(dateKey, personIdsToPrayFor!);
                 if (typeof window !== 'undefined') {
                   try {
                 sessionStorage.setItem(`prayerApp_dailyCache_${userId}`, stringifyMapWithSets(newCache));
                 console.log(`[Prayer Page Refresh] Saved calculated list to session storage.`);
               } catch (e) { console.error("Error saving calculated list to session storage:", e); }
                 }
                 return newCache;
               });
            } catch (calcError) {
           console.error(`[Prayer Page Refresh] Error during calculation:`, calcError);
               personIdsToPrayFor = new Set(); // Default to empty on error
           source = 'error'; // Indicate an error occurred
        }
        }

      // --- 6. Update UI ---
        if (personIdsToPrayFor) {
            const todaysList = fetchedPeopleWithRecentRequest.filter(person => personIdsToPrayFor!.has(person.id));
            setTodaysPrayerList(todaysList);
          console.log(`[Prayer Page Refresh] Final list ready (source: ${source}). Count: ${todaysList.length}`);
        } else {
         console.error("[Prayer Page Refresh] Failed to determine person IDs after all checks.");
         setTodaysPrayerList([]); // Set empty list on failure
        }

      } catch (err) {
      console.error("[Prayer Page Refresh] General error in refreshPrayerList:", err);
        setTodaysPrayerList([]);
      // Don't reset allUserGroups/allUserPeople here, as they might be needed for retries/display
      } finally {
        setLoadingData(false);
      }
    };

  // Fetch initial data and determine list using the new refresh function
  useEffect(() => {
    // Load initial cache from session storage ONCE on component mount
    if (user && dailySelectedIdsCache.size === 0 && typeof window !== 'undefined') {
        const storedCache = sessionStorage.getItem(`prayerApp_dailyCache_${user.uid}`);
        const loadedCache = parseMapWithSets(storedCache);
        if (loadedCache.size > 0) {
            console.log("[Prayer Page Effect] Loaded initial cache from session storage.");
            setDailySelectedIdsCache(loadedCache);
        }
    }

    // StrictMode check + Auth check
    if (effectRan.current === true || process.env.NODE_ENV !== 'development') {
        if (!authLoading && user) {
          // Call refreshPrayerList instead of determineList
          refreshPrayerList(); // Don't force recalculate on date change or initial load
        } else if (!authLoading && !user) {
          // Handle logged out state - reset relevant states
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
    }

    // Cleanup function for the effect
    return () => {
      effectRan.current = true; // Mark that the first mount+cleanup happened in dev
    };
  // Depend on refreshPrayerList by reference if ESLint requires, but function itself doesn't change often
  // Key dependencies are user, authLoading, prayerListDate
  }, [user, authLoading, prayerListDate]); // Removed the old determineList function

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
        {/* Action Buttons Row - Removing the Refresh Button */}
        <div className="flex items-center space-x-2">
           {/* Refresh Button - REMOVED */}
           {/* Assign Groups Button - REMOVED */}
           {/* <Link href="/assignments" passHref>
              <Button size="sm" variant="default">
                 <Users className="mr-2 h-4 w-4" /> Assign Groups
              </Button>
           </Link> */}
        </div>
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
            {getActivePrayers().length === 0 ? (
              // Conditional Empty State Message
              allUserPeople.length > 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <p className="mb-2">No one scheduled for prayer today.</p>
                  <p>Assign people to groups and set prayer days using the <span className="font-semibold">Assign Groups</span> button.</p>
                </div>
              ) : (
                // Original empty state if no people exist at all
                <p className="text-center py-8 text-muted-foreground">No one scheduled for prayer today.</p>
              )
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

      {/* FAB for Adding Prayer Request */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogTrigger asChild>
            <Button
              variant="default" // Use default style for primary action FAB
              className="fixed bottom-16 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center"
              size="icon"
              aria-label="Add Prayer Request"
            >
              <Plus className="h-6 w-6" />
            </Button>
        </DialogTrigger>
        {/* Existing DialogContent for adding request remains here */}
        <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Prayer Request</DialogTitle>
                <DialogDescription>
                   Select a person and add a new prayer request for them.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  {/* Group Filter Dropdown */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="request-group-filter" className="text-right">
                      Group (Filter)
                    </Label>
                    <Select
                      value={selectedGroupIdForFilter}
                      onValueChange={(value) => {
                        setSelectedGroupIdForFilter(value);
                        setSelectedPersonIdForRequest(""); // Reset person when filter changes
                      }}
                    >
                      <SelectTrigger id="request-group-filter" className="col-span-3">
                        <SelectValue placeholder="Filter by group..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All People</SelectItem>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {allUserGroups.filter(g => g.id !== 'archive').length > 0 && <SelectSeparator />}
                        {allUserGroups.filter(g => g.id !== 'archive').map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Person Selector */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="request-person" className="text-right">
                      Person
                    </Label>
                    <Select
                      value={selectedPersonIdForRequest}
                      onValueChange={setSelectedPersonIdForRequest}
                      disabled={filteredPeopleForRequestDialog.length === 0} // Disable if filter yields no people
                    >
                      <SelectTrigger id="request-person" className="col-span-3">
                         {/* Update placeholder based on filter results */}
                        <SelectValue placeholder={filteredPeopleForRequestDialog.length > 0 ? "Select a person" : "No people in selected group"} />
                      </SelectTrigger>
                      <SelectContent>
                         {/* Map over FILTERED people */}
                        {filteredPeopleForRequestDialog.length > 0 ? (
                          filteredPeopleForRequestDialog.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-people-placeholder" disabled>No people match filter</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Request Content */}
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="request-content" className="text-right">
                        Request
                      </Label>
                      <Textarea
                        id="request-content"
                        value={newRequestContent}
                        onChange={(e) => setNewRequestContent(e.target.value)}
                        className="col-span-3"
                        placeholder="Type the prayer request here..."
                        rows={3}
                      />
                  </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleAddPrayerRequest}
                  className="bg-shrub hover:bg-shrub/90"
                  disabled={!newRequestContent || !selectedPersonIdForRequest}
                >
                  Save Request
                </Button>
              </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

