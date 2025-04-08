"use client"

import { useState, useEffect, FormEvent } from "react"
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
import { ChevronDown, ChevronUp, Plus, User, UserPlus, X, Users, Minus, Loader2, Check, MoreVertical, Trash2, Edit, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, writeBatch, arrayRemove, deleteField } from 'firebase/firestore'
import type { Person, Group } from '@/lib/types'
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
  const isMobile = useMobile()
  const [people, setPeople] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!authLoading && user) {
      const fetchData = async () => {
        setLoadingData(true)
        setError(null)
        try {
          const userId = user.uid

          // Fetch People created by the user
          const peopleQuery = query(collection(db, "persons"), where("createdBy", "==", userId))
          const peopleSnapshot = await getDocs(peopleQuery)
          const peopleData = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person))
          setPeople(peopleData)
          console.log("Fetched People:", peopleData)

          // Fetch Groups created by the user
          const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId))
          const groupsSnapshot = await getDocs(groupsQuery)
          const groupsData = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group))
          setGroups(groupsData)
          console.log("Fetched Groups:", groupsData)

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
          setError("Failed to load assignment data. Please try again later.")
        } finally {
          setLoadingData(false)
        }
      }
      fetchData()
    } else if (!authLoading && !user) {
      // Handle case where user is not logged in after loading is finished
      setLoadingData(false)
      setError("Please log in to view assignments.")
      // Optionally redirect to login page
      setPeople([])
      setGroups([])
      setLocalNumPerDaySettings({}) // Clear settings if logged out
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
    setError(null);

    // Find the current group's data
    const group = groups.find(g => g.id === groupId);
    if (!group) {
        console.error("Group not found locally!");
        setError("Could not update days: Group not found.");
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
      console.log(`Prayer days updated for group ${groupId}.`);

    } catch (err) {
      console.error("Error updating prayer days:", err);
      setError(`Failed to update prayer days for ${group.name}. Please try again.`);
      // Optionally revert optimistic update here if needed
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
    setError(null);

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
      setError("Failed to add person. Please try again.");
    } finally {
      setIsAddingPerson(false);
    }
  };

  // Add Group Submit Handler
  const handleAddGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    setIsAddingGroup(true);
    setError(null);

    try {
      const newGroupData = {
        name: newGroupName.trim(),
        createdBy: user.uid,
        personIds: [], // Start with no people
        prayerDays: [], // Start with no days assigned
        // Use the updated prayerSettings structure with defaults
        prayerSettings: {
          strategy: "sequential",
          numPerDay: 1,
          nextIndex: 0
        },
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "groups"), newGroupData);
      // Add the new group to local state
      setGroups(prev => [...prev, { id: docRef.id, ...newGroupData, createdAt: Timestamp.now() } as Group]); // Use type assertion carefully
      setNewGroupName(""); // Clear input
      setIsAddGroupDialogOpen(false); // Close dialog
      console.log("Group added with ID: ", docRef.id);
    } catch (err) {
      console.error("Error adding group:", err);
      setError("Failed to add group. Please try again.");
    } finally {
      setIsAddingGroup(false);
    }
  };

  // Assign Person to Group - Implement Firestore update for BOTH Person and Group
  const handleAssignPersonToGroup = async (personId: string, groupId: string) => {
     if (!user || isAssigningPerson) return; // Prevent concurrent updates

     console.log(`Assigning person ${personId} to group ${groupId}`);
     setIsAssigningPerson(personId); // Set loading state for this person
     setError(null);

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
       setError(`Failed to assign person. Please try again.`);
       // No need to revert optimistic update unless critical, as refetch will correct.
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
     setError(null);

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
       setError(`Failed to remove person. Please try again.`);
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
    setError(null);

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
      setError(`Failed to update settings for group ${originalGroup?.name ?? groupId}. Reverting input.`);
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
      // Keep the main dialog open to show success/updated name
      // setIsPersonActionsDialogOpen(false); 

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

      console.log(`Person "${personName}" (${personId}) deleted successfully.`);

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

      console.log(`Group ${groupId} name updated to ${newName}`);

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

      console.log(`Group "${groupName}" (${groupId}) deleted successfully. Members handled: ${deleteGroupMembersOption}`);

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

  return (
    <div className="mobile-container pb-16 md:pb-6">
      {/* NEW Consistent Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="page-title">Assignments</h1>
        {/* MOVED Add Group Dialog Trigger and Content Here */}
        <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
          <DialogTrigger asChild>
             <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90" disabled={isLoading || !user}>
              <Plus className="h-4 w-4" />
              Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
             <form onSubmit={handleAddGroupSubmit}>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogDescription>
                  Enter a name for your new prayer group.
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
                   {isAddingGroup ? "Creating..." : "Create Group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {/* REMOVED Old Header Div */}

      {error && <p className="text-shrub text-center mb-4">{error}</p>}

      <Tabs defaultValue="people-groups">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="people-groups">People & Groups</TabsTrigger>
          <TabsTrigger value="groups-days">Groups & Days</TabsTrigger>
        </TabsList>

        <TabsContent value="people-groups" className="space-y-6">
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

          {/* Groups Section */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No groups created yet
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {groups.map((group) => (
                <Card key={group.id} className="mb-4">
                  {/* Make header clickable for expand/collapse */}
                  <CardHeader className="pb-3 pt-4 px-4 cursor-pointer" onClick={() => toggleExpandGroup(group.id)}>
                    <div className="flex items-center justify-between">
                      {/* Group Name & Icon - Clickable for Actions */}
                      <div 
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card header click (expand/collapse)
                          openGroupActionsDialog(group);
                        }}
                      >
                        <Users className="h-5 w-5 text-primary" />
                        {/* Add hover effect to name only */}
                        <CardTitle className="text-base hover:underline">{group.name}</CardTitle>
                        <Badge variant="outline" className="ml-2">
                          {getPeopleInGroup(group.id).length} people
                        </Badge>
                      </div>
                      {/* Expand/Collapse Icon */}
                      {expandedGroupId === group.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedGroupId === group.id && (
                    <CardContent className="pt-0">
                      {getPeopleInGroup(group.id).length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">No people in this group</p>
                      ) : (
                        <div className="space-y-2 mb-4">
                          {/* Render people in the group */}
                          {getPeopleInGroup(group.id).map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                            >
                              {/* Make the name + icon clickable */} 
                              <div 
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => openPersonActionsDialog(person)}
                              >
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{person.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Connect handleAddPersonToGroup */}
                      <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => handleAddPersonToGroup(group.id)}>
                        <UserPlus className="h-4 w-4" />
                        Add Person to Group
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups-days" className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground text-center py-8">
                Create groups first to assign prayer days and settings.
              </CardContent>
            </Card>
          ) :
            groups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const currentNumSetting = localNumPerDaySettings[group.id];
              const displayDays = isMobile ? DAYS_OF_WEEK_MOBILE : DAYS_OF_WEEK;
              const groupSize = group.personIds?.length ?? 0; // Get group size, default 0

              return (
              <Card key={group.id} className="mb-4 overflow-hidden">
                <CardHeader
                  className="pb-3 pt-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                >
                  {/* --- Add Group Icon --- */}
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary flex-shrink-0" />
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                  </div>
                  {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4 pt-2 pb-4 px-4 border-t">
                     <div>
                       <p className="text-sm text-muted-foreground mb-3">Select prayer days:</p>
                       <div className="flex flex-wrap gap-2">
                          {displayDays.map((day, index) => {
                            const isSelected = group.prayerDays?.includes(index);
                            const isUpdatingThisGroup = isUpdatingDays === group.id;
                            return (
                              <Button
                                key={index}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDayForGroup(group.id, index)
                                }}
                                disabled={isLoading || isUpdatingThisGroup}
                                className={cn(
                                   "w-10 md:w-12",
                                   isSelected && "bg-shrub hover:bg-shrub/90",
                                   isUpdatingThisGroup && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {day}
                              </Button>
                            );
                          })}
                        </div>
                        {isUpdatingDays === group.id && <p className="text-xs text-muted-foreground mt-2">Updating days...</p>}
                     </div>

                     <div className="pt-2">
                       <Label className="text-sm text-muted-foreground block mb-2">People per day:</Label>
                       <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-[100px] justify-start font-normal"
                                disabled={isLoading || isSavingNumPerDay === group.id}
                              >
                                {isSavingNumPerDay === group.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <span>{currentNumSetting === null ? "All" : currentNumSetting}</span>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[100px]">
                              {/* Make content scrollable vertically ONLY */}
                              <div className="max-h-[200px] overflow-y-auto overflow-x-hidden"> {/* Added overflow-x-hidden */}
                                <DropdownMenuRadioGroup
                                  value={currentNumSetting == null ? "all" : currentNumSetting.toString()}
                                  onValueChange={(value) => {
                                    const newValue = value === "all" ? null : parseInt(value, 10);
                                    handleNumPerDayChange(group.id, newValue);
                                  }}
                                >
                                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                                  {/* Only show numbers if group has members */}
                                  {groupSize > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {/* Generate options up to group size */}
                                      {Array.from({ length: groupSize }, (_, i) => i + 1).map(num => (
                                          <DropdownMenuRadioItem key={num} value={num.toString()}>{num}</DropdownMenuRadioItem>
                                      ))}
                                    </>
                                  )}
                                </DropdownMenuRadioGroup>
                               </div> {/* Close scroll wrapper */}
                            </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                     </div>
                  </CardContent>
                )}
              </Card>
            )}
          )}
        </TabsContent>
      </Tabs>

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

          {/* Conditional Rendering: Show edit form or action buttons */} 
          {isEditingPersonName ? (
            // --- Edit Name Form --- 
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
                  {/* Show Merge button if there's a conflict */}
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
                {/* Show Save Changes button ONLY if no conflict exists */}
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
            // --- Action Buttons --- 
            <div className="py-4 space-y-2">
              {/* Remove from Group Button */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  if (selectedPerson?.id && selectedPerson?.groupId) {
                    handleRemovePersonFromGroup(selectedPerson.id, selectedPerson.groupId);
                    setIsPersonActionsDialogOpen(false); // Close dialog after action
                  }
                }}
                disabled={!selectedPerson?.groupId || !!isRemovingPersonId || isAssigningPerson === selectedPerson?.id}
              >
                <LogOut className="h-4 w-4" />
                Remove from Group
                {isRemovingPersonId === selectedPerson?.id && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>

              {/* --- Move to Another Group Dropdown --- */} 
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2" 
                    disabled={groups.length <= 1 || !selectedPerson || isAssigningPerson === selectedPerson?.id || isRemovingPersonId === selectedPerson?.id}
                  >
                    <Users className="h-4 w-4" /> {/* Using Users icon */} 
                    Move to Another Group
                    {isAssigningPerson === selectedPerson?.id && <Loader2 className="h-4 w-4 animate-spin ml-auto" />} 
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                  <DropdownMenuLabel>Move {selectedPerson?.name} to:</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {groups
                    .filter(group => group.id !== selectedPerson?.groupId) // Filter out current group
                    .map((group) => (
                      <DropdownMenuItem
                        key={group.id}
                        onSelect={() => {
                          if (selectedPerson?.id) {
                             handleAssignPersonToGroup(selectedPerson.id, group.id);
                             setIsPersonActionsDialogOpen(false); // Close dialog after selection
                          }
                        }}
                        disabled={isAssigningPerson === selectedPerson?.id} // Disable during assignment
                      >
                        {group.name}
                      </DropdownMenuItem>
                  ))}
                  {/* Show message if no other groups exist */}
                  {groups.filter(group => group.id !== selectedPerson?.groupId).length === 0 && (
                    <DropdownMenuItem disabled>No other groups available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* --- End Move to Another Group Dropdown --- */} 

              {/* Edit Name Button */}
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2" 
                onClick={() => {
                  if (selectedPerson) {
                     setEditingPersonNameValue(selectedPerson.name); 
                     setIsEditingPersonName(true);
                     setEditPersonNameError(null); // Clear previous errors
                  }
                }}
                disabled={!!isRemovingPersonId || isSavingPersonName} // Disable if other actions are happening
              >
                <Edit className="h-4 w-4" />
                Edit Name
              </Button>
              {/* Delete Person Button */}
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 text-shrub border-shrub hover:bg-shrub/10 hover:text-shrub"
                onClick={() => {
                   if (selectedPerson) {
                      // Open Delete Confirmation Dialog instead of direct delete
                      handleDeletePersonClick(selectedPerson);
                   }
                }}
                disabled={!!isRemovingPersonId || isSavingPersonName || isDeletingPerson} // Disable if other actions are happening
               >
                <Trash2 className="h-4 w-4" />
                Delete Person
              </Button>
            </div>
          )}

          {/* Hide footer when editing */} 
          {!isEditingPersonName && (
             <DialogFooter>
               <DialogClose asChild>
                 <Button variant="ghost">Cancel</Button>
               </DialogClose>
             </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Person Confirmation Dialog */} 
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

      {/* Group Actions Dialog */} 
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
             // --- Edit Group Name Form --- 
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
            // --- Group Action Buttons --- 
            <div className="py-4 space-y-2">
              {/* Edit Group Name Button */}
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
                disabled={isSavingGroupName /* TODO: || isDeletingGroup */} 
              >
                <Edit className="h-4 w-4" />
                Edit Group Name
              </Button>
              {/* Delete Group Button */} 
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
          
          {/* Hide footer when editing */} 
          {!isEditingGroupName && (
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */} 
      <AlertDialog open={isDeleteGroupConfirmOpen} onOpenChange={setIsDeleteGroupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group: {selectedGroup?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
             <div className="space-y-3"> {/* Wrap content in div */}
               <span>This action cannot be undone. What should happen to the <strong>{selectedGroup?.personIds?.length ?? 0} people</strong> in this group?</span>
              
              {/* Radio Group for Member Options */} 
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

      {/* TODO: Add Edit Group Name Dialog/UI */} 

    </div>
  )
}

