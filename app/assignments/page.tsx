"use client"

import { useState, useEffect, FormEvent } from "react"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { ChevronDown, ChevronUp, Plus, User, UserPlus, X, Users, Minus, Loader2, Check, MoreVertical, Trash2, Edit, LogOut, RefreshCw, ArrowLeft } from "lucide-react"
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
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { CSS } from '@dnd-kit/utilities';
import { SortableGroupCard } from "../../src/components/ui/sortable-group-card";
import { SortableDayGroupCard } from "../../src/components/ui/sortable-day-group-card";
import { calculateAndSaveDailyPrayerList } from "@/lib/utils";
import { parseMapWithSets, stringifyMapWithSets } from "@/lib/utils";
import { toast } from "sonner";

// Types (Keep local types for now to avoid potential import issues until resolved)
// type Person = {
//   id: string
//   name: string
//   groupId?: string
// }

// type Group = {
//   id: string
//   name: string
//   personIds: string[]
//   prayerDays: number[] // 0-6 for Sunday-Saturday
//   prayerSettings: {
//     type: "random" | "recent" | "all"
//     count?: number
//   }
// }
// --- Removed local type definitions ---

// Day names
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_OF_WEEK_MOBILE = ["Su", "M", "T", "W", "Th", "F", "Sa"]

