"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, User, Check, Plus, CalendarPlus, Loader2, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  serverTimestamp,
  writeBatch,
  deleteField,
} from "firebase/firestore"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Person, Group, FollowUp } from "@/lib/types"

function FollowUpRow({ followUp, getPersonNameById, formatDate, toggleFollowUpCompletion, openEditDialog }: {
  followUp: FollowUp
  getPersonNameById: (id: string) => string
  formatDate: (date: import("firebase/firestore").Timestamp | Date) => string
  toggleFollowUpCompletion: (id: string) => void
  openEditDialog: (fu: FollowUp) => void
}) {
  return (
    <div className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
      <Checkbox id={followUp.id} checked={followUp.completed} onCheckedChange={() => toggleFollowUpCompletion(followUp.id)} className="mt-1" />
      <div className="flex-1 min-w-0">
        <label htmlFor={followUp.id} className="font-medium cursor-pointer text-base leading-snug">{followUp.content}</label>
        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span>{getPersonNameById(followUp.personId)}</span>
          {followUp.recurring && <RefreshCw className="h-3 w-3 shrink-0 ml-0.5" aria-label="Repeats annually" />}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {followUp.dueDate && (
          <Badge className="bg-shrub hover:bg-shrub/90 text-primary-foreground text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(followUp.dueDate.toDate())}
          </Badge>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(followUp)}>
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function FollowupsPage() {
  // State for data
  const [allUserPeople, setAllUserPeople] = useState<Person[]>([])
  const [allUserGroups, setAllUserGroups] = useState<Group[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize newFollowUp with default/empty values
  const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUp>>({
    content: "",
    personId: "", 
    dueDate: Timestamp.now(),
    completed: false,
    archived: false,
  } as Partial<FollowUp>)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedGroupIdForFilter, setSelectedGroupIdForFilter] = useState<string | "all">("all")
  const [scheduledExpanded, setScheduledExpanded] = useState(false)
  const [milestonesExpanded, setMilestonesExpanded] = useState(false)
  const [newFollowUpRecurring, setNewFollowUpRecurring] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [followUpToDelete, setFollowUpToDelete] = useState<FollowUp | null>(null)
  const [isDeletingFollowUp, setIsDeletingFollowUp] = useState(false)

  // State for formatted date string
  const [currentDateString, setCurrentDateString] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

  const { user } = useAuth()

  // --- Data Fetching --- //
  useEffect(() => {
    // Fetch data only if logged in
    if (!user) {
      console.log("No user logged in, skipping data fetch.")
      // Clear data if user logs out
      setFollowUps([])
      setAllUserPeople([])
      setAllUserGroups([])
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      console.log("Fetching data for user:", user.uid)
      setIsLoading(true)
      try {
        // 1. Fetch People for this user
        const peopleQuery = query(collection(db, "users", user.uid, "persons"))
        const peopleSnapshot = await getDocs(peopleQuery)
        const fetchedPeople: Person[] = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
        setAllUserPeople(fetchedPeople);
        console.log("Fetched people:", fetchedPeople);

        // 2. Fetch Groups for this user
        const groupsQuery = query(collection(db, "users", user.uid, "groups"));
        const groupsSnapshot = await getDocs(groupsQuery);
        const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setAllUserGroups(fetchedGroups);
        console.log("Fetched groups:", fetchedGroups);

        // 3. Fetch FollowUps for each person (parallel for speed)
        const followUpSnapshots = await Promise.all(
          fetchedPeople.map(person =>
            getDocs(collection(db, "users", user.uid, "persons", person.id, "followUps"))
          )
        )
        const allFollowUps: FollowUp[] = followUpSnapshots.flatMap(snap =>
          snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<FollowUp, "id">) }))
        )
        setFollowUps(allFollowUps)
        console.log("Fetched follow-ups count:", allFollowUps.length)

      } catch (error) {
        console.error("Error fetching data: ", error)
        // Optionally set an error state here
      } finally {
        setIsLoading(false)
        console.log("Data fetching complete.")
      }
    }

    fetchData()

    // No cleanup needed for getDocs, but would be for onSnapshot
  }, [user])
  // --- End Data Fetching --- //

  // Get person name by ID (adjust to use allUserPeople array)
  const getPersonNameById = (personId: string): string => {
    const person = allUserPeople.find(p => p.id === personId);
    return person ? person.name : "Unknown Person";
  }

  // Derived state for filtered people
  const filteredPeopleForDialog = useMemo(() => {
    if (selectedGroupIdForFilter === "all") {
      return allUserPeople;
    }
    const everyoneGroup = allUserGroups.find(g => g.isSystemGroup && g.name === "Everyone");
    if (selectedGroupIdForFilter === everyoneGroup?.id) {
      return allUserPeople.filter(p => !p.groupId);
    }
    return allUserPeople.filter(p => p.groupId === selectedGroupIdForFilter);
  }, [allUserPeople, allUserGroups, selectedGroupIdForFilter]);

  // Toggle follow-up completion
  const toggleFollowUpCompletion = async (followUpId: string) => {
    const followUpToUpdate = followUps.find(fu => fu.id === followUpId);
    if (!followUpToUpdate || !followUpToUpdate.personId) {
      console.error("Could not find follow-up or its personId to toggle.");
      return;
    }

    const docRef = doc(db, "users", user!.uid, "persons", followUpToUpdate.personId, "followUps", followUpId);

    try {
      // Recurring follow-ups advance by 1 year instead of completing
      if (followUpToUpdate.recurring && followUpToUpdate.recurrenceType === "annual" && followUpToUpdate.dueDate) {
        const nextDate = followUpToUpdate.dueDate.toDate();
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        const nextTimestamp = Timestamp.fromDate(nextDate);
        await updateDoc(docRef, { dueDate: nextTimestamp, completed: false });
        setFollowUps(prev => prev.map(fu =>
          fu.id === followUpId ? { ...fu, dueDate: nextTimestamp, completed: false } : fu
        ));
      } else {
        await updateDoc(docRef, { completed: !followUpToUpdate.completed });
        setFollowUps(prev => prev.map(fu =>
          fu.id === followUpId ? { ...fu, completed: !fu.completed } : fu
        ));
      }
    } catch (error) {
      console.error("Error toggling follow-up completion:", error);
      alert("Failed to update follow-up status. Please try again.");
    }
  };

  // Format date for display - needs to accept Timestamp
  const formatDate = (date: Timestamp | Date): string => {
    // Convert Timestamp to Date if necessary
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    if (jsDate.getTime() === 0) return "No date";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = jsDate.toDateString() === today.toDateString();
    const isTomorrow = jsDate.toDateString() === tomorrow.toDateString();

    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";

    return jsDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Format date for input - needs to accept Timestamp
  const formatDateForInput = (date: Timestamp | Date): string => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    if (jsDate.getTime() === 0) return "";

    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, "0");
    const day = String(jsDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // --- Filtering and Sorting Logic --- //

  // Get comparison timestamps
  const now = Timestamp.now();
  const sevenDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const thirtyDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const epochZeroTimestamp = Timestamp.fromDate(new Date(0));

  // Filter logic using Timestamps with safe access
  const activeFollowUps = followUps.filter((followUp) => !followUp.completed && !followUp.archived);

  // Milestones (recurring) are shown in their own dedicated section
  const milestonesFollowUps = activeFollowUps
    .filter((fu) => fu.recurring)
    .sort((a, b) => (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity));

  // Regular follow-ups exclude recurring items
  const regularActiveFollowUps = activeFollowUps.filter((fu) => !fu.recurring);

  const overdueFollowUps = regularActiveFollowUps
    .filter(
      (followUp) =>
        followUp.dueDate &&
        followUp.dueDate < now &&
        followUp.dueDate.seconds !== epochZeroTimestamp.seconds
    )
    .sort((a, b) => {
      const dateA = a.dueDate?.seconds ?? Infinity;
      const dateB = b.dueDate?.seconds ?? Infinity;
      return dateA - dateB;
    });

  const thisWeekFollowUps = regularActiveFollowUps
     .filter(
       (followUp) =>
         followUp.dueDate &&
         followUp.dueDate >= now &&
         followUp.dueDate < sevenDaysFromNow
     )
     .sort((a, b) => {
        const dateA = a.dueDate?.seconds ?? Infinity;
        const dateB = b.dueDate?.seconds ?? Infinity;
        return dateA - dateB;
      });

  const upcomingFollowUps = regularActiveFollowUps
     .filter(
       (followUp) => followUp.dueDate && followUp.dueDate >= sevenDaysFromNow && followUp.dueDate < thirtyDaysFromNow
     )
     .sort((a, b) => (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity));

  const scheduledFollowUps = regularActiveFollowUps
     .filter(
       (followUp) => followUp.dueDate && followUp.dueDate >= thirtyDaysFromNow
     )
     .sort((a, b) => (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity));

  const noDateFollowUps = regularActiveFollowUps
    .filter(
      (followUp) =>
        !followUp.dueDate ||
        followUp.dueDate.seconds === epochZeroTimestamp.seconds
    );

  // Include non-archived completed items only
  const completedFollowUps = followUps
      .filter((followUp) => followUp.completed && !followUp.archived)
      // Safely sort completed by most recent due date first
      .sort((a, b) => (b.dueDate?.seconds ?? 0) - (a.dueDate?.seconds ?? 0)); 
  
   // --- End Filtering and Sorting --- //

  // Handle adding a new follow-up - will need modification to save to Firestore
  const handleAddFollowUp = async () => {
    if (!user || !newFollowUp.content || !newFollowUp.personId) { // Check personId exists
      console.error("Missing user, content, or person ID for new follow-up.");
      return;
    }

    const person = allUserPeople.find(p => p.id === newFollowUp.personId)
    const docToAdd = {
      personId: newFollowUp.personId,
      personName: person?.name || "Unknown",
      content: newFollowUp.content,
      dueDate: newFollowUp.dueDate?.seconds === 0 ? deleteField() : newFollowUp.dueDate,
      completed: false,
      archived: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      ...(newFollowUpRecurring && { recurring: true, recurrenceType: "annual" }),
    };

    try {
      const followUpRef = collection(db, "users", user!.uid, "persons", newFollowUp.personId, "followUps");
      const docRef = await addDoc(followUpRef, docToAdd);

      // Optimistic Add (use Timestamp.now() for createdAt locally)
      const optimisticFollowUp = {
        id: docRef.id,
        personId: newFollowUp.personId,
        content: newFollowUp.content,
        dueDate: newFollowUp.dueDate?.seconds === 0 ? undefined : newFollowUp.dueDate,
        completed: false,
        archived: false,
        createdAt: Timestamp.now(),
        ...(newFollowUpRecurring && { recurring: true, recurrenceType: "annual" as const }),
      } as FollowUp;
      setFollowUps(prev => [...prev, optimisticFollowUp]);

      // Reset form and close dialog
      setNewFollowUp({ content: "", personId: "", dueDate: Timestamp.now(), completed: false, archived: false } as Partial<FollowUp>);
      setNewFollowUpRecurring(false);
      setIsAddDialogOpen(false);
      setSelectedGroupIdForFilter("all");

      console.log("Follow-up added successfully.");
      alert("Follow-up added!") // Or use toast
    } catch (error) {
       console.error("Error adding follow-up:", error);
       alert("Failed to add follow-up. Please try again.");
    }
  };

  // Handle editing a follow-up - FIX UNDEFINED FIELDS
  const handleEditFollowUp = async () => {
    if (!editingFollowUp || !editingFollowUp.id || !editingFollowUp.personId) {
        console.error("Invalid editing follow-up state.");
        alert("Cannot save changes, invalid data.");
        return;
    }

    console.log("Saving edits for follow-up:", editingFollowUp);
    const docRef = doc(db, "users", user!.uid, "persons", editingFollowUp.personId, "followUps", editingFollowUp.id);

    try {
      const dataToUpdate = {
        content: editingFollowUp.content,
        dueDate: editingFollowUp.dueDate instanceof Timestamp ? editingFollowUp.dueDate : Timestamp.fromDate(new Date(0)),
        recurring: editingFollowUp.recurring ?? false,
        recurrenceType: editingFollowUp.recurring ? "annual" : deleteField(),
      };

      await updateDoc(docRef, dataToUpdate);
      console.log("Follow-up updated successfully.");

      // --- Refactored Local State Update --- //
      setFollowUps(prev => prev.map(fu => {
         if (fu.id === editingFollowUp!.id) {
            // Create the updated object based on editing state first
            const updatedFollowUp: FollowUp = {
                ...editingFollowUp!,
                content: dataToUpdate.content, // Update fields from dataToUpdate
                dueDate: dataToUpdate.dueDate,
            };
            return updatedFollowUp;
         } else {
            return fu;
         }
      }));
      // --- End Refactored Local State Update --- //

      setEditingFollowUp(null);
      setIsEditDialogOpen(false);

    } catch (error) {
      console.error("Error updating follow-up:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  // Open edit dialog for a follow-up
  const openEditDialog = (followUp: FollowUp) => {
    setEditingFollowUp(followUp)
    setIsEditDialogOpen(true)
  }

  // Delete a follow-up
  const handleConfirmDeleteFollowUp = async () => {
    if (!followUpToDelete) return
    setIsDeletingFollowUp(true)
    try {
      await deleteDoc(doc(db, "users", user!.uid, "persons", followUpToDelete.personId, "followUps", followUpToDelete.id))
      setFollowUps(prev => prev.filter(fu => fu.id !== followUpToDelete.id))
      setIsDeleteConfirmOpen(false)
      setFollowUpToDelete(null)
    } catch (err) {
      console.error("Error deleting follow-up:", err)
      alert("Failed to delete. Please try again.")
    } finally {
      setIsDeletingFollowUp(false)
    }
  }

  // Set date for a follow-up with no date
  const setDateForFollowUp = (followUpId: string) => {
    const followUp = followUps.find((f) => f.id === followUpId)
    if (followUp) {
      setEditingFollowUp(followUp)
      setIsEditDialogOpen(true)
    }
  }

  // --- Clear Completed Follow-ups (Now Archives) --- //
  const handleClearCompletedFollowUps = async () => {
    if (!user || isClearing) return;
    const itemsToArchive = followUps.filter(fu => fu.completed && !fu.archived); // Use local state

    if (itemsToArchive.length === 0) {
        console.log("No completed, unarchived follow-ups to clear.");
        return;
    }

    const confirmation = confirm(`Are you sure you want to archive all ${itemsToArchive.length} completed follow-up items? They will be hidden from view.`);
    if (!confirmation) {
      return;
    }

    console.log("Starting to archive completed follow-ups...");
    setIsClearing(true);
    setError(null);

    try {
      // No need to fetch person IDs again if we trust local state
      // (assuming fetched followUps only contains user's data)

      // Create batch and stage updates for owned follow-ups
      const batch = writeBatch(db);
      let itemsToArchiveCount = 0;

      itemsToArchive.forEach(followUp => {
          // Get the full path to the follow-up doc
          const followUpRef = doc(db, "users", user!.uid, "persons", followUp.personId, "followUps", followUp.id);
          console.log(`Staging archive for follow-up ${followUp.id} (parent: ${followUp.personId})`);
          batch.update(followUpRef, { archived: true });
          itemsToArchiveCount++;
      });

      if (itemsToArchiveCount === 0) {
        console.log("Something went wrong, no items staged for archival."); // Should not happen based on initial check
        setIsClearing(false);
        return;
      }

      // Commit the batch
      console.log(`Committing batch to archive ${itemsToArchiveCount} follow-ups...`);
      await batch.commit();
      console.log("Batch commit successful.");

      // Update local state: mark items as archived
      setFollowUps(prev =>
        prev.map(fu =>
          itemsToArchive.some(item => item.id === fu.id)
            ? { ...fu, archived: true }
            : fu
        )
      );
      alert(`${itemsToArchiveCount} completed follow-up items archived successfully.`);

    } catch (err) {
      console.error("Error archiving completed follow-ups:", err);
      setError("An error occurred while archiving follow-ups. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };
  // --- End Clear Completed Follow-ups --- //

  // --- Render Logic --- 

  // Loading State (Consider using authLoading if available/needed)
  if (isLoading) { // Using existing isLoading state, might need refinement
     return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  // Logged Out State
  if (!user) {
    return (
      <div className="mobile-container pb-16 md:pb-6">
        {/* Header structure */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="page-title">Follow-ups</h1>
            <p className="text-muted-foreground">{currentDateString}</p>
          </div>
        </div>
        {/* Login Prompt */}
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">
            Please <strong className="text-foreground">log in</strong> or <strong className="text-foreground">sign up</strong> to view your follow-ups.
          </p>
        </div>
      </div>
    );
  }

  // Logged In State (Original Return Content)
  return (
    <div className="mobile-container pb-16 md:pb-6">
      {/* Consistent Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="page-title">Follow-ups</h1>
          <p className="text-muted-foreground">{currentDateString}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-shrub hover:bg-shrub/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Follow-Up
          </Button>
        </div>
      </div>

      {/* Removed isLoading check here, handled above */}
      {/* Error display */}
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Overdue / Attention */}
          {overdueFollowUps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attention</p>
                <span className="text-xs bg-shrub text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                  {overdueFollowUps.length}
                </span>
              </div>
              <div className="space-y-1">
                {overdueFollowUps.map((followUp) => (
                  <div key={followUp.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
                    <Checkbox id={followUp.id} checked={followUp.completed} onCheckedChange={() => toggleFollowUpCompletion(followUp.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={followUp.id} className="font-medium cursor-pointer text-base leading-snug">{followUp.content}</label>
                      <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span>{getPersonNameById(followUp.personId)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {followUp.dueDate && (
                        <Badge variant="default" className="bg-shrub hover:bg-shrub/90 text-primary-foreground text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(followUp.dueDate.toDate())}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(followUp)}>
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This Week */}
          {thisWeekFollowUps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">This Week</p>
              <div className="space-y-1">
                {thisWeekFollowUps.map((followUp) => (
                  <FollowUpRow key={followUp.id} followUp={followUp} getPersonNameById={getPersonNameById} formatDate={formatDate} toggleFollowUpCompletion={toggleFollowUpCompletion} openEditDialog={openEditDialog} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming (7–30 days) */}
          {upcomingFollowUps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
              <div className="space-y-1">
                {upcomingFollowUps.map((followUp) => (
                  <FollowUpRow key={followUp.id} followUp={followUp} getPersonNameById={getPersonNameById} formatDate={formatDate} toggleFollowUpCompletion={toggleFollowUpCompletion} openEditDialog={openEditDialog} />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled (30+ days, collapsed) */}
          {scheduledFollowUps.length > 0 && (
            <div>
              <button
                onClick={() => setScheduledExpanded(e => !e)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors"
              >
                {scheduledExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Scheduled ({scheduledFollowUps.length})
              </button>
              {scheduledExpanded && (
                <div className="space-y-1">
                  {scheduledFollowUps.map((followUp) => (
                    <FollowUpRow key={followUp.id} followUp={followUp} getPersonNameById={getPersonNameById} formatDate={formatDate} toggleFollowUpCompletion={toggleFollowUpCompletion} openEditDialog={openEditDialog} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Milestones (recurring, collapsed) */}
          {milestonesFollowUps.length > 0 && (
            <div>
              <button
                onClick={() => setMilestonesExpanded(e => !e)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors"
              >
                {milestonesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <RefreshCw className="h-3 w-3" />
                Milestones ({milestonesFollowUps.length})
              </button>
              {milestonesExpanded && (
                <div className="space-y-1">
                  {milestonesFollowUps.map((followUp) => (
                    <FollowUpRow key={followUp.id} followUp={followUp} getPersonNameById={getPersonNameById} formatDate={formatDate} toggleFollowUpCompletion={toggleFollowUpCompletion} openEditDialog={openEditDialog} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No Date */}
          {noDateFollowUps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">No Date</p>
              <div className="space-y-1">
                {noDateFollowUps.map((followUp) => (
                  <div key={followUp.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
                    <Checkbox id={followUp.id} checked={followUp.completed} onCheckedChange={() => toggleFollowUpCompletion(followUp.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={followUp.id} className="font-medium cursor-pointer text-base leading-snug">{followUp.content}</label>
                      <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span>{getPersonNameById(followUp.personId)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-0.5" onClick={() => setDateForFollowUp(followUp.id)}>
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overdueFollowUps.length === 0 && thisWeekFollowUps.length === 0 && upcomingFollowUps.length === 0 && scheduledFollowUps.length === 0 && noDateFollowUps.length === 0 && milestonesFollowUps.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No active follow-ups</h3>
              <p className="text-muted-foreground mt-1">All your follow-ups are completed!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Completed ({completedFollowUps.length})
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCompletedFollowUps}
              disabled={isClearing || completedFollowUps.length === 0}
              className="gap-1 text-xs"
            >
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Clear Completed
            </Button>
          </div>
          {completedFollowUps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No completed follow-ups yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {completedFollowUps.map((followUp) => (
                <div key={followUp.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
                  <Checkbox id={followUp.id} checked={followUp.completed} onCheckedChange={() => toggleFollowUpCompletion(followUp.id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={followUp.id} className="line-through text-muted-foreground cursor-pointer text-base leading-snug">{followUp.content}</label>
                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{getPersonNameById(followUp.personId)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
         <DialogContent className="sm:max-w-[425px]">
           <DialogHeader>
             <DialogTitle>Edit Follow-Up</DialogTitle>
           </DialogHeader>
           {editingFollowUp && (
             <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                 <Label htmlFor="edit-content">Follow-Up Details</Label>
                 <Textarea
                   id="edit-content"
                   value={editingFollowUp.content}
                   onChange={(e) => setEditingFollowUp({ ...editingFollowUp, content: e.target.value })}
                   rows={3}
                 />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="edit-dueDate" className="text-right">Due Date</Label>
                 <Input
                   id="edit-dueDate"
                   type="date"
                   className="col-span-3"
                   value={formatDateForInput(editingFollowUp.dueDate || Timestamp.now())}
                   onChange={(e) => {
                     const dateValue = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.now();
                     setEditingFollowUp({ ...editingFollowUp, dueDate: dateValue })
                   }}
                 />
               </div>
               <div className="flex items-center gap-2 pt-1">
                 <Checkbox
                   id="edit-recurring"
                   checked={!!editingFollowUp.recurring}
                   onCheckedChange={(checked) => setEditingFollowUp({ ...editingFollowUp, recurring: !!checked, recurrenceType: !!checked ? "annual" : undefined })}
                 />
                 <Label htmlFor="edit-recurring" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                   <RefreshCw className="h-3 w-3" /> Make this a milestone (repeats annually)
                 </Label>
               </div>
             </div>
           )}
           <DialogFooter className="flex-row">
             <Button
               variant="ghost"
               className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
               onClick={() => {
                 if (editingFollowUp) {
                   setFollowUpToDelete(editingFollowUp)
                   setIsEditDialogOpen(false)
                   setIsDeleteConfirmOpen(true)
                 }
               }}
             >
               <Trash2 className="h-4 w-4 mr-1" /> Delete
             </Button>
             <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
             <Button onClick={handleEditFollowUp}>Save Changes</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

      {/* Delete Follow-Up Confirm Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                This cannot be undone. This will permanently delete:
                <div className="italic mt-2 text-sm text-muted-foreground">{followUpToDelete?.content}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFollowUp}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteFollowUp}
              disabled={isDeletingFollowUp}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingFollowUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Follow-Up Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Follow-Up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              {/* Group Filter Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="followup-group-filter" className="text-right">
                  Group (Filter)
                </Label>
                <Select
                  value={selectedGroupIdForFilter}
                  onValueChange={(value) => {
                    setSelectedGroupIdForFilter(value);
                    setNewFollowUp({ ...newFollowUp, personId: "" }); // Reset person selection
                  }}
                >
                  <SelectTrigger id="followup-group-filter" className="col-span-3">
                    <SelectValue placeholder="Filter by group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All People</SelectItem>
                    {allUserGroups.filter(g => g.isSystemGroup && g.id !== 'archive').map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                    {allUserGroups.filter(g => !g.isSystemGroup && g.id !== 'archive').length > 0 && <SelectSeparator />}
                    {allUserGroups.filter(g => !g.isSystemGroup && g.id !== 'archive').map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Person Select Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="followup-person" className="text-right">
                  Person
                </Label>
                <Select
                  value={newFollowUp.personId || ""} // Ensure value is controlled
                  onValueChange={(value) => setNewFollowUp(prev => ({ ...prev, personId: value }) as Partial<FollowUp>)} // Explicit assertion on update
                  disabled={filteredPeopleForDialog.length === 0} // Use filtered list for disabled state
                >
                  <SelectTrigger id="followup-person" className="col-span-3">
                     {/* Adjust placeholder based on filter */}
                    <SelectValue placeholder={filteredPeopleForDialog.length > 0 ? "Select a person" : "No people in selected group"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Map over FILTERED people */}
                    {filteredPeopleForDialog.length > 0 ? (
                      filteredPeopleForDialog.map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-people-placeholder" disabled>No people match filter</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow-Up Content Textarea */}
              <div className="grid gap-2">
                <Label htmlFor="followup-content">Follow-Up Details</Label>
                <Textarea
                  id="followup-content"
                  placeholder="Enter follow-up details..."
                  value={newFollowUp.content || ""}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Due Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="followup-dueDate" className="text-right">Due Date</Label>
                <Input
                  id="followup-dueDate"
                  type="date"
                  className="col-span-3"
                  value={formatDateForInput(newFollowUp.dueDate || new Date())}
                  onChange={(e) => {
                    const dateValue = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.fromDate(new Date(0));
                    setNewFollowUp({ ...newFollowUp, dueDate: dateValue });
                  }}
                />
              </div>

              {/* Milestone checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="followup-recurring"
                  checked={newFollowUpRecurring}
                  onCheckedChange={(checked) => setNewFollowUpRecurring(!!checked)}
                />
                <Label htmlFor="followup-recurring" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> Make this a milestone (repeats annually)
                </Label>
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={handleAddFollowUp}
              disabled={!newFollowUp.content || !newFollowUp.personId}
            >
              Add Follow-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

