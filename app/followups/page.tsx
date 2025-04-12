"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, AlertTriangle, User, Check, Plus, CalendarPlus, Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  writeBatch,
} from "firebase/firestore"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

// Types
type Person = {
  id: string
  name: string
}

type FollowUp = {
  id: string
  personId: string
  content: string
  dueDate: Timestamp
  completed: boolean
  archived: boolean
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
    archived: false,
  })
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // --- Filtering and Sorting Logic --- //

  // Get comparison timestamps
  const now = Timestamp.now();
  const sevenDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const epochZeroTimestamp = Timestamp.fromDate(new Date(0));

  // Filter logic using Timestamps
  const activeFollowUps = followUps.filter((followUp) => !followUp.completed && !followUp.archived); // Exclude archived

  const overdueFollowUps = activeFollowUps
    .filter(
      (followUp) =>
        followUp.dueDate < now &&
        followUp.dueDate.seconds !== epochZeroTimestamp.seconds
    )
    .sort((a, b) => a.dueDate.seconds - b.dueDate.seconds); // Sort: Most overdue first

  const thisWeekFollowUps = activeFollowUps
     .filter(
       (followUp) =>
         followUp.dueDate >= now &&
         followUp.dueDate < sevenDaysFromNow
     )
     .sort((a, b) => a.dueDate.seconds - b.dueDate.seconds); // Sort: Soonest first
  
  const futureFollowUps = activeFollowUps
     .filter(
       (followUp) => followUp.dueDate >= sevenDaysFromNow
     )
     .sort((a, b) => a.dueDate.seconds - b.dueDate.seconds); // Sort: Chronological

  const noDateFollowUps = activeFollowUps
    .filter(
      (followUp) => followUp.dueDate.seconds === epochZeroTimestamp.seconds
    );
    // No specific sort needed for no-date items unless based on content/person

  // Include non-archived completed items only
  const completedFollowUps = followUps
      .filter((followUp) => followUp.completed && !followUp.archived)
      .sort((a, b) => b.dueDate.seconds - a.dueDate.seconds); // Optional: Sort completed by most recent due date first
  
   // --- End Filtering and Sorting --- //

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
        archived: false,
        createdBy: user.uid, // Add createdBy field
        createdAt: serverTimestamp(), // Add createdAt timestamp
      };
      
      const docRef = await addDoc(collectionRef, docToAdd);
      console.log("Follow-up added successfully with ID:", docRef.id);

      // Add to local state for responsiveness
      setFollowUps(prev => [...prev, { id: docRef.id, ...docToAdd }]);

      // Reset form and close dialog
      setNewFollowUp({ content: "", personId: "", dueDate: Timestamp.now(), completed: false, archived: false });
      setIsAddDialogOpen(false);

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
    const docRef = doc(db, "persons", editingFollowUp.personId, "followUps", editingFollowUp.id);

    try {
      const dataToUpdate: {
          content: string;
          dueDate: Timestamp;
      } = {
        content: editingFollowUp.content,
        dueDate: editingFollowUp.dueDate instanceof Timestamp ? editingFollowUp.dueDate : Timestamp.fromDate(new Date(0)),
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
          const followUpRef = doc(db, "persons", followUp.personId, "followUps", followUp.id);
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
      </div>

      {/* Removed isLoading check here, handled above */}
      {/* Error display */}
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2">
           <Accordion type="multiple" className="w-full space-y-2" defaultValue={['overdue', 'this-week']}>
              {overdueFollowUps.length > 0 && (
                 <AccordionItem value="overdue">
                   <AccordionTrigger className="p-3 bg-card border border-shrub/20 rounded-md hover:no-underline hover:bg-muted transition-colors [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                      <div className="flex items-center gap-2 text-lg font-medium">
                        <AlertTriangle className="h-5 w-5 text-shrub" />
                        <span>Attention</span>
                        <Badge className="bg-shrub hover:bg-shrub/90 text-primary-foreground">{overdueFollowUps.length}</Badge>
                      </div>
                   </AccordionTrigger>
                   <AccordionContent className="p-0">
                      <Card className="rounded-t-none border-t-0 border-shrub/20">
                        <CardContent className="pt-4">
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
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <User className="h-3 w-3" />
                                      <span>{getPersonNameById(followUp.personId)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="default" className={cn(
                                        "bg-shrub hover:bg-shrub/90 text-primary-foreground",
                                        "text-xs font-medium"
                                      )}>
                                        <Clock className="h-3 w-3 mr-1" />
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
                   </AccordionContent>
                 </AccordionItem>
              )}

              {thisWeekFollowUps.length > 0 && (
                 <AccordionItem value="this-week">
                   <AccordionTrigger className="p-3 bg-card border rounded-md hover:no-underline hover:bg-muted transition-colors [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                      <div className="flex items-center gap-2 text-lg font-medium">
                        <Calendar className="h-5 w-5 text-shrub" />
                        <span>This Week</span>
                        <Badge variant="outline">{thisWeekFollowUps.length}</Badge>
                      </div>
                   </AccordionTrigger>
                   <AccordionContent className="p-0">
                      <Card className="rounded-t-none border-t-0">
                         <CardContent className="pt-4">
                            <div className="space-y-4">
                              {thisWeekFollowUps.map((followUp) => (
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
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span>{getPersonNameById(followUp.personId)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn(
                                          "text-xs font-medium"
                                        )}>
                                          <Calendar className="h-3 w-3 mr-1" />
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
                   </AccordionContent>
                 </AccordionItem>
              )}
              
              {futureFollowUps.length > 0 && (
                 <AccordionItem value="future">
                   <AccordionTrigger className="p-3 bg-card border rounded-md hover:no-underline hover:bg-muted transition-colors [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                      <div className="flex items-center gap-2 text-lg font-medium">
                        <Calendar className="h-5 w-5 text-shrub" />
                        <span>Scheduled</span>
                        <Badge variant="outline">{futureFollowUps.length}</Badge>
                      </div>
                   </AccordionTrigger>
                   <AccordionContent className="p-0">
                      <Card className="rounded-t-none border-t-0">
                         <CardContent className="pt-4">
                            <div className="space-y-4">
                              {futureFollowUps.map((followUp) => (
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
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span>{getPersonNameById(followUp.personId)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn(
                                          "text-xs font-medium"
                                        )}>
                                          <Calendar className="h-3 w-3 mr-1" />
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
                   </AccordionContent>
                 </AccordionItem>
              )}
              
              {noDateFollowUps.length > 0 && (
                 <AccordionItem value="no-date">
                   <AccordionTrigger className="p-3 bg-card border rounded-md hover:no-underline hover:bg-muted transition-colors [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                      <div className="flex items-center gap-2 text-lg font-medium">
                         <span>No Date Assigned</span>
                         <Badge variant="outline">{noDateFollowUps.length}</Badge>
                      </div>
                   </AccordionTrigger>
                   <AccordionContent className="p-0">
                      <Card className="rounded-t-none border-t-0">
                         <CardContent className="pt-4">
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
                   </AccordionContent>
                 </AccordionItem>
              )}
           </Accordion>

           {overdueFollowUps.length === 0 && thisWeekFollowUps.length === 0 && futureFollowUps.length === 0 && noDateFollowUps.length === 0 && (
             <div className="text-center py-12">
               <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
               <h3 className="text-lg font-medium">No active follow-ups</h3>
               <p className="text-muted-foreground mt-1">All your follow-ups are completed!</p>
             </div>
           )}
        </TabsContent>

        <TabsContent value="completed">
           <Card>
             <CardHeader className="pb-3 flex flex-row items-center justify-between"> 
               <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" />
                  <span>Completed</span>
                  <Badge variant="outline">{completedFollowUps.length}</Badge>
                </CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCompletedFollowUps}
                    disabled={isClearing || completedFollowUps.length === 0}
                    className="gap-1 text-xs"
                 >
                   {isClearing ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : null}
                   Clear Completed
                 </Button>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
         <DialogContent className="sm:max-w-[425px]"> 
           <DialogHeader> 
             <DialogTitle>Edit Follow-up</DialogTitle> 
             <DialogDescription>Update the details for this follow-up.</DialogDescription> 
           </DialogHeader> 
           {editingFollowUp && ( 
             <div className="grid gap-4 py-4"> 
               <div className="grid gap-2"> 
                 <Label htmlFor="edit-content">Follow-up Item</Label> 
                 <Input 
                   id="edit-content" 
                   value={editingFollowUp.content} 
                   onChange={(e) => setEditingFollowUp({ ...editingFollowUp, content: e.target.value })} 
                 /> 
               </div> 
               <div className="grid grid-cols-4 items-center gap-4"> 
                 <Label htmlFor="edit-dueDate" className="text-right">Due Date</Label> 
                 <Input 
                   id="edit-dueDate" 
                   type="date" 
                   className="col-span-3" 
                   value={formatDateForInput(editingFollowUp.dueDate)} 
                   onChange={(e) => { 
                     const dateValue = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.fromDate(new Date(0)); 
                     setEditingFollowUp({ ...editingFollowUp, dueDate: dateValue })
                   }} 
                 /> 
               </div> 
             </div> 
           )} 
           <DialogFooter> 
             <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button> 
             <Button onClick={handleEditFollowUp}>Save Changes</Button> 
           </DialogFooter> 
         </DialogContent> 
       </Dialog> 

      {/* FAB for Adding Follow-up */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
            <Button
              variant="default"
              className="fixed bottom-16 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center"
              size="icon"
              aria-label="Add Follow-up"
              disabled={!user} // Disable if not logged in
            >
              <Plus className="h-6 w-6" />
            </Button>
        </DialogTrigger>
        {/* Add Follow-up Dialog Content */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Follow-up</DialogTitle>
            <DialogDescription>
              Enter the details for the new follow-up item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              {/* Follow-up Content Textarea */}
              <div className="grid gap-2">
                <Label htmlFor="followup-content">Follow-up Item</Label>
                <Textarea
                  id="followup-content"
                  placeholder="What is the follow-up task?"
                  value={newFollowUp.content || ""}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                  rows={3}
                />
              </div>
              {/* Person Select Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="followup-person" className="text-right">
                  Person
                </Label>
                <Select
                  value={newFollowUp.personId}
                  onValueChange={(value) => setNewFollowUp({ ...newFollowUp, personId: value })}
                  disabled={Object.keys(peopleMap).length === 0}
                >
                  <SelectTrigger id="followup-person" className="col-span-3">
                    <SelectValue placeholder={Object.keys(peopleMap).length > 0 ? "Select a person" : "No people found"} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(peopleMap).length > 0 ? (
                      Object.entries(peopleMap).map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-people-placeholder" disabled>Add people first</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={handleAddFollowUp}
              disabled={!newFollowUp.content || !newFollowUp.personId} // Basic validation
            >
              Save Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

