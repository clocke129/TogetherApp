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
import { ChevronDown, ChevronUp, Plus, User, UserPlus, X, Users, Minus, Loader2, Check } from "lucide-react"
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

  const [isAssigningPerson, setIsAssigningPerson] = useState<string | null>(null); // Store personId being assigned
  const [isUpdatingDays, setIsUpdatingDays] = useState<string | null>(null); // Store groupId being updated
  const [isRemovingPersonId, setIsRemovingPersonId] = useState<string | null>(null); // Store personId being removed

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
     // TODO: Implement adding person to a specific group (likely involves a dialog/form selecting existing people or adding new, then update Firestore)
     console.log(`Add Person to group ${groupId} clicked (needs implementation)`);
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

  const isLoading = authLoading || loadingData

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

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

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
                  <CardHeader className="pb-3 pt-4 px-4 cursor-pointer" onClick={() => toggleExpandGroup(group.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <Badge variant="outline" className="ml-2">
                          {getPeopleInGroup(group.id).length} people
                        </Badge>
                      </div>
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
                          {getPeopleInGroup(group.id).map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{person.name}</span>
                              </div>
                              {/* Connect handleRemovePersonFromGroup */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemovePersonFromGroup(person.id, group.id)}
                                disabled={isLoading || isRemovingPersonId === person.id}
                              >
                                {isRemovingPersonId === person.id ? (
                                   <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                 ) : (
                                   <X className="h-4 w-4" />
                                 )}
                              </Button>
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
                                  value={currentNumSetting === null ? "all" : currentNumSetting.toString()}
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
    </div>
  )
}