export default function AssignmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter();
  const isMobile = useMobile()
  const [people, setPeople] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  // Local state for number per day inputs, keyed by groupId (now stores number | null)
  const [localNumPerDaySettings, setLocalNumPerDaySettings] = useState<Record<string, number | null>>({});
  const [isSavingNumPerDay, setIsSavingNumPerDay] = useState<string | null>(null); // groupId being saved

  // State for Add Person Dialog
  const [isAddPersonDialogOpen, setIsAddPersonDialogOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [isAddingPerson, setIsAddingPerson] = useState(false); // Loading state for submission

  // State for Add Group Dialog
  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // State for Person Actions Dialog
  const [isPersonActionsDialogOpen, setIsPersonActionsDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  // State for inline editing within Person Actions Dialog
  const [isEditingPersonName, setIsEditingPersonName] = useState(false);
  const [editingPersonNameValue, setEditingPersonNameValue] = useState("");
  const [isSavingPersonName, setIsSavingPersonName] = useState(false);
  const [editPersonNameError, setEditPersonNameError] = useState<string | null>(null);
  // State for Merge Conflict
  const [conflictingPerson, setConflictingPerson] = useState<Person | null>(null);
  const [isMergingPerson, setIsMergingPerson] = useState(false);

  // State for Delete Person Confirmation Dialog
  const [isDeletePersonConfirmOpen, setIsDeletePersonConfirmOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);
  const [deletePersonError, setDeletePersonError] = useState<string | null>(null);

  // State for Group Actions Dialog
  const [isGroupActionsDialogOpen, setIsGroupActionsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  // State for inline editing within Group Actions Dialog
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editingGroupNameValue, setEditingGroupNameValue] = useState("");
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [editGroupNameError, setEditGroupNameError] = useState<string | null>(null);

  const [isAssigningPerson, setIsAssigningPerson] = useState<string | null>(null); // Store personId being assigned
  const [isUpdatingDays, setIsUpdatingDays] = useState<string | null>(null); // Store groupId being updated
  const [isRemovingPersonId, setIsRemovingPersonId] = useState<string | null>(null); // Store personId being removed

  // State for Delete Group Confirmation Dialog
  const [isDeleteGroupConfirmOpen, setIsDeleteGroupConfirmOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const [deleteGroupMembersOption, setDeleteGroupMembersOption] = useState<"unassign" | "delete">("unassign");

  // NEW: State for Person Details Modal
  const [isPersonDetailsModalOpen, setIsPersonDetailsModalOpen] = useState(false);
  const [selectedPersonForDetails, setSelectedPersonForDetails] = useState<Person | null>(null);
  const [personPrayerRequests, setPersonPrayerRequests] = useState<PrayerRequest[]>([]);
  const [personFollowUps, setPersonFollowUps] = useState<FollowUp[]>([]);
  const [isLoadingPersonDetails, setIsLoadingPersonDetails] = useState(false);
  const [personDetailsError, setPersonDetailsError] = useState<string | null>(null);

  // NEW: State for formatted date string
  const [currentDateString, setCurrentDateString] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

  // --- DND Kit Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- DND Kit Drag End Handler ---
  const handleDragEnd = async (event: DragEndEvent) => { // Make async
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Determine the new order locally first
      const oldIndex = groups.findIndex((item) => item.id === active.id);
      const newIndex = groups.findIndex((item) => item.id === over.id);
      
      // Check if indices are valid before proceeding
      if (oldIndex === -1 || newIndex === -1) {
        console.error("Could not find dragged item or drop target in state.");
        return; 
      }

      const newOrderedGroups = arrayMove(groups, oldIndex, newIndex);

      // Optimistic UI Update: Update local state immediately
      setGroups(newOrderedGroups);
      console.log(`Group ${active.id} moved locally from index ${oldIndex} to ${newIndex}`);
      console.log("New Local Order:", newOrderedGroups.map(g => ({ id: g.id, name: g.name })));

      // --- Persist the new order in Firestore --- 
      try {
        const batch = writeBatch(db);
        newOrderedGroups.forEach((group, index) => {
          // Only update if the order actually changed or if it's missing
          // Note: Comparing floating point numbers directly can be tricky, 
          // but integer indices should be fine.
          const currentGroupInOldOrder = groups.find(g => g.id === group.id);
          if (currentGroupInOldOrder?.order !== index || group.order === undefined) {
             console.log(`Updating order for ${group.id} to ${index}`);
             const groupRef = doc(db, "groups", group.id);
             batch.update(groupRef, { order: index }); // Set order based on new array index
          }
        });
        await batch.commit();
        console.log("Successfully updated group order in Firestore.");

        // Optional: Re-fetch or update local state order fields if needed after commit,
        // but the optimistic update should cover most cases.
        // setGroups(newOrderedGroups.map((g, index) => ({...g, order: index })));

      } catch (error) {
        console.error("Error updating group order in Firestore:", error);
        // TODO: Consider reverting the optimistic UI update on error
        // setGroups(groups); // Revert to the order before the drag
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

  // Toggle expanded state for a group - remains the same
  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId)
  }

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

  // Toggle selection type for group - Needs Firestore update
  const toggleSelectionType = (groupId: string, type: "random" | "recent" | "all") => {
    // TODO: Replace with Firestore updateDoc for the specific group
    console.log(`Set selection type to ${type} for group ${groupId} (needs Firestore implementation)`);
  }
  
  // Add Person Submit Handler
  const handleAddPersonSubmit = async (e: FormEvent, groupIdToAssign?: string) => {
    e.preventDefault();
    if (!newPersonName.trim() || !user) return;

    setIsAddingPerson(true);

    try {
      const newPersonData: { name: string; createdBy: string; createdAt: any; groupId?: string } = {
        name: newPersonName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      };

      // If assigning to a specific group immediately
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
          numPerDay: 1,
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
        prayerSettings: newGroupData.prayerSettings,
        createdAt: Timestamp.now(), // Use client-side timestamp for immediate update
        order: newGroupData.order
      };
      setGroups(prev => [...prev, groupForState]); 

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
  
  // Add Group - Needs Firestore add
  const handleAddGroup = () => {
    // TODO: Implement adding a group (likely involves a dialog/form and Firestore addDoc)
     console.log("Add Group clicked (needs implementation)");
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
  
  // Add Person to Specific Group - Needs Firestore update
  const handleAddPersonToGroup = (groupId: string) => {
    // Reuse Add Person dialog, passing groupId
    setNewPersonName(""); // Clear name from previous attempts
    setIsAddPersonDialogOpen(true);
    // We'll handle the group assignment within handleAddPersonSubmit
    // Need a way to know which group this button was clicked for - maybe pass groupId to dialog?
    // Or, simpler: have a separate button state/handler?
    // Let's adjust handleAddPersonSubmit to optionally accept groupId
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
  const [isUpdatingTodaysList, setIsUpdatingTodaysList] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdatingAndReturning, setIsUpdatingAndReturning] = useState(false); // State for new FAB action

  const handleUpdateTodaysList = async () => {
    if (!user) return;
    setUpdateError(null);

    const confirmation = confirm("This will recalculate today's shared prayer list based on current settings for ALL devices. Continue?");
    if (!confirmation) return;

    setIsUpdatingTodaysList(true);
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0];
    const userId = user.uid;
    const cacheKey = `prayerApp_dailyCache_${userId}`;

    console.log(`[Update Button] Starting update for user ${userId}, date ${dateKey}`);

    try {
        // 1. Clear local session storage cache
        if (typeof window !== 'undefined') {
            const storedSessionCache = sessionStorage.getItem(cacheKey);
            const loadedSessionCache = parseMapWithSets(storedSessionCache);
            if (loadedSessionCache.has(dateKey)) {
                loadedSessionCache.delete(dateKey);
                sessionStorage.setItem(cacheKey, stringifyMapWithSets(loadedSessionCache));
                console.log(`[Update Button] Cleared session storage entry for ${dateKey}`);
            }
        }

        // 2. Clear central Firestore cache document (using NEW path)
        const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
        try {
             await deleteDoc(dailyListRef);
             console.log(`[Update Button] Deleted Firestore document at path ${dailyListRef.path} (if it existed).`);
        } catch (deleteError) {
             console.warn(`[Update Button] Could not delete Firestore doc (may not exist or other issue):`, deleteError);
             // Continue even if delete fails (might not exist)
        }

        // 3. Recalculate and save the list using the utility function
        console.log(`[Update Button] Calling calculation function...`);
        await calculateAndSaveDailyPrayerList(db, userId, today);
        console.log(`[Update Button] Calculation function finished successfully.`);

        alert("Today's shared prayer list has been updated based on the current settings.");

    } catch (error) {
        console.error("[Update Button] Error during update process:", error);
        setUpdateError("Failed to update today's prayer list. Please try again.");
        alert("An error occurred while updating the prayer list. Check console for details.");
    } finally {
        setIsUpdatingTodaysList(false);
    }
  };

  // --- New Handler for FAB: Update and Navigate Back ---
  const handleUpdateAndGoBack = async () => {
    if (!user || isUpdatingAndReturning) return;
    setIsUpdatingAndReturning(true);
    setUpdateError(null); // Clear previous errors

    const today = new Date();
    const dateKey = today.toISOString().split('T')[0];
    const userId = user.uid;
    const cacheKey = `prayerApp_dailyCache_${userId}`;

    console.log(`[FAB] Starting update and return for user ${userId}, date ${dateKey}`);

    try {
        // 1. Clear local session storage cache
        if (typeof window !== 'undefined') {
            const storedSessionCache = sessionStorage.getItem(cacheKey);
            const loadedSessionCache = parseMapWithSets(storedSessionCache);
            if (loadedSessionCache.has(dateKey)) {
                loadedSessionCache.delete(dateKey);
                sessionStorage.setItem(cacheKey, stringifyMapWithSets(loadedSessionCache));
                console.log(`[FAB] Cleared session storage entry for ${dateKey}`);
            }
        }

        // 2. Clear central Firestore cache document
        const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
        try {
             await deleteDoc(dailyListRef);
             console.log(`[FAB] Deleted Firestore document at path ${dailyListRef.path} (if it existed).`);
        } catch (deleteError) {
             console.warn(`[FAB] Could not delete Firestore doc (may not exist or other issue):`, deleteError);
        }

        // 3. Recalculate and save the list
        console.log(`[FAB] Calling calculation function...`);
        await calculateAndSaveDailyPrayerList(db, userId, today);
        console.log(`[FAB] Calculation function finished successfully.`);

        // 4. Navigate back to prayer page
        router.push('/prayer');

    } catch (error) {
        console.error("[FAB] Error during update and return process:", error);
        setUpdateError("Failed to update prayer list before returning. Please try returning manually.");
        // Don't navigate if update failed, show error on assignments page
    } finally {
        setIsUpdatingAndReturning(false);
    }
  };

  // NEW: Fetch details for a specific person
  const fetchPersonDetails = async (personId: string) => {
    if (!user) return;
    console.log("Fetching details for person:", personId);
    setIsLoadingPersonDetails(true);
    setPersonDetailsError(null);
    setPersonPrayerRequests([]); // Clear previous data
    setPersonFollowUps([]);      // Clear previous data

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
            <Button 
               variant="default"
               size="sm" 
               onClick={handleUpdateAndGoBack} 
               disabled={isUpdatingAndReturning}
            >
               {isUpdatingAndReturning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
               {isUpdatingAndReturning ? "Returning..." : "Update"}
            </Button>
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
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{person.name}</span>
                        </div>

                        {/* --- Assign to Group Dropdown --- */}
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
                        {/* --- End Assign to Group Dropdown --- */}

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
                        const isExpanded = expandedGroupId === group.id;
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
                            expandedGroupId={expandedGroupId}
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
            <DialogTitle>Details for {selectedPersonForDetails?.name}</DialogTitle>
            <DialogDescription>
              Prayer requests and follow-ups associated with this person.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {isLoadingPersonDetails ? (
              <div className="flex justify-center items-center min-h-[100px]">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : personDetailsError ? (
              <p className="text-sm text-center text-destructive">{personDetailsError}</p>
            ) : (
              <div className="space-y-6">
                 {/* Prayer Requests Section */}
                 <div>
                   <h3 className="text-md font-semibold mb-2 border-b pb-1">Prayer Requests</h3>
                   {personPrayerRequests.length > 0 ? (
                     <ul className="space-y-2 list-disc pl-5">
                       {personPrayerRequests.map(req => (
                         <li key={req.id} className="text-sm text-muted-foreground">
                           {req.content} 
                           <span className="text-xs ml-2">({req.createdAt instanceof Timestamp ? req.createdAt.toDate().toLocaleDateString() : 'Date N/A'})</span>
                         </li>
                       ))}
                     </ul>
                   ) : (
                     <p className="text-sm text-center text-muted-foreground italic py-2">No prayer requests found.</p>
                   )}
                 </div>

                 {/* Follow Ups Section */}
                 <div>
                   <h3 className="text-md font-semibold mb-2 border-b pb-1">Follow-ups</h3>
                   {personFollowUps.length > 0 ? (
                     <ul className="space-y-2 list-disc pl-5">
                       {personFollowUps.map(fu => (
                         <li key={fu.id} className="text-sm text-muted-foreground">
                            {fu.content} 
                            <span className="text-xs ml-2"> (Due: {fu.dueDate instanceof Timestamp ? fu.dueDate.toDate().toLocaleDateString() : 'Date N/A'}, Status: {fu.completed ? 'Completed' : 'Pending'})</span>
                         </li>
                       ))}
                     </ul>
                   ) : (
                     <p className="text-sm text-center text-muted-foreground italic py-2">No follow-ups found.</p>
                   )}
                 </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

