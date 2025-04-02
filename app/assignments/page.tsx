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
import { ChevronDown, ChevronUp, Plus, User, UserPlus, X, Users, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore'
import type { Person, Group } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

export default function AssignmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State for Add Person Dialog
  const [isAddPersonDialogOpen, setIsAddPersonDialogOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [isAddingPerson, setIsAddingPerson] = useState(false); // Loading state for submission

  // State for Add Group Dialog
  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  const [isAssigningPerson, setIsAssigningPerson] = useState<string | null>(null); // Store personId being assigned

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
  const toggleDayForGroup = (groupId: string, dayIndex: number) => {
    // TODO: Replace with Firestore updateDoc for the specific group
    console.log(`Toggled day ${dayIndex} for group ${groupId} (needs Firestore implementation)`);
  }

  // Toggle selection type for group - Needs Firestore update
  const toggleSelectionType = (groupId: string, type: "random" | "recent" | "all") => {
    // TODO: Replace with Firestore updateDoc for the specific group
    console.log(`Set selection type to ${type} for group ${groupId} (needs Firestore implementation)`);
  }
  
  // Add Person Submit Handler
  const handleAddPersonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim() || !user) return;

    setIsAddingPerson(true);
    setError(null);

    try {
      const newPersonData = {
        name: newPersonName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(), // Add creation timestamp
        // groupId is initially undefined/null for uncategorized
      };
      const docRef = await addDoc(collection(db, "persons"), newPersonData);
      // Add the new person to local state immediately for UI update
      // Note: createdAt won't be available immediately, but we have the ID
      setPeople(prev => [...prev, { id: docRef.id, ...newPersonData, createdAt: Timestamp.now() } as unknown as Person]); // Use type assertion carefully
      setNewPersonName(""); // Clear input
      setIsAddPersonDialogOpen(false); // Close dialog
      console.log("Person added with ID: ", docRef.id);
    } catch (err) {
      console.error("Error adding person:", err);
      setError("Failed to add person. Please try again.");
      // Keep dialog open on error?
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
        prayerSettings: { type: "all" }, // Default setting
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "groups"), newGroupData);
      // Add the new group to local state
      setGroups(prev => [...prev, { id: docRef.id, ...newGroupData, createdAt: Timestamp.now() } as unknown as Group]); // Use type assertion carefully
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

  // Assign Person to Group - Implement Firestore update
  const handleAssignPersonToGroup = async (personId: string, groupId: string) => {
     if (!user || isAssigningPerson) return; // Prevent concurrent updates

     console.log(`Assigning person ${personId} to group ${groupId}`);
     setIsAssigningPerson(personId); // Set loading state for this person
     setError(null);

     try {
       const personRef = doc(db, "persons", personId);
       await updateDoc(personRef, {
         groupId: groupId
       });

       // Optimistic UI Update: Move person locally
       setPeople(prevPeople =>
         prevPeople.map(p =>
           p.id === personId ? { ...p, groupId: groupId } : p
         )
       );
       console.log(`Person ${personId} assigned to group ${groupId} successfully.`);

     } catch (err) {
       console.error("Error assigning person:", err);
       setError(`Failed to assign person. Please try again.`);
       // Optionally revert optimistic update here if needed
     } finally {
       setIsAssigningPerson(null); // Clear loading state
     }
  };
  
  // Add Group - Needs Firestore add
  const handleAddGroup = () => {
    // TODO: Implement adding a group (likely involves a dialog/form and Firestore addDoc)
     console.log("Add Group clicked (needs implementation)");
  };
  
  // Remove Person from Group - Needs Firestore update
  const handleRemovePersonFromGroup = (personId: string, groupId: string) => {
    // TODO: Implement removing person from group (update Person doc, potentially update Group doc)
     console.log(`Remove person ${personId} from group ${groupId} (needs implementation)`);
  };
  
  // Add Person to Specific Group - Needs Firestore update
  const handleAddPersonToGroup = (groupId: string) => {
     // TODO: Implement adding person to a specific group (likely involves a dialog/form selecting existing people or adding new, then update Firestore)
     console.log(`Add Person to group ${groupId} clicked (needs implementation)`);
  };

  const isLoading = authLoading || loadingData

  return (
    <div className="mobile-container pb-16 md:pb-6">
      <div className="mb-4 md:mb-6">
        <h1 className="page-title">Prayer Assignments</h1>
        <p className="page-description">Manage groups and prayer day assignments</p>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <Tabs defaultValue="people" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="people">People & Groups</TabsTrigger>
          <TabsTrigger value="days">Groups & Days</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-6">
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
                    <form onSubmit={handleAddPersonSubmit}>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Groups</h2>
            {/* --- Add Group Dialog Trigger --- */}
            <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
              <DialogTrigger asChild>
                 <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90" disabled={isLoading || !user}>
                  <Plus className="h-4 w-4" />
                  New Group
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
            {/* --- End Add Group Dialog --- */}
          </div>

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
                              >
                                <X className="h-4 w-4" />
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

        <TabsContent value="days" className="space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Create groups first to assign prayer days
            </div>
          ) : (
            groups.map((group) => (
              <Card key={group.id} className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{group.name}</CardTitle>
                    </div>
                    <Badge variant="outline">{getPeopleInGroup(group.id).length} people</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Prayer Days:</h3>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day, index) => (
                        <Button
                          key={index}
                          variant={group.prayerDays.includes(index) ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-9 w-9 p-0 md:h-10 md:w-10",
                            group.prayerDays.includes(index) && "bg-shrub hover:bg-shrub/90",
                          )}
                          onClick={() => toggleDayForGroup(group.id, index)}
                        >
                          {day.charAt(0)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Selection Method:</h3>
                    <div className="flex gap-2">
                      <Button
                        variant={group.prayerSettings.type === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSelectionType(group.id, "all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={group.prayerSettings.type === "random" ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSelectionType(group.id, "random")}
                      >
                        Random
                      </Button>
                      <Button
                        variant={group.prayerSettings.type === "recent" ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSelectionType(group.id, "recent")}
                      >
                        Least Recent
                      </Button>
                    </div>
                  </div>

                  {group.prayerSettings.type === "random" && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">People per day:</h3>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{group.prayerSettings.count || 1}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

