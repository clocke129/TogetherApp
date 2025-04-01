"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, AlertTriangle, User, Check, Plus, Repeat, CalendarPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { Textarea } from "@/components/ui/textarea"

// Types
type Person = {
  id: string
  name: string
}

type RecurringPattern = {
  type: "daily" | "weekly" | "monthly" | "yearly"
  interval: number
}

type FollowUp = {
  id: string
  personId: string
  content: string
  dueDate: Timestamp
  completed: boolean
  isRecurring?: boolean
  recurringPattern?: RecurringPattern
}

export default function FollowupsPage() {
  // State for data
  const [peopleMap, setPeopleMap] = useState<Record<string, string>>({})
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize newFollowUp with default/empty values
  const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUp>>({
    content: "",
    personId: "",
    dueDate: Timestamp.now(),
    completed: false,
    isRecurring: false,
    recurringPattern: {
      type: "weekly",
      interval: 1,
    },
  })
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const { user } = useAuth()

  // --- Data Fetching --- //
  useEffect(() => {
    if (!user) {
      console.log("No user logged in, skipping data fetch.")
      setFollowUps([])
      setPeopleMap({})
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      console.log("Fetching data for user:", user.uid)
      setIsLoading(true)
      try {
        // 1. Fetch People created by this user
        const peopleQuery = query(
          collection(db, "persons"),
          where("createdBy", "==", user.uid)
        )
        const peopleSnapshot = await getDocs(peopleQuery)
        const fetchedPeople: Person[] = []
        const tempPeopleMap: Record<string, string> = {}
        peopleSnapshot.forEach((doc) => {
          const personData = doc.data() as Omit<Person, "id">
          fetchedPeople.push({ id: doc.id, ...personData })
          tempPeopleMap[doc.id] = personData.name
        })
        setPeopleMap(tempPeopleMap)
        console.log("Fetched people map:", tempPeopleMap)

        // 2. Fetch FollowUps for each person
        let allFollowUps: FollowUp[] = []
        for (const person of fetchedPeople) {
          // Consider adding orderBy('dueDate') or similar if needed
          const followUpsQuery = query(collection(db, "persons", person.id, "followUps"))
          const followUpsSnapshot = await getDocs(followUpsQuery)
          followUpsSnapshot.forEach((doc) => {
            // Type assertion, assuming data matches FollowUp structure
            allFollowUps.push({ id: doc.id, ...(doc.data() as Omit<FollowUp, "id">) })
          })
        }
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

  // Get person name by ID using the map
  const getPersonNameById = (personId: string): string => {
    return peopleMap[personId] || "Unknown Person"
  }

  // Toggle follow-up completion
  const toggleFollowUpCompletion = async (followUpId: string) => {
    console.log(`Toggling completion for follow-up ID: ${followUpId}`);
    // Find the full followUp object to get the personId
    const followUpToUpdate = followUps.find(fu => fu.id === followUpId);
    if (!followUpToUpdate) {
      console.error("Could not find follow-up to toggle.");
      return;
    }

    const docRef = doc(db, "persons", followUpToUpdate.personId, "followUps", followUpId);
    try {
      await updateDoc(docRef, {
        completed: !followUpToUpdate.completed,
        // Optionally add completedAt timestamp
        // completedAt: !followUpToUpdate.completed ? serverTimestamp() : null 
      });
      console.log("Toggle successful.");
      // Update local state immediately for responsiveness
      setFollowUps(prev => prev.map(fu => 
        fu.id === followUpId ? { ...fu, completed: !fu.completed } : fu
      ));
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

  // Get current time as a Timestamp for comparisons
  const now = Timestamp.now();
  const epochZeroTimestamp = Timestamp.fromDate(new Date(0));

  // Filter logic using Timestamps
  const overdueFollowUps = followUps.filter(
    (followUp) =>
      !followUp.completed &&
      followUp.dueDate < now &&
      followUp.dueDate.seconds !== epochZeroTimestamp.seconds // Check against epoch zero
  );

  const upcomingFollowUps = followUps.filter(
    (followUp) => !followUp.completed && followUp.dueDate >= now
  );

  const noDateFollowUps = followUps.filter(
    (followUp) =>
      !followUp.completed &&
      followUp.dueDate.seconds === epochZeroTimestamp.seconds // Check against epoch zero
  );

  const completedFollowUps = followUps.filter((followUp) => followUp.completed);

  // Get recurring pattern text
  const getRecurringPatternText = (pattern?: RecurringPattern) => {
    if (!pattern) return ""

    switch (pattern.type) {
      case "daily":
        return pattern.interval === 1 ? "Daily" : `Every ${pattern.interval} days`
      case "weekly":
        return pattern.interval === 1 ? "Weekly" : `Every ${pattern.interval} weeks`
      case "monthly":
        return pattern.interval === 1 ? "Monthly" : `Every ${pattern.interval} months`
      case "yearly":
        return pattern.interval === 1 ? "Yearly" : `Every ${pattern.interval} years`
      default:
        return ""
    }
  }

  // Handle adding a new follow-up - will need modification to save to Firestore
  const handleAddFollowUp = async () => {
    if (!newFollowUp.content || !newFollowUp.personId) {
      alert("Please select a person and enter content for the follow-up.");
      return;
    }
    if (!user) {
      alert("You must be logged in to add a follow-up.")
      return;
    }

    console.log("Adding new follow-up:", newFollowUp);
    const collectionRef = collection(db, "persons", newFollowUp.personId, "followUps");
    
    try {
      const docToAdd = {
        personId: newFollowUp.personId,
        content: newFollowUp.content,
        // Ensure dueDate is a Timestamp, default to epoch 0 if needed
        dueDate: newFollowUp.dueDate instanceof Timestamp ? newFollowUp.dueDate : Timestamp.fromDate(new Date(0)), 
        completed: false,
        createdBy: user.uid, // Add createdBy field
        createdAt: serverTimestamp(), // Add createdAt timestamp
        isRecurring: newFollowUp.isRecurring,
        recurringPattern: newFollowUp.isRecurring ? newFollowUp.recurringPattern : undefined,
      };
      
      const docRef = await addDoc(collectionRef, docToAdd);
      console.log("Follow-up added successfully with ID:", docRef.id);

      // Add to local state for responsiveness
      setFollowUps(prev => [...prev, { id: docRef.id, ...docToAdd }]);

      // Reset form and close dialog
      setNewFollowUp({ content: "", personId: "", dueDate: Timestamp.now(), completed: false, isRecurring: false, recurringPattern: { type: "weekly", interval: 1 } });
      setIsAddDialogOpen(false);

    } catch (error) {
      console.error("Error adding follow-up:", error);
      alert("Failed to add follow-up. Please try again.");
    }
  };

  // Handle editing a follow-up - will need modification to update in Firestore
  const handleEditFollowUp = async () => {
    if (!editingFollowUp || !editingFollowUp.id || !editingFollowUp.personId) {
        console.error("Invalid editing follow-up state.");
        alert("Cannot save changes, invalid data.");
        return;
    }

    console.log("Saving edits for follow-up:", editingFollowUp);
    const docRef = doc(db, "persons", editingFollowUp.personId, "followUps", editingFollowUp.id);

    try {
      const dataToUpdate = {
        content: editingFollowUp.content,
        // Ensure dueDate is a Timestamp, default to epoch 0 if needed
        dueDate: editingFollowUp.dueDate instanceof Timestamp ? editingFollowUp.dueDate : Timestamp.fromDate(new Date(0)),
        isRecurring: editingFollowUp.isRecurring,
        recurringPattern: editingFollowUp.isRecurring ? editingFollowUp.recurringPattern : undefined,
        // Note: completed status is toggled separately
      };
      await updateDoc(docRef, dataToUpdate);
      console.log("Follow-up updated successfully.");

      // Update local state for responsiveness
      setFollowUps(prev => prev.map(fu => 
         fu.id === editingFollowUp!.id ? { ...fu, ...dataToUpdate } : fu
      ));

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

  // Set date for a follow-up with no date
  const setDateForFollowUp = (followUpId: string) => {
    const followUp = followUps.find((f) => f.id === followUpId)
    if (followUp) {
      setEditingFollowUp(followUp)
      setIsEditDialogOpen(true)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading Follow-ups...</p></div>
  }

  return (
    <div className="mobile-container pb-16 md:pb-6">
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-description">Track and manage your follow-up items</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90">
              <Plus className="h-4 w-4" />
              Add Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Follow-up</DialogTitle>
              <DialogDescription>Enter the details for the new follow-up item.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="content">Follow-up Item</Label>
                <Input
                  id="content"
                  value={newFollowUp.content}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                  placeholder="What do you need to follow up on?"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="person">Person</Label>
                <Select
                  value={newFollowUp.personId}
                  onValueChange={(value) => setNewFollowUp({ ...newFollowUp, personId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(peopleMap).map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  className="col-span-3"
                  value={formatDateForInput(newFollowUp.dueDate?.toDate() || Timestamp.now().toDate())}
                  onChange={(e) => {
                    const dateValue = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.fromDate(new Date(0));
                    setNewFollowUp({ ...newFollowUp, dueDate: dateValue })
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={newFollowUp.isRecurring}
                  onCheckedChange={(checked) => setNewFollowUp({ ...newFollowUp, isRecurring: checked })}
                />
                <Label htmlFor="recurring">Recurring Follow-up</Label>
              </div>

              {newFollowUp.isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="recurringType">Frequency</Label>
                    <Select
                      value={newFollowUp.recurringPattern?.type}
                      onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") =>
                        setNewFollowUp({
                          ...newFollowUp,
                          recurringPattern: {
                            ...(newFollowUp.recurringPattern as RecurringPattern),
                            type: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="interval">Every</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="1"
                      value={newFollowUp.recurringPattern?.interval || 1}
                      onChange={(e) =>
                        setNewFollowUp({
                          ...newFollowUp,
                          recurringPattern: {
                            ...(newFollowUp.recurringPattern as RecurringPattern),
                            interval: Number.parseInt(e.target.value) || 1,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleAddFollowUp}>Save Follow-up</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Follow-up Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            {editingFollowUp && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Follow-up</DialogTitle>
                  <DialogDescription>Update the details for this follow-up item.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Person (Readonly or Select) */}
                  <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Person</Label>
                     <Input className="col-span-3" readOnly value={getPersonNameById(editingFollowUp.personId)} />
                  </div>
                  {/* Content Textarea */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-content" className="text-right">Content</Label>
                    <Textarea
                      id="edit-content"
                      className="col-span-3"
                      value={editingFollowUp.content}
                      onChange={(e) => {
                        if (!editingFollowUp) return;
                        setEditingFollowUp({ ...editingFollowUp, content: e.target.value })
                      }}
                    />
                  </div>
                  {/* Due Date Input */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-dueDate" className="text-right">Due Date</Label>
                    <Input
                      id="edit-dueDate"
                      type="date"
                      className="col-span-3"
                      value={formatDateForInput(editingFollowUp.dueDate)}
                      onChange={(e) => {
                        if (!editingFollowUp) return;
                        const dateValue = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.fromDate(new Date(0));
                        setEditingFollowUp({ ...editingFollowUp, dueDate: dateValue })
                      }}
                    />
                  </div>
                  {/* Recurring Switch/Settings */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-recurring" className="text-right">Recurring</Label>
                    <Switch
                      id="edit-recurring"
                      checked={editingFollowUp.isRecurring}
                      onCheckedChange={(checked) => {
                        if (!editingFollowUp) return;
                        setEditingFollowUp({
                          ...editingFollowUp,
                          isRecurring: checked,
                          recurringPattern: checked ? editingFollowUp.recurringPattern || { type: "weekly", interval: 1 } : undefined,
                        })
                      }}
                    />
                  </div>
                  {/* Add inputs for recurringPattern if isRecurring is true - TBD if needed */}

                </div>
                <DialogFooter>
                  <Button onClick={handleEditFollowUp}>Save Changes</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Overdue Follow-ups */}
          {overdueFollowUps.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span>Overdue</span>
                  <Badge variant="destructive">{overdueFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {overdueFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonNameById(followUp.personId)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(followUp.dueDate.toDate())}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(followUp)}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Follow-ups */}
          {upcomingFollowUps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-shrub" />
                  <span>Upcoming</span>
                  <Badge variant="outline">{upcomingFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonNameById(followUp.personId)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(followUp.dueDate.toDate())}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(followUp)}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Date Follow-ups */}
          {noDateFollowUps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>No Date Assigned</span>
                  <Badge variant="outline">{noDateFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {noDateFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{getPersonNameById(followUp.personId)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setDateForFollowUp(followUp.id)}>
                        Set Date
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && noDateFollowUps.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No active follow-ups</h3>
              <p className="text-muted-foreground mt-1">All your follow-ups are completed!</p>
              <Button className="mt-4 bg-shrub hover:bg-shrub/90" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Follow-up
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span>Completed</span>
                <Badge variant="outline">{completedFollowUps.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedFollowUps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No completed follow-ups yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="line-through text-muted-foreground cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonNameById(followUp.personId)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

