"use client"

import { useState, useEffect, FormEvent } from "react"
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, User, UserPlus, Users, Loader2, MoreVertical, Trash2, Edit, LogOut, RefreshCw, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, writeBatch, arrayRemove, deleteField, orderBy, deleteDoc } from 'firebase/firestore'
import type { Person, Group, PrayerRequest, FollowUp } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMobile } from "@/hooks/use-mobile"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog"
import {
  RadioGroup,
  RadioGroupItem
} from "@/components/ui/radio-group"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableGroupCard } from "../../src/components/ui/sortable-group-card";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

// Day names (Restored)
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_OF_WEEK_MOBILE = ["Su", "M", "T", "W", "Th", "F", "Sa"]

export default function AssignmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter();
  const isMobile = useMobile()
  const [people, setPeople] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [localNumPerDaySettings, setLocalNumPerDaySettings] = useState<Record<string, number | null>>({});
  const [isSavingNumPerDay, setIsSavingNumPerDay] = useState<string | null>(null);

  const [isAddPersonDialogOpen, setIsAddPersonDialogOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [isAddingPerson, setIsAddingPerson] = useState(false);

  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  const [isPersonActionsDialogOpen, setIsPersonActionsDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditingPersonName, setIsEditingPersonName] = useState(false);
  const [editingPersonNameValue, setEditingPersonNameValue] = useState("");
  const [isSavingPersonName, setIsSavingPersonName] = useState(false);
  const [editPersonNameError, setEditPersonNameError] = useState<string | null>(null);
  const [conflictingPerson, setConflictingPerson] = useState<Person | null>(null);
  const [isMergingPerson, setIsMergingPerson] = useState(false);

  const [isDeletePersonConfirmOpen, setIsDeletePersonConfirmOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);
  const [deletePersonError, setDeletePersonError] = useState<string | null>(null);

  const [isGroupActionsDialogOpen, setIsGroupActionsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editingGroupNameValue, setEditingGroupNameValue] = useState("");
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [editGroupNameError, setEditGroupNameError] = useState<string | null>(null);

  const [isAssigningPerson, setIsAssigningPerson] = useState<string | null>(null);
  const [isUpdatingDays, setIsUpdatingDays] = useState<string | null>(null);
  const [isRemovingPersonId, setIsRemovingPersonId] = useState<string | null>(null);

  const [isDeleteGroupConfirmOpen, setIsDeleteGroupConfirmOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const [deleteGroupMembersOption, setDeleteGroupMembersOption] = useState<"unassign" | "delete">("unassign");

  const [isPersonDetailsModalOpen, setIsPersonDetailsModalOpen] = useState(false);
  const [selectedPersonForDetails, setSelectedPersonForDetails] = useState<Person | null>(null);
  const [personPrayerRequests, setPersonPrayerRequests] = useState<PrayerRequest[]>([]);
  const [personFollowUps, setPersonFollowUps] = useState<FollowUp[]>([]);
  const [isLoadingPersonDetails, setIsLoadingPersonDetails] = useState(false);
  const [personDetailsError, setPersonDetailsError] = useState<string | null>(null);

  const [isAddRequestDialogOpen, setIsAddRequestDialogOpen] = useState(false);
  const [newRequestContent, setNewRequestContent] = useState("");
  const [isAddingRequest, setIsAddingRequest] = useState(false);

  const [isAddFollowUpDialogOpen, setIsAddFollowUpDialogOpen] = useState(false);
  const [newFollowUpContent, setNewFollowUpContent] = useState("");
  const [newFollowUpDueDate, setNewFollowUpDueDate] = useState<Date | null>(null);
  const [isAddingFollowUp, setIsAddingFollowUp] = useState(false);

  const [isEditRequestDialogOpen, setIsEditRequestDialogOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<PrayerRequest | null>(null);
  const [editingRequestContent, setEditingRequestContent] = useState("");
  const [isSavingRequestEdit, setIsSavingRequestEdit] = useState(false);
  const [isDeleteRequestConfirmOpen, setIsDeleteRequestConfirmOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<PrayerRequest | null>(null);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);

  const [isEditFollowUpDialogOpen, setIsEditFollowUpDialogOpen] = useState(false);
  const [followUpToEdit, setFollowUpToEdit] = useState<FollowUp | null>(null);
  const [editingFollowUpContent, setEditingFollowUpContent] = useState("");
  const [isSavingFollowUpEdit, setIsSavingFollowUpEdit] = useState(false);
  const [isDeleteFollowUpConfirmOpen, setIsDeleteFollowUpConfirmOpen] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] = useState<FollowUp | null>(null);
  const [isDeletingFollowUp, setIsDeletingFollowUp] = useState(false);

  // State to track the active tab in the Person Details modal
  const [activeDetailsTab, setActiveDetailsTab] = useState<'requests' | 'followups'>('requests');

  const [currentDateString] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex((item) => item.id === active.id);
      const newIndex = groups.findIndex((item) => item.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) {
        console.error("Could not find dragged item or drop target in state.");
        return; 
      }

      const newOrderedGroups = arrayMove(groups, oldIndex, newIndex);

      setGroups(newOrderedGroups); // Optimistic UI update
      console.log(`Group ${active.id} moved locally from index ${oldIndex} to ${newIndex}`);
      console.log("New Local Order:", newOrderedGroups.map(g => ({ id: g.id, name: g.name })));

      // --- Persist the new order in Firestore --- 
      try {
        const batch = writeBatch(db);
        newOrderedGroups.forEach((group, index) => {
          // Find the group's original data to compare its order
          const originalGroupData = groups.find(g => g.id === group.id);
          // Update Firestore only if the order changed or was missing
          if (originalGroupData?.order !== index || group.order === undefined) {
             console.log(`Updating order for ${group.id} to ${index}`);
             const groupRef = doc(db, "groups", group.id);
             batch.update(groupRef, { order: index });
          }
        });
        await batch.commit();
        console.log("Successfully updated group order in Firestore.");
      } catch (error) {
        console.error("Error updating group order in Firestore:", error);
        // Consider reverting the optimistic update on error
        setGroups(groups); // Revert local state to before drag
        alert("Failed to save the new group order. Please try again.");
      }
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      const fetchData = async () => {
        setLoadingData(true)
        try {
          const userId = user.uid

          // Fetch People created by the user
          const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId))
          const peopleSnapshot = await getDocs(peopleQuery)
          const peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person))
          setPeople(peopleData)
          console.log("Fetched People:", peopleData)

          // Fetch Groups created by the user, ordered by the 'order' field
          const groupsQuery = query(
            collection(db, "groups"), 
            where("createdBy", "==", userId),
            orderBy("order", "asc") // Add ordering by the 'order' field
          );
          const groupsSnapshot = await getDocs(groupsQuery)
          // Ensure fetched data includes the 'order' field, provide default if missing for robustness
          const groupsData = groupsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            order: doc.data().order ?? 0 // Default order to 0 if missing
          } as Group));
          
          setGroups(groupsData)
          console.log("Fetched and ordered Groups:", groupsData)

          // --- Initialize local state for numPerDay inputs (handles null) ---
          const initialNumPerDay: Record<string, number | null> = {};
          groupsData.forEach(group => {
            // Default to null (All) if prayerSettings or numPerDay is missing/undefined
            initialNumPerDay[group.id] = group.prayerSettings?.numPerDay ?? null;
          });
          setLocalNumPerDaySettings(initialNumPerDay);
          // --- End initialization ---

        } catch (err) {
          console.error("Error fetching data:", err)
        } finally {
          setLoadingData(false)
        }
      }
      fetchData()
    } else if (!authLoading && !user) {
      // Handle case where user is not logged in AFTER loading is finished
      setLoadingData(false)
      setPeople([])
      setGroups([])
      setLocalNumPerDaySettings({})
    }
  }, [user, authLoading])

  // Get uncategorized people - uses local state, will update when fetching real data
  const uncategorizedPeople = people.filter((person) => !person.groupId)

  // Get people in a specific group - uses local state, will update when fetching real data
  const getPeopleInGroup = (groupId: string) => {
    return people.filter((person) => person.groupId === groupId)
  }

  // CHANGE: Toggle expanded state for a group (add/remove from array)
  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds(prevIds =>
      prevIds.includes(groupId)
        ? prevIds.filter(id => id !== groupId) // Remove ID if already present
        : [...prevIds, groupId] // Add ID if not present
    );
  };

  // Toggle day for group - Needs Firestore update
  const toggleDayForGroup = async (groupId: string, dayIndex: number) => {
    if (!user || isUpdatingDays === groupId) return; // Prevent concurrent updates for the same group

    console.log(`Toggling day ${dayIndex} for group ${groupId}`);
    setIsUpdatingDays(groupId); // Set loading state for this group

    // Find the current group's data
    const group = groups.find(g => g.id === groupId);
    if (!group) {
        console.error("Group not found locally!");
        setIsUpdatingDays(null);
        return;
    }

    // Determine the new prayerDays array
    const currentDays = group.prayerDays || [];
    let newPrayerDays: number[];
    if (currentDays.includes(dayIndex)) {
      // Remove the day
      newPrayerDays = currentDays.filter(day => day !== dayIndex);
    } else {
      // Add the day and sort for consistency
      newPrayerDays = [...currentDays, dayIndex].sort((a, b) => a - b);
    }

    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        prayerDays: newPrayerDays
      });

      // Optimistic UI Update: Update local group state
      setGroups(prevGroups =>
        prevGroups.map(g =>
          g.id === groupId ? { ...g, prayerDays: newPrayerDays } : g
        )
      );
      console.log(`Toggled day ${dayIndex} for group ${groupId}`);

    } catch (err) {
      console.error("Error updating prayer days:", err);
    } finally {
      setIsUpdatingDays(null); // Clear loading state
    }
  };

  // Add Person Submit Handler
  const handleAddPersonSubmit = async (e: FormEvent, groupIdToAssign?: string) => {
    e.preventDefault();
    if (!newPersonName.trim() || !user) return;

    setIsAddingPerson(true);

    try {
      // Explicitly define the type for newPersonData
      // Corrected 'any' type to use serverTimestamp() which returns a specific type
      const newPersonData: { name: string; createdBy: string; createdAt: Timestamp; groupId?: string } = {
        name: newPersonName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp() as Timestamp, // Cast to Timestamp for type safety
      };

      if (groupIdToAssign) {
        newPersonData.groupId = groupIdToAssign;
      }

      const docRef = await addDoc(collection(db, "persons"), newPersonData);

      // If assigned to group, update group's personIds array
      if (groupIdToAssign) {
        const groupRef = doc(db, "groups", groupIdToAssign);
        await updateDoc(groupRef, {
          personIds: arrayUnion(docRef.id)
        });
        console.log(`Also added person ${docRef.id} to group ${groupIdToAssign}`);
      }

      // Add the new person to local state
      setPeople(prev => [
        ...prev,
        { id: docRef.id, ...newPersonData, createdAt: Timestamp.now() } as Person
      ]);
      setNewPersonName(""); // Clear input
      setIsAddPersonDialogOpen(false); // Close dialog
      console.log("Person added with ID: ", docRef.id);

    } catch (err) {
      console.error("Error adding person:", err);
    } finally {
      setIsAddingPerson(false);
    }
  };

  // Add Group Submit Handler
  const handleAddGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    setIsAddingGroup(true);

    try {
      const newGroupData = {
        name: newGroupName.trim(),
        createdBy: user.uid,
        personIds: [], // Start with no people
        prayerDays: [], // Start with no days assigned
        // Use the updated prayerSettings structure with defaults
        prayerSettings: {
          strategy: "sequential" as const, // Add 'as const' for stricter typing
          numPerDay: null, // Default to null (All)
          nextIndex: 0
        },
        createdAt: serverTimestamp(),
        order: groups.length // Set order to current length
      };
      const docRef = await addDoc(collection(db, "groups"), newGroupData);
      
      // Add the new group to local state, ensuring all fields match the Group type
      const groupForState: Group = {
        id: docRef.id,
        name: newGroupData.name,
        createdBy: newGroupData.createdBy,
        personIds: newGroupData.personIds,
        prayerDays: newGroupData.prayerDays,
        prayerSettings: { // Ensure prayerSettings is defined
            strategy: newGroupData.prayerSettings.strategy,
            numPerDay: null, // Default to null (All)
            nextIndex: newGroupData.prayerSettings.nextIndex
        },
        createdAt: Timestamp.now(), // Use client-side timestamp for immediate update
        order: newGroupData.order
      };
      // Ensure local state also reflects numPerDay: null - Handled in object creation below
      // NO LONGER NEEDED: groupForState.prayerSettings.numPerDay = null; 
      setGroups(prev => [...prev, groupForState]); 
      // ADD THIS: Update local settings state for the new group
      setLocalNumPerDaySettings(prev => ({ ...prev, [docRef.id]: null }));

      setNewGroupName(""); // Clear input
      setIsAddGroupDialogOpen(false); // Close dialog
      console.log("Group added with ID: ", docRef.id);

    } catch (err) {
      console.error("Error adding group:", err);
    } finally {
      setIsAddingGroup(false);
    }
  };

  // Assign Person to Group - Implement Firestore update for BOTH Person and Group
  const handleAssignPersonToGroup = async (personId: string, groupId: string) => {
     if (!user || isAssigningPerson) return; // Prevent concurrent updates

     console.log(`Assigning person ${personId} to group ${groupId}`);
     setIsAssigningPerson(personId); // Set loading state for this person

     // Check if person already has a group and remove from old group if necessary
     const person = people.find(p => p.id === personId);
     const oldGroupId = person?.groupId;

     // Create refs for the documents
     const personRef = doc(db, "persons", personId);
     const groupRef = doc(db, "groups", groupId);
     // Create a batch
     const batch = writeBatch(db);

     try {
       // 1. Update Person: Set the groupId field
       batch.update(personRef, { groupId: groupId });

       // 2. Update New Group: Add personId to the personIds array
       batch.update(groupRef, { personIds: arrayUnion(personId) });

       // 3. Update Old Group (if exists): Remove personId from personIds array
       if (oldGroupId && oldGroupId !== groupId) {
         const oldGroupRef = doc(db, "groups", oldGroupId);
         batch.update(oldGroupRef, { personIds: arrayRemove(personId) });
         console.log(`Also removing person ${personId} from old group ${oldGroupId}`);
       }

       // Commit the batch
       await batch.commit();

       // Optimistic UI Update: Update person locally
       setPeople(prevPeople =>
         prevPeople.map(p =>
           p.id === personId ? { ...p, groupId: groupId } : p
         )
       );
       // Note: Update local groups state for personIds if needed for immediate UI consistency
       if (oldGroupId && oldGroupId !== groupId) {
         setGroups(prevGroups => prevGroups.map(g => {
           if (g.id === oldGroupId) {
             return { ...g, personIds: g.personIds.filter(id => id !== personId) };
           }
           if (g.id === groupId) {
             // Ensure personId is added if not already (though arrayUnion should handle)
             return { ...g, personIds: [...new Set([...g.personIds, personId])] };
           }
           return g;
         }));
       } else if (groupId) {
          setGroups(prevGroups => prevGroups.map(g => {
            if (g.id === groupId) {
              return { ...g, personIds: [...new Set([...g.personIds, personId])] };
            }
            return g;
         }));
       }

       console.log(`Person ${personId} assigned to group ${groupId} successfully (batch commit).`);

     } catch (err) {
       console.error("Error assigning person (batch):", err);
     } finally {
       setIsAssigningPerson(null); // Clear loading state
     }
  };
  
  // Remove Person from Group - Implement Firestore update for BOTH Person and Group
  const handleRemovePersonFromGroup = async (personId: string, groupId: string) => {
     if (!user || isRemovingPersonId) return; // Prevent concurrent updates

     console.log(`Removing person ${personId} from group ${groupId}`);
     setIsRemovingPersonId(personId); // Set loading state for this person

     const personRef = doc(db, "persons", personId);
     const groupRef = doc(db, "groups", groupId);
     const batch = writeBatch(db);

     try {
       // 1. Update Person: Remove the groupId field
       // Using update with deleteField() is safer than setting to null if field might not exist
       batch.update(personRef, { groupId: deleteField() });

       // 2. Update Group: Remove personId from the personIds array
       batch.update(groupRef, { personIds: arrayRemove(personId) });

       // Commit the batch
       await batch.commit();

       // Optimistic UI Update: Move person locally back to uncategorized
       setPeople(prevPeople =>
         prevPeople.map(p =>
           p.id === personId ? { ...p, groupId: undefined } : p // Set groupId to undefined locally
         )
       );

       console.log(`Person ${personId} removed from group ${groupId} successfully (batch commit).`);

     } catch (err) {
       console.error("Error removing person from group (batch):", err);
     } finally {
       setIsRemovingPersonId(null); // Clear loading state
     }
  };
  
  // Add Person to Specific Group - Note: groupId parameter is unused here as it opens the generic add person dialog
  const handleAddPersonToGroup = (groupId: string) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    setNewPersonName(""); 
    setIsAddPersonDialogOpen(true);
  };

  // NEW: Update numPerDay setting for a group (handles null for "All")
  const handleNumPerDayChange = async (groupId: string, newValue: number | null) => {
    if (!user || isSavingNumPerDay) return;

    const originalGroup = groups.find(g => g.id === groupId);
    // Default to null (All) if setting doesn't exist
    const originalValue = originalGroup?.prayerSettings?.numPerDay ?? null;

    // Validate only if it's a number, otherwise keep null
    let validatedValue: number | null = null;
    if (newValue !== null) {
        validatedValue = Math.max(1, Math.floor(newValue));
    }

    // Update local state immediately
    setLocalNumPerDaySettings(prev => ({ ...prev, [groupId]: validatedValue }));

    // Only save if the value actually changed
    if (validatedValue === originalValue) {
      console.log(`No change needed for group ${groupId} numPerDay.`);
      return;
    }

    console.log(`Updating numPerDay for group ${groupId} to ${validatedValue === null ? 'All' : validatedValue}`);
    setIsSavingNumPerDay(groupId);

    try {
      const groupRef = doc(db, "groups", groupId);

      // Explicitly construct the prayerSettings object for the update
      const newPrayerSettings = {
        strategy: originalGroup?.prayerSettings?.strategy ?? "sequential",
        numPerDay: validatedValue, // The new validated value (can be null)
        nextIndex: originalGroup?.prayerSettings?.nextIndex ?? 0,
      };

      await updateDoc(groupRef, {
        prayerSettings: newPrayerSettings
      });

      // Update the main groups state to reflect the saved change
      setGroups(prevGroups =>
        prevGroups.map(g =>
          g.id === groupId ? {
            ...g,
            prayerSettings: newPrayerSettings // Use the same object used for saving
          } : g
        )
      );

      console.log(`numPerDay updated successfully for group ${groupId}.`);

    } catch (err) {
      console.error("Error updating numPerDay:", err);
      // Revert local state on error
      setLocalNumPerDaySettings(prev => ({ ...prev, [groupId]: originalValue }));
    } finally {
      setIsSavingNumPerDay(null);
    }
  };

  // --- Functions for Person Actions --- 
  const openPersonActionsDialog = (person: Person) => {
    setSelectedPerson(person);
    setIsPersonActionsDialogOpen(true);
  }

  // --- Edit Person Name --- 
  const handleEditPersonName = async () => {
    if (!selectedPerson || !editingPersonNameValue.trim() || editingPersonNameValue.trim() === selectedPerson.name) {
      setIsEditingPersonName(false); // Close edit form if name is unchanged or empty
      setEditPersonNameError(null);
      return;
    }

    const personId = selectedPerson.id;
    const newName = editingPersonNameValue.trim();
    const newNameLower = newName.toLowerCase(); // For case-insensitive comparison

    setIsSavingPersonName(true);
    setEditPersonNameError(null);
    setConflictingPerson(null); // Clear previous conflict

    try {
      // 1. Check for existing person with the same name (case-insensitive, client-side)
      // Fetch all people belonging to the user (re-use fetched `people` state for efficiency)
      const potentialConflicts = people.filter(
         p => p.id !== personId && p.name.toLowerCase() === newNameLower && p.createdBy === user?.uid
      );

      if (potentialConflicts.length > 0) {
        // Found a conflict
        const targetPerson = potentialConflicts[0]; // Assuming only one conflict is possible/handled
        setConflictingPerson(targetPerson);
        setEditPersonNameError(`Person named "${targetPerson.name}" already exists.`); // Inform user
        setIsSavingPersonName(false);
        return; // Stop standard save, wait for merge decision
      }

      // --- No Conflict Found: Proceed with standard name update --- 

      // 2. Update Firestore document
      const personRef = doc(db, "persons", personId);
      await updateDoc(personRef, {
        name: newName
      });

      // 3. Optimistic UI Update
      setPeople(prevPeople =>
        prevPeople.map(p => (p.id === personId ? { ...p, name: newName } : p))
      );
      // Also update the selectedPerson state if it's currently open
      setSelectedPerson(prev => (prev?.id === personId ? { ...prev, name: newName } : prev));

      // 4. Close edit form and potentially the dialog
      setIsEditingPersonName(false);

      console.log(`Person ${personId} name updated to ${newName}`);

    } catch (err) {
      console.error("Error updating person name:", err);
      setEditPersonNameError("Failed to update name. Please try again.");
    } finally {
      setIsSavingPersonName(false);
    }
  };

  // --- Merge Person ---
  const handleMergePerson = async () => {
    if (!selectedPerson || !conflictingPerson || !user) return;

    setIsMergingPerson(true);
    setEditPersonNameError(null); // Clear error message during merge attempt

    const sourcePerson = selectedPerson; // Person being edited (will be deleted)
    const targetPerson = conflictingPerson; // Existing person (will be kept)

    console.log(`Attempting to merge ${sourcePerson.name} (${sourcePerson.id}) into ${targetPerson.name} (${targetPerson.id})`);

    try {
      const batch = writeBatch(db);

      // 1. Get Ref for the source person (to be deleted)
      const sourcePersonRef = doc(db, "persons", sourcePerson.id);

      // 2. Delete the source person document
      batch.delete(sourcePersonRef);

      // 3. If the source person was in a group, remove them from that group's personIds
      if (sourcePerson.groupId) {
        const sourceGroupRef = doc(db, "groups", sourcePerson.groupId);
        batch.update(sourceGroupRef, {
          personIds: arrayRemove(sourcePerson.id)
        });
         console.log(`Also removing source person ${sourcePerson.id} from their original group ${sourcePerson.groupId}`);
      }
      
      // Note: Target person remains in their original group (targetPerson.groupId) as per requirements.
      // No data migration is performed in this simplified version.

      // 4. Commit the batch
      await batch.commit();

      // 5. Optimistic UI Update
      // Remove source person from local state
      setPeople(prevPeople => prevPeople.filter(p => p.id !== sourcePerson.id));

      // Update the source group's personIds in local state if applicable
      if (sourcePerson.groupId) {
         setGroups(prevGroups => prevGroups.map(g => {
           if (g.id === sourcePerson.groupId) {
             return { ...g, personIds: g.personIds.filter(id => id !== sourcePerson.id) };
           }
           return g;
         }));
      }

      console.log(`Merge successful: ${sourcePerson.name} deleted, ${targetPerson.name} kept.`);

      // 6. Close dialogs
      setIsEditingPersonName(false);
      setIsPersonActionsDialogOpen(false);
      setConflictingPerson(null); // Clear conflict state

    } catch (err) {
        console.error("Error merging person:", err);
        setEditPersonNameError("Failed to merge persons. Please try again.");
        // Keep the edit form open to show the error
    } finally {
       setIsMergingPerson(false);
    }
  };

  // --- Delete Person --- 
  // Opens the confirmation dialog
  const handleDeletePersonClick = (person: Person) => {
    setSelectedPerson(person); // Set the person to be deleted
    setDeletePersonError(null); // Clear previous errors
    setIsDeletePersonConfirmOpen(true);
    setIsPersonActionsDialogOpen(false); // Close the actions dialog
  }

  // Performs the actual deletion after confirmation
  const handleConfirmDeletePerson = async () => {
    if (!selectedPerson || !user) return;

    const personId = selectedPerson.id;
    const groupId = selectedPerson.groupId;
    const personName = selectedPerson.name; // For logging/error messages

    setIsDeletingPerson(true);
    setDeletePersonError(null);

    try {
      const batch = writeBatch(db);

      // 1. Delete the person document
      const personRef = doc(db, "persons", personId);
      batch.delete(personRef);

      // 2. If in a group, remove from group's personIds array
      if (groupId) {
        const groupRef = doc(db, "groups", groupId);
        batch.update(groupRef, {
          personIds: arrayRemove(personId)
        });
      }

      // 3. Commit the batch
      await batch.commit();

      // 4. Optimistic UI Update: Remove person from local state
      setPeople(prevPeople => prevPeople.filter(p => p.id !== personId));

      // 5. Close confirmation dialog & clear selection
      setIsDeletePersonConfirmOpen(false);
      setSelectedPerson(null);

    } catch (err) {
      console.error("Error deleting person:", err);
      setDeletePersonError(`Failed to delete ${personName}. Please try again.`);
      // Keep dialog open to show error
    } finally {
      setIsDeletingPerson(false);
    }
  };

  // --- Group Actions ---
  const openGroupActionsDialog = (group: Group) => {
    setSelectedGroup(group);
    setIsGroupActionsDialogOpen(true);
    // Clear edit/delete states when opening
    setIsEditingGroupName(false);
    setEditGroupNameError(null);
    setDeleteGroupError(null); // Clear group delete error too
    setDeleteGroupMembersOption("unassign"); // Reset member option
  }

  // --- Edit Group Name --- 
  const handleEditGroupName = async () => {
    if (!selectedGroup || !editingGroupNameValue.trim() || editingGroupNameValue.trim() === selectedGroup.name) {
      setIsEditingGroupName(false);
      setEditGroupNameError(null);
      return;
    }

    const groupId = selectedGroup.id;
    const newName = editingGroupNameValue.trim();

    setIsSavingGroupName(true);
    setEditGroupNameError(null);

    try {
      // TODO: Add group name conflict check if necessary

      // Update Firestore
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        name: newName
      });

      // Optimistic UI Update
      setGroups(prevGroups =>
        prevGroups.map(g => (g.id === groupId ? { ...g, name: newName } : g))
      );
      setSelectedGroup(prev => (prev?.id === groupId ? { ...prev, name: newName } : prev));

      // Close edit form
      setIsEditingGroupName(false);

    } catch (err) {
      console.error("Error updating group name:", err);
      setEditGroupNameError("Failed to update group name. Please try again.");
    } finally {
      setIsSavingGroupName(false);
    }
  };

  // --- Delete Group ---
  // Opens the confirmation dialog
  const handleDeleteGroupClick = (group: Group) => {
    setSelectedGroup(group); // Set the group to be potentially deleted
    setDeleteGroupError(null);
    setDeleteGroupMembersOption("unassign"); // Default option
    setIsDeleteGroupConfirmOpen(true);
    setIsGroupActionsDialogOpen(false); // Close the actions dialog
  }

  // Performs the actual deletion after confirmation
  const handleConfirmDeleteGroup = async () => {
    if (!selectedGroup || !user) return;

    const groupId = selectedGroup.id;
    const groupName = selectedGroup.name;
    const memberIds = selectedGroup.personIds || [];

    setIsDeletingGroup(true);
    setDeleteGroupError(null);

    try {
      const batch = writeBatch(db);

      // 1. Delete the group document
      const groupRef = doc(db, "groups", groupId);
      batch.delete(groupRef);

      // 2. Handle members based on the selected option
      if (deleteGroupMembersOption === "unassign" && memberIds.length > 0) {
        // Move members to uncategorized by removing groupId
        memberIds.forEach(personId => {
          const personRef = doc(db, "persons", personId);
          batch.update(personRef, { groupId: deleteField() }); // Remove the groupId field
        });
      } else if (deleteGroupMembersOption === "delete" && memberIds.length > 0) {
        // Delete member documents
        memberIds.forEach(personId => {
          const personRef = doc(db, "persons", personId);
          batch.delete(personRef);
        });
      }

      // 3. Commit the batch
      await batch.commit();

      // 4. Optimistic UI Updates
      // Remove the group from local state
      setGroups(prevGroups => prevGroups.filter(g => g.id !== groupId));

      // Update people state based on the option
      if (deleteGroupMembersOption === "unassign") {
        setPeople(prevPeople =>
          prevPeople.map(p =>
            memberIds.includes(p.id) ? { ...p, groupId: undefined } : p // Set groupId to undefined
          )
        );
      } else if (deleteGroupMembersOption === "delete") {
        setPeople(prevPeople => prevPeople.filter(p => !memberIds.includes(p.id)));
      }

      // 5. Close confirmation dialog & clear selection
      setIsDeleteGroupConfirmOpen(false);
      setSelectedGroup(null);

    } catch (err) {
      console.error("Error deleting group:", err);
      setDeleteGroupError(`Failed to delete group ${groupName}. Please try again.`);
      // Keep dialog open to show error
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Define isLoading based on auth and data loading states
  const isLoading = authLoading || loadingData;

  // --- Update Today's List State/Handler (NEW) ---
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdatingAndReturning, setIsUpdatingAndReturning] = useState(false); // State for new FAB action

  // --- New Handler for FAB: Update and Navigate Back ---
  const handleUpdateAndGoBack = async () => {
    if (!user || isUpdatingAndReturning) return;
    setIsUpdatingAndReturning(true);
    setUpdateError(null); // Clear previous errors

    // Remove today-specific logic
    // const today = new Date();
    // const dateKey = today.toISOString().split('T')[0];
    const userId = user.uid;
    const cacheKey = `prayerApp_dailyCache_${userId}`;

    // console.log(`[FAB] Starting update and return for user ${userId}, date ${dateKey}`);
    console.log(`[FAB] Clearing cache and returning for user ${userId}`);

    try {
        // 1. Clear the ENTIRE session storage cache for this user
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(cacheKey);
            console.log(`[FAB] Cleared entire session storage cache: ${cacheKey}`);
        }

        // 2. REMOVED: Clear central Firestore cache document for today
        // const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
        // try {
        //      await deleteDoc(dailyListRef);
        //      console.log(`[FAB] Deleted Firestore document at path ${dailyListRef.path} (if it existed).`);
        // } catch (deleteError) {
        //      console.warn(`[FAB] Could not delete Firestore doc (may not exist or other issue):`, deleteError);
        // }

        // 3. REMOVED: Explicit recalculation for today
        // console.log(`[FAB] Calling calculation function...`);
        // await calculateAndSaveDailyPrayerList(db, userId, today);
        // console.log(`[FAB] Calculation function finished successfully.`);

        // 4. Navigate back to prayer page
        // Use a slight delay to ensure cache removal is processed before navigation (optional but can help)
        await new Promise(resolve => setTimeout(resolve, 50)); 
        router.push('/prayer');

    } catch (error) {
        // Catch potential errors during cache removal or navigation
        console.error("[FAB] Error during cache clear and return process:", error);
        setUpdateError("Failed to clear cache before returning. Please try returning manually.");
        // Don't navigate if update failed, show error on assignments page
    } finally {
        setIsUpdatingAndReturning(false);
    }
  };

  // NEW: Fetch details for a specific person
  const fetchPersonDetails = async (personId: string) => {
    if (!user) return; // Added missing check
    console.log("Fetching details for person:", personId);
    setIsLoadingPersonDetails(true); // Correct reference
    setPersonDetailsError(null); // Correct reference
    setPersonPrayerRequests([]); // Correct reference
    setPersonFollowUps([]); // Correct reference

    try {
      // Fetch Prayer Requests from the subcollection
      const requestsQuery = query(
        collection(db, "persons", personId, "prayerRequests"), // Corrected path
        // where("personId", "==", personId), // No longer needed when querying subcollection
        where("createdBy", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestsData = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrayerRequest));
      setPersonPrayerRequests(requestsData);
      console.log("Fetched Prayer Requests:", requestsData);

      // Fetch Follow Ups from the subcollection
      const followUpsQuery = query(
        collection(db, "persons", personId, "followUps"), // Corrected path
        // where("personId", "==", personId), // No longer needed when querying subcollection
        where("createdBy", "==", user.uid),
        orderBy("dueDate", "asc") // Corrected orderBy based on FollowUp type
      );
      const followUpsSnapshot = await getDocs(followUpsQuery);
      const followUpsData = followUpsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FollowUp));
      setPersonFollowUps(followUpsData);
      console.log("Fetched Follow Ups:", followUpsData);

    } catch (err) {
      console.error("Error fetching person details:", err);
      setPersonDetailsError("Failed to load details. Please try again.");
    } finally {
      setIsLoadingPersonDetails(false);
    }
  };

  // NEW: Handler to open the person details modal
  const handleOpenPersonDetailsModal = (person: Person) => {
    setSelectedPersonForDetails(person);
    setIsPersonDetailsModalOpen(true);
    fetchPersonDetails(person.id); // Fetch data when modal opens
  };

  // --- Handlers for Prayer Request Edit/Delete --- 

  const handleSaveRequestEdit = async () => {
    if (!requestToEdit || !editingRequestContent.trim() || !user || !selectedPersonForDetails) return;

    setIsSavingRequestEdit(true);
    const docRef = doc(db, "persons", selectedPersonForDetails.id, "prayerRequests", requestToEdit.id);

    try {
      await updateDoc(docRef, {
        content: editingRequestContent.trim(),
        updatedAt: serverTimestamp()
      });

      // Update local state
      setPersonPrayerRequests(prev => prev.map(req => 
        req.id === requestToEdit.id ? { ...req, content: editingRequestContent.trim() } : req
      ));

      toast.success("Prayer request updated.");
      setIsEditRequestDialogOpen(false);
      setRequestToEdit(null);

    } catch (err) {
      console.error("Error updating prayer request:", err);
      toast.error("Failed to update prayer request.");
    } finally {
      setIsSavingRequestEdit(false);
    }
  };

  const handleConfirmDeleteRequest = async () => {
    if (!requestToDelete || !user || !selectedPersonForDetails) return;

    setIsDeletingRequest(true);
    const docRef = doc(db, "persons", selectedPersonForDetails.id, "prayerRequests", requestToDelete.id);

    try {
      await deleteDoc(docRef);

      // Update local state
      setPersonPrayerRequests(prev => prev.filter(req => req.id !== requestToDelete.id));

      toast.success("Prayer request deleted.");
      setIsDeleteRequestConfirmOpen(false);
      setRequestToDelete(null);

    } catch (err) {
      console.error("Error deleting prayer request:", err);
      toast.error("Failed to delete prayer request.");
    } finally {
      setIsDeletingRequest(false);
    }
  };

  // --- Handlers for Follow-Up Edit/Delete --- 

  // NEW: Handler to open the Add Prayer Request dialog
  const handleOpenAddRequestDialog = () => {
    setNewRequestContent(""); // Clear previous content
    setIsAddingRequest(false); // Reset loading state
    setIsAddRequestDialogOpen(true);
  };

  // NEW: Handler to open the Add Follow-Up dialog
  const handleOpenAddFollowUpDialog = () => {
    setNewFollowUpContent(""); // Clear previous content
    setNewFollowUpDueDate(null); // Reset date
    setIsAddingFollowUp(false); // Reset loading state
    setIsAddFollowUpDialogOpen(true);
  };

  // NEW: Handler to submit a new prayer request
  const handleAddRequestSubmit = async () => {
    if (!user || !selectedPersonForDetails || !newRequestContent.trim()) {
      console.error("Missing user, selected person, or request content.");
      toast.error("Could not add request. Ensure you are logged in and have entered content.");
      return;
    }

    setIsAddingRequest(true);
    const personId = selectedPersonForDetails.id;
    const personName = selectedPersonForDetails.name;

    try {
      const requestsRef = collection(db, "persons", personId, "prayerRequests");
      const newRequestData = {
        personId: personId,
        personName: personName, // Denormalize name
        content: newRequestContent.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        isCompleted: false
      };
      const docRef = await addDoc(requestsRef, newRequestData);
      console.log("New prayer request added with ID:", docRef.id);

      // Optimistic UI Update: Add to local state
      setPersonPrayerRequests(prev => [
        ...prev,
        { 
          id: docRef.id, 
          ...newRequestData, 
          createdAt: Timestamp.fromDate(new Date()) // Use Timestamp for consistency with Firestore
        } as unknown as PrayerRequest // Cast after conversion for type safety
      ]);

      toast.success(`Prayer request added for ${personName}`);
      setIsAddRequestDialogOpen(false); // Close dialog

    } catch (error) {
      console.error("Error adding prayer request:", error);
      toast.error("Error adding prayer request", {
        description: "Could not save the new request. Please try again.",
      });
    } finally {
      setIsAddingRequest(false);
    }
  };

  // NEW: Handler to submit a new follow-up
  const handleAddFollowUpSubmit = async () => {
    if (!user || !selectedPersonForDetails || !newFollowUpContent.trim() || !newFollowUpDueDate) {
      console.error("Missing user, selected person, follow-up content, or due date.");
      toast.error("Could not add follow-up. Ensure all fields are filled.");
      return;
    }

    setIsAddingFollowUp(true);
    const personId = selectedPersonForDetails.id;
    const personName = selectedPersonForDetails.name;

    try {
      const followUpsRef = collection(db, "persons", personId, "followUps");
      const newFollowUpData = {
        personId: personId,
        personName: personName, // Denormalize name
        content: newFollowUpContent.trim(),
        dueDate: Timestamp.fromDate(newFollowUpDueDate), // Convert JS Date to Firestore Timestamp
        completed: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      };
      const docRef = await addDoc(followUpsRef, newFollowUpData);
      console.log("New follow-up added with ID:", docRef.id);

      // Optimistic UI Update: Add to local state
      const timestamp = Timestamp.fromDate(newFollowUpDueDate);
      setPersonFollowUps(prev => [
        ...prev,
        { 
          id: docRef.id, 
          ...newFollowUpData, 
          // Use Timestamp for consistency with Firestore
          dueDate: timestamp,
          createdAt: Timestamp.fromDate(new Date())
        } as unknown as FollowUp // Cast after conversion for type safety
      ].sort((a, b) => {
        // Safe timestamp comparison
        const dateA = a.dueDate instanceof Timestamp ? a.dueDate.toMillis() : 0;
        const dateB = b.dueDate instanceof Timestamp ? b.dueDate.toMillis() : 0;
        return dateA - dateB;
      })); // Keep sorted

      toast.success(`Follow-up added for ${personName}`);
      setIsAddFollowUpDialogOpen(false); // Close dialog

    } catch (error) {
      console.error("Error adding follow-up:", error);
      toast.error("Error adding follow-up", {
        description: "Could not save the new follow-up. Please try again.",
      });
    } finally {
      setIsAddingFollowUp(false);
    }
  };

  // --- Handlers for Follow-Up Edit/Delete --- 

  // NEW: Implement the save handler for follow-up edits
  const handleSaveFollowUpEdit = async () => {
    if (!followUpToEdit || !editingFollowUpContent.trim() || !user || !selectedPersonForDetails) {
      console.error("Missing data for follow-up edit save.");
      toast.error("Could not save follow-up edit. Please try again.");
      return;
    }

    setIsSavingFollowUpEdit(true);
    const docRef = doc(db, "persons", selectedPersonForDetails.id, "followUps", followUpToEdit.id);

    try {
      await updateDoc(docRef, {
        content: editingFollowUpContent.trim(),
        // Add updatedAt timestamp if needed for tracking edits, otherwise optional
        updatedAt: serverTimestamp() 
      });

      // Update local state
      setPersonFollowUps(prev => 
        prev.map(fu => 
          fu.id === followUpToEdit.id ? { ...fu, content: editingFollowUpContent.trim() } : fu
        ).sort((a, b) => { // Keep sorted by due date
           const dateA = a.dueDate instanceof Timestamp ? a.dueDate.toMillis() : 0;
           const dateB = b.dueDate instanceof Timestamp ? b.dueDate.toMillis() : 0;
           return dateA - dateB;
        })
      );

      toast.success("Follow-up updated.");
      setIsEditFollowUpDialogOpen(false);
      setFollowUpToEdit(null); // Clear the state after successful save

    } catch (err) {
      console.error("Error updating follow-up:", err);
      toast.error("Failed to update follow-up.");
    } finally {
      setIsSavingFollowUpEdit(false);
    }
  };

  // NEW: Implement the delete handler for follow-ups
  const handleConfirmDeleteFollowUp = async () => {
    if (!followUpToDelete || !user || !selectedPersonForDetails) {
        console.error("Missing data for follow-up delete.");
        toast.error("Could not delete follow-up. Please try again.");
        return;
    }

    setIsDeletingFollowUp(true);
    const docRef = doc(db, "persons", selectedPersonForDetails.id, "followUps", followUpToDelete.id);

    try {
      await deleteDoc(docRef);

      // Update local state
      setPersonFollowUps(prev => prev.filter(fu => fu.id !== followUpToDelete.id));

      toast.success("Follow-up deleted.");
      setIsDeleteFollowUpConfirmOpen(false);
      setFollowUpToDelete(null); // Clear the state after successful delete

    } catch (err) {
      console.error("Error deleting follow-up:", err);
      toast.error("Failed to delete follow-up.");
    } finally {
      setIsDeletingFollowUp(false);
    }
  };

  // Loading State
  if (authLoading) { // Use authLoading for the initial check
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  // Logged Out State
  if (!user) {
    return (
      <div className="mobile-container pb-16 md:pb-6">
        {/* Header structure remains for consistency */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="page-title">People</h1>
            <p className="text-muted-foreground">{currentDateString}</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90" disabled={true}>
                <Plus className="h-4 w-4" /> Group
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
        {/* Login Prompt */}
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">
            Please <strong className="text-foreground">log in</strong> or <strong className="text-foreground">sign up</strong> to view your assignments.
          </p>
        </div>
      </div>
    );
  }

  // Logged In State
  return (
    <div className="mobile-container pb-16 md:pb-6">
      {/* Consistent Header Structure */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        {/* Left side: Title and Date */}
        <div className="flex flex-col">
          <h1 className="page-title">People</h1>
          <p className="text-muted-foreground">{currentDateString}</p>
        </div>
        {/* Right side: Back to Prayer Button */}
        <div className="flex items-center gap-2">
            {/* Comment out the Update button */}
            {/* <Button 
               variant="default"
               size="sm" 
               onClick={handleUpdateAndGoBack} 
               disabled={isUpdatingAndReturning}
            >
               {isUpdatingAndReturning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
               {isUpdatingAndReturning ? "Returning..." : "Update"}
            </Button> */}
        </div>
      </div>

      {/* Display error if update failed */}
      {updateError && (
        <div className="mb-4 p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
           {updateError}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
            {/* Uncategorized People Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Uncategorized People</span>
                  {/* --- Add Person Dialog Trigger --- */}
                  <Dialog open={isAddPersonDialogOpen} onOpenChange={setIsAddPersonDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1" disabled={isLoading || !user}>
                        <UserPlus className="h-4 w-4" />
                        Add Person
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={(e) => handleAddPersonSubmit(e)}>
                        <DialogHeader>
                          <DialogTitle>Add New Person</DialogTitle>
                          <DialogDescription>
                            Enter the name of the person you want to add.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="person-name" className="text-right">
                              Name
                            </Label>
                            <Input
                              id="person-name"
                              value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              className="col-span-3"
                              placeholder="Person's name"
                              required
                              disabled={isAddingPerson}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                             <Button type="button" variant="outline" disabled={isAddingPerson}>Cancel</Button>
                          </DialogClose>
                          <Button type="submit" disabled={isAddingPerson || !newPersonName.trim()}>
                            {isAddingPerson ? "Adding..." : "Add Person"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  {/* --- End Add Person Dialog --- */}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
                ) : uncategorizedPeople.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No uncategorized people
                  </div>
                ) : (
                  <div className="space-y-2 pt-4">
                    {/* Display uncategorized people */}
                    {uncategorizedPeople.map((person) => (
                      <div key={person.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                        {/* Left Side: Icon + Clickable Name */}
                        <div 
                          className="flex items-center gap-2" // Removed cursor-pointer and onClick
                         >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span 
                            className="cursor-pointer hover:underline" // Make name clickable and underline on hover
                            onClick={() => handleOpenPersonDetailsModal(person)} // Open details modal on click
                          >
                             {person.name}
                           </span>
                        </div>

                        {/* Right Side: Assign Button + Edit Button */}
                        <div className="flex items-center gap-1">
                          {/* RESTORE Assign to Group Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                disabled={groups.length === 0 || isLoading || isAssigningPerson === person.id}
                              >
                                {isAssigningPerson === person.id ? "Assigning..." : "Assign to Group"}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {groups.length === 0 ? (
                                 <DropdownMenuLabel>No groups available</DropdownMenuLabel>
                              ) : (
                                <>
                                  <DropdownMenuLabel>Assign to:</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {groups.map((group) => (
                                    <DropdownMenuItem
                                      key={group.id}
                                      onSelect={() => handleAssignPersonToGroup(person.id, group.id)}
                                      disabled={isAssigningPerson === person.id}
                                    >
                                      {group.name}
                                    </DropdownMenuItem>
                                  ))}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {/* ADD Edit Icon Button */}
                           <Button 
                              variant="ghost" 
                              size="icon" // Correct size
                              className="h-7 w-7" // Keep explicit dimensions
                              onClick={() => openPersonActionsDialog(person)}
                           >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit Person</span>
                           </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Groups Section - Renders directly now */}
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No groups created yet. Click the '+' button to add your first group.
              </div>
            ) : (
                  <SortableContext
                    items={groups.map(g => g.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4 pt-4">
                      {groups.map((group) => {
                        // Prepare props for the consolidated card
                        const peopleInGroup = getPeopleInGroup(group.id);
                        const currentNumSetting = localNumPerDaySettings[group.id];
                        const displayDays = isMobile ? DAYS_OF_WEEK_MOBILE : DAYS_OF_WEEK;
                        const groupSize = group.personIds?.length ?? 0;
                        const isUpdatingThisGroupDays = isUpdatingDays === group.id;
                        const isSavingThisGroupNum = isSavingNumPerDay === group.id;

                        // Pass ALL required props to the consolidated card
                        return (
                          <SortableGroupCard
                            key={group.id} 
                            group={group}
                            peopleInGroup={peopleInGroup}
                            expandedGroupIds={expandedGroupIds} // Corrected prop name
                            toggleExpandGroup={toggleExpandGroup} 
                            openGroupActionsDialog={openGroupActionsDialog}
                            openPersonActionsDialog={openPersonActionsDialog}
                            handleAddPersonToGroup={handleAddPersonToGroup}
                            isMobile={isMobile}
                            // Pass day/number settings props
                            currentNumSetting={currentNumSetting}
                            displayDays={displayDays}
                            groupSize={groupSize}
                            isLoading={isLoading}
                            isUpdatingDays={isUpdatingThisGroupDays}
                            isSavingNumPerDay={isSavingThisGroupNum}
                            onDayToggle={toggleDayForGroup}
                            onNumPerDayChange={handleNumPerDayChange}
                            // NEW: Pass the details modal handler
                            onOpenPersonDetailsModal={handleOpenPersonDetailsModal}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
            )}
        </div>

        {/* Person Actions Dialog */}
        <Dialog open={isPersonActionsDialogOpen} onOpenChange={setIsPersonActionsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Actions for {selectedPerson?.name}</DialogTitle>
              {isEditingPersonName && selectedPerson && (
                <DialogDescription>
                  Editing name for {selectedPerson.name}.
                </DialogDescription>
              )}
            </DialogHeader>

            {isEditingPersonName ? (
              <div className="py-4 space-y-3">
                <Label htmlFor="edit-person-name">New Name</Label>
                <Input 
                  id="edit-person-name"
                  value={editingPersonNameValue}
                  onChange={(e) => setEditingPersonNameValue(e.target.value)}
                  disabled={isSavingPersonName}
                />
                {editPersonNameError && (
                  <p className="text-sm text-shrub flex items-center gap-1">
                    {editPersonNameError} 
                    {conflictingPerson && (
                      <Button 
                         variant="link" 
                         className="text-shrub h-auto p-0 text-sm underline"
                         onClick={handleMergePerson}
                         disabled={isMergingPerson}
                      >
                        {isMergingPerson ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : null}
                        Merge?
                      </Button>
                    )}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                   <Button 
                    variant="ghost"
                    onClick={() => {
                      setIsEditingPersonName(false); 
                      setEditPersonNameError(null);
                    }}
                    disabled={isSavingPersonName}
                  >
                    Cancel
                  </Button>
                  {!conflictingPerson && (
                    <Button 
                      onClick={handleEditPersonName} 
                      disabled={isSavingPersonName || !editingPersonNameValue.trim() || editingPersonNameValue.trim() === selectedPerson?.name}
                    >
                      {isSavingPersonName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-2">
                {/* Conditionally render group-related actions */}
                {selectedPerson?.groupId && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        if (selectedPerson?.id && selectedPerson?.groupId) {
                          handleRemovePersonFromGroup(selectedPerson.id, selectedPerson.groupId);
                              setIsPersonActionsDialogOpen(false);
                        }
                      }}
                      disabled={!selectedPerson?.groupId || !!isRemovingPersonId || isAssigningPerson === selectedPerson?.id}
                    >
                      <LogOut className="h-4 w-4" />
                      Remove from Group
                      {isRemovingPersonId === selectedPerson?.id && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                    </Button>
    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-2" 
                          disabled={groups.length <= 1 || !selectedPerson || isAssigningPerson === selectedPerson?.id || isRemovingPersonId === selectedPerson?.id}
                        >
                              <Users className="h-4 w-4" />
                          Move to Another Group
                          {isAssigningPerson === selectedPerson?.id && <Loader2 className="h-4 w-4 animate-spin ml-auto" />} 
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                        <DropdownMenuLabel>Move {selectedPerson?.name} to:</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {groups
                              .filter(group => group.id !== selectedPerson?.groupId)
                          .map((group) => (
                            <DropdownMenuItem
                              key={group.id}
                              onSelect={() => {
                                if (selectedPerson?.id) {
                                   handleAssignPersonToGroup(selectedPerson.id, group.id);
                                       setIsPersonActionsDialogOpen(false);
                                }
                              }}
                                  disabled={isAssigningPerson === selectedPerson?.id}
                            >
                              {group.name}
                            </DropdownMenuItem>
                        ))}
                        {groups.filter(group => group.id !== selectedPerson?.groupId).length === 0 && (
                          <DropdownMenuItem disabled>No other groups available</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {/* Always show Edit Name and Delete Person */}
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2" 
                  onClick={() => {
                    if (selectedPerson) {
                       setEditingPersonNameValue(selectedPerson.name); 
                       setIsEditingPersonName(true);
                           setEditPersonNameError(null);
                    }
                  }}
                      disabled={!!isRemovingPersonId || isSavingPersonName}
                >
                  <Edit className="h-4 w-4" />
                  Edit Name
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-shrub border-shrub hover:bg-shrub/10 hover:text-shrub"
                  onClick={() => {
                     if (selectedPerson) {
                        handleDeletePersonClick(selectedPerson);
                     }
                  }}
                      disabled={!!isRemovingPersonId || isSavingPersonName || isDeletingPerson}
                 >
                  <Trash2 className="h-4 w-4" />
                  Delete Person
                </Button>
              </div>
            )}

            {!isEditingPersonName && (
               <DialogFooter>
                 <DialogClose asChild>
                   <Button variant="ghost">Cancel</Button>
                 </DialogClose>
               </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeletePersonConfirmOpen} onOpenChange={setIsDeletePersonConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete 
                <strong> {selectedPerson?.name}</strong> and remove them from any groups.
                {deletePersonError && <p className="text-sm text-shrub mt-2">{deletePersonError}</p>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletePersonError(null)} disabled={isDeletingPerson}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDeletePerson} 
                disabled={isDeletingPerson}
                className="bg-shrub hover:bg-shrub/90"
              >
                {isDeletingPerson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isGroupActionsDialogOpen} onOpenChange={setIsGroupActionsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Actions for Group: {selectedGroup?.name}</DialogTitle>
              {isEditingGroupName && selectedGroup && (
                <DialogDescription>
                  Editing name for {selectedGroup.name}.
                </DialogDescription>
              )}
            </DialogHeader>

            {isEditingGroupName ? (
               <div className="py-4 space-y-3">
                <Label htmlFor="edit-group-name">New Group Name</Label>
                <Input 
                  id="edit-group-name"
                  value={editingGroupNameValue}
                  onChange={(e) => setEditingGroupNameValue(e.target.value)}
                  disabled={isSavingGroupName}
                />
                {editGroupNameError && (
                  <p className="text-sm text-shrub">{editGroupNameError}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                   <Button 
                    variant="ghost"
                    onClick={() => {
                      setIsEditingGroupName(false); 
                      setEditGroupNameError(null);
                    }}
                    disabled={isSavingGroupName}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleEditGroupName} 
                    disabled={isSavingGroupName || !editingGroupNameValue.trim() || editingGroupNameValue.trim() === selectedGroup?.name}
                  >
                    {isSavingGroupName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
               </div>
            ) : (
              <div className="py-4 space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2" 
                  onClick={() => {
                     if (selectedGroup) {
                        setEditingGroupNameValue(selectedGroup.name);
                        setIsEditingGroupName(true);
                        setEditGroupNameError(null);
                     }
                  }}
                      disabled={isSavingGroupName} 
                >
                  <Edit className="h-4 w-4" />
                  Edit Group Name
                </Button>
                <Button 
                   variant="outline" 
                   className="w-full justify-start gap-2 text-shrub border-shrub hover:bg-shrub/10 hover:text-shrub"
                   onClick={() => {
                     if (selectedGroup) {
                       handleDeleteGroupClick(selectedGroup);
                     }
                   }}
                   disabled={isSavingGroupName || isDeletingGroup} 
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Group
                </Button>
              </div>
            )}
            
            {!isEditingGroupName && (
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteGroupConfirmOpen} onOpenChange={setIsDeleteGroupConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Group: {selectedGroup?.name}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                   <div className="space-y-3">
                 <span>This action cannot be undone. What should happen to the <strong>{selectedGroup?.personIds?.length ?? 0} people</strong> in this group?</span>
                
                <RadioGroup 
                  value={deleteGroupMembersOption}
                  onValueChange={(value) => setDeleteGroupMembersOption(value as "unassign" | "delete")} 
                  className="mt-2 mb-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unassign" id="rg-unassign" />
                    <Label htmlFor="rg-unassign" className="font-normal cursor-pointer">
                      Move people to Uncategorized
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delete" id="rg-delete" />
                    <Label htmlFor="rg-delete" className="font-normal cursor-pointer">
                      <span className="text-shrub">Permanently delete</span> all people in this group
                    </Label>
                  </div>
                </RadioGroup>

                {deleteGroupError && <p className="text-sm text-shrub mt-2">{deleteGroupError}</p>}
               </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => {
                   setDeleteGroupError(null);
                }}
                disabled={isDeletingGroup}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDeleteGroup} 
                disabled={isDeletingGroup}
                className={cn(
                  "transition-colors", 
                  deleteGroupMembersOption === 'delete' && "bg-shrub hover:bg-shrub/90 text-white", 
                  deleteGroupMembersOption !== 'delete' && "bg-primary hover:bg-primary/90"
                )}
              >
                {isDeletingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DndContext>

      {/* FAB for Adding Group */}
      <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
          <DialogTrigger asChild>
              <Button
                  variant="default"
                  className="fixed bottom-16 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center"
                  size="icon"
                  aria-label="Add Group"
              >
                <Plus className="h-6 w-6" />
              </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddGroupSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Group</DialogTitle>
                <DialogDescription>
                  Enter the name for the new group.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="group-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="group-name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="col-span-3"
                    placeholder="Group name"
                    required
                    disabled={isAddingGroup}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="button" variant="outline" disabled={isAddingGroup}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isAddingGroup || !newGroupName.trim()}>
                  {isAddingGroup ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                  ) : (
                      "Add Group"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* NEW: Person Details Modal */}
      <Dialog open={isPersonDetailsModalOpen} onOpenChange={setIsPersonDetailsModalOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
          <DialogHeader>
            {/* Flex container for Title and Add Button - REMOVE BUTTON FROM HERE */}
            {/* <div className="flex justify-between items-center"> */}
              <DialogTitle>{selectedPersonForDetails?.name}</DialogTitle>
              {/* Conditional Add New Button moved to header - REMOVED */}
              {/* <Button size="sm" ...> ... </Button> */}
            {/* </div> */}
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {isLoadingPersonDetails ? (
              <div className="flex justify-center items-center min-h-[100px]">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : personDetailsError ? (
              <p className="text-sm text-center text-destructive">{personDetailsError}</p>
            ) : (
              <Tabs 
                defaultValue="requests" 
                className="w-full"
                onValueChange={(value) => setActiveDetailsTab(value as 'requests' | 'followups')} // Update active tab state
               >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="requests">Prayer Requests</TabsTrigger>
                  <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
                </TabsList>
                <TabsContent value="requests" className="mt-4 space-y-4"> {/* Added space-y-4 */}
                  {/* Add New Prayer Request Button - REMOVED FROM HERE */}
                   {/* <div className="flex justify-end"> ... </div> */}
                  {/* Prayer Requests List */}
                   {personPrayerRequests.length > 0 ? (
                     <ul className="space-y-2 list-disc pl-5">
                       {/* ... existing request mapping ... */}
                       {personPrayerRequests.map(req => (
                         <li key={req.id} className="text-sm text-muted-foreground flex justify-between items-start group">
                           {/* Request Content and Date - Apply whitespace-pre-wrap */}
                           <div className="flex-1 mr-2 whitespace-pre-wrap">
                             {req.content}\
                             <span className="text-xs ml-2 block text-gray-500">({req.createdAt instanceof Timestamp ? req.createdAt.toDate().toLocaleDateString() : 'Date N/A'})</span>
                           </div>
                           {/* Edit/Delete Trigger */}
                           <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                             {/* ... existing dropdown ... */}
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" className="h-6 w-6 p-0"> {/* Adjusted size/padding */}
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => { setRequestToEdit(req); setEditingRequestContent(req.content); setIsEditRequestDialogOpen(true); }}>
                                     <Edit className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => { setRequestToDelete(req); setIsDeleteRequestConfirmOpen(true); }} className="text-destructive">
                                     <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                         </li>
                       ))}
                     </ul>
                   ) : (
                     <p className="text-sm text-center text-muted-foreground italic py-4">No prayer requests found.</p>
                   )}
                </TabsContent>
                <TabsContent value="followups" className="mt-4 space-y-4"> {/* Added space-y-4 */}
                   {/* Add New Follow-Up Button - REMOVED FROM HERE */}
                    {/* <div className="flex justify-end"> ... </div> */}
                   {/* Follow Ups List */}
                    {personFollowUps.length > 0 ? (
                      <ul className="space-y-2 list-disc pl-5">
                        {/* ... existing follow-up mapping ... */}
                        {personFollowUps.map(fu => (
                          <li key={fu.id} className="text-sm text-muted-foreground flex justify-between items-start group">
                            {/* Follow-Up Content and Details */}
                            <div className="flex-1 mr-2">
                              {fu.content} 
                              <span className="text-xs ml-2 block text-gray-500"> (Due: {fu.dueDate instanceof Timestamp ? fu.dueDate.toDate().toLocaleDateString() : 'N/A'}, Status: {fu.completed ? 'Completed' : 'Pending'})</span>
                            </div>
                            {/* Edit/Delete Trigger */}
                            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              {/* ... existing dropdown ... */}
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" className="h-6 w-6 p-0"> {/* Adjusted size/padding */}
                                     <MoreVertical className="h-4 w-4" />
                                     <span className="sr-only">Actions</span>
                                   </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end">
                                   <DropdownMenuItem onSelect={() => { setFollowUpToEdit(fu); setEditingFollowUpContent(fu.content); setIsEditFollowUpDialogOpen(true); }}>
                                     <Edit className="mr-2 h-4 w-4" /> Edit
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onSelect={() => { setFollowUpToDelete(fu); setIsDeleteFollowUpConfirmOpen(true); }} className="text-destructive">
                                     <Trash2 className="mr-2 h-4 w-4" /> Delete
                                   </DropdownMenuItem>
                                 </DropdownMenuContent>
                               </DropdownMenu>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-center text-muted-foreground italic py-4">No follow-ups found.</p>
                    )}
                </TabsContent>
              </Tabs>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button> 
            </DialogClose>
            {/* Conditional Add New Button moved to footer, after Close */}
            <Button 
              size="sm" 
              className="bg-shrub hover:bg-shrub/90 gap-1"
              onClick={() => {
                if (activeDetailsTab === 'requests') {
                  handleOpenAddRequestDialog();
                } else {
                  handleOpenAddFollowUpDialog();
                }
              }}
            >
              <Plus className="h-4 w-4" /> Add New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Add Prayer Request Dialog --- */}
      <Dialog open={isAddRequestDialogOpen} onOpenChange={setIsAddRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Prayer Request for {selectedPersonForDetails?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-request-content" className="sr-only">Prayer Request</Label>
            <Textarea
              id="new-request-content"
              value={newRequestContent}
              onChange={(e) => setNewRequestContent(e.target.value)}
              placeholder="Enter prayer request details..."
              rows={4}
              disabled={isAddingRequest}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isAddingRequest}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddRequestSubmit} disabled={isAddingRequest || !newRequestContent.trim()}>
              {isAddingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Add Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Add Follow-Up Dialog --- */}
      <Dialog open={isAddFollowUpDialogOpen} onOpenChange={setIsAddFollowUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Follow-Up for {selectedPersonForDetails?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="new-followup-content">Follow-Up Details</Label>
              <Textarea
                id="new-followup-content"
                value={newFollowUpContent}
                onChange={(e) => setNewFollowUpContent(e.target.value)}
                placeholder="Enter follow-up details..."
                rows={3}
                disabled={isAddingFollowUp}
              />
            </div>
            <div>
                <Label htmlFor="new-followup-date">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newFollowUpDueDate && "text-muted-foreground"
                      )}
                      disabled={isAddingFollowUp}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newFollowUpDueDate ? format(newFollowUpDueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newFollowUpDueDate ?? undefined}
                      onSelect={(date) => setNewFollowUpDueDate(date ?? null)} // Handle undefined from onSelect
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isAddingFollowUp}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddFollowUpSubmit} disabled={isAddingFollowUp || !newFollowUpContent.trim() || !newFollowUpDueDate}>
              {isAddingFollowUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Add Follow-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Prayer Request Edit/Delete Dialogs --- */}

      {/* Edit Prayer Request Dialog */}
      <Dialog open={isEditRequestDialogOpen} onOpenChange={setIsEditRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prayer Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              value={editingRequestContent}
              onChange={(e) => setEditingRequestContent(e.target.value)}
              placeholder="Enter prayer request details..."
              rows={4}
              disabled={isSavingRequestEdit}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSavingRequestEdit}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveRequestEdit} disabled={isSavingRequestEdit || !editingRequestContent.trim()}>
              {isSavingRequestEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Prayer Request Confirmation Dialog */}
      <AlertDialog open={isDeleteRequestConfirmOpen} onOpenChange={setIsDeleteRequestConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            {/* Use asChild to prevent extra <p> wrapper */}
            <AlertDialogDescription asChild>
              <div> {/* Outer div for structure */}
                This action cannot be undone. This will permanently delete the prayer request:
                <div className="italic mt-2 text-sm text-muted-foreground">{requestToDelete?.content}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRequest}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteRequest} 
              disabled={isDeletingRequest}
              className="bg-destructive hover:bg-destructive/90"
             >
              {isDeletingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Follow-Up Edit/Delete Dialogs */}
      <Dialog open={isEditFollowUpDialogOpen} onOpenChange={setIsEditFollowUpDialogOpen}>
         {/* Note: Save button onClick points to currently unused handleSaveFollowUpEdit */}
         {/* Note: Requires followUpToEdit state which was removed */}
         <DialogContent>
          <DialogHeader>
            {/* Need followUpToEdit to display title properly */}
            {/* <DialogTitle>Edit Follow-Up for {followUpToEdit?.name}</DialogTitle> */}
            <DialogTitle>Edit Follow-Up for {selectedPersonForDetails?.name}</DialogTitle> 
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-followup-content" className="sr-only">Follow-Up Details</Label>
            <Textarea 
              id="edit-followup-content" // Add id and associate label
              value={editingFollowUpContent}
              onChange={(e) => setEditingFollowUpContent(e.target.value)}
              placeholder="Enter follow-up details..."
              rows={4}
              disabled={isSavingFollowUpEdit}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSavingFollowUpEdit}>Cancel</Button>
            </DialogClose>
            {/* Connect Save button to the new handler */}
            <Button onClick={handleSaveFollowUpEdit} disabled={isSavingFollowUpEdit || !editingFollowUpContent.trim()}>
              {isSavingFollowUpEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteFollowUpConfirmOpen} onOpenChange={setIsDeleteFollowUpConfirmOpen}>
         {/* Note: Confirm button onClick points to currently unused handleConfirmDeleteFollowUp */}
         {/* Note: Requires followUpToDelete state */}
         <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            {/* Use asChild to prevent extra <p> wrapper */}
            <AlertDialogDescription asChild>
              <div> {/* Outer div for structure */}
                This action cannot be undone. This will permanently delete the follow-up:
                <div className="italic mt-2 text-sm text-muted-foreground">{followUpToDelete?.content}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFollowUp}>Cancel</AlertDialogCancel>
            {/* Connect Confirm button to the new handler */}
            <AlertDialogAction 
              onClick={handleConfirmDeleteFollowUp}
              disabled={isDeletingFollowUp}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingFollowUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

