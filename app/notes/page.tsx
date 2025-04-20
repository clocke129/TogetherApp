"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import TextareaAutosize from 'react-textarea-autosize'
import { Badge } from "@/components/ui/badge"
import { User, Calendar, Maximize2, Minimize2, Eye, Edit, Save, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useMobile } from "@/hooks/use-mobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { collection, addDoc, serverTimestamp, doc, writeBatch, query, where, getDocs, Timestamp } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

// Types for our data models
type Person = {
  id: string
  name: string
  prayerRequests: PrayerRequest[]
  followUps: FollowUp[]
}

type PrayerRequest = {
  id: string
  content: string
  createdAt: Date
}

type FollowUp = {
  id: string
  content: string
  dueDate: Date
  completed: boolean
}

// Add a simpler type for existing persons list used for suggestions
type ExistingPerson = {
  id: string
  name: string
}

export default function NotesPage() {
  const [text, setText] = useState("")
  const [parsedData, setParsedData] = useState<Person[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [filteredSuggestions, setFilteredSuggestions] = useState<ExistingPerson[]>([]) // Use ExistingPerson type
  const [cursorPosition, setCursorPosition] = useState(0)
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [isSaving, setIsSaving] = useState(false)
  const [existingPersons, setExistingPersons] = useState<ExistingPerson[]>([]) // State for existing persons
  const [saveError, setSaveError] = useState<string | null>(null) // State for save errors

  // State for the formatted current date
  const [currentDateString, setCurrentDateString] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

  const isMobile = useMobile()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useAuth()

  // Fetch existing persons for the current user
  useEffect(() => {
    // Fetch existing persons only if logged in
    if (!user) {
       console.log("No user logged in, skipping person fetch for suggestions.")
       setExistingPersons([])
       return
    }
    const fetchPersons = async () => {
      console.log("Fetching persons for user:", user.uid)
      const personsRef = collection(db, "persons")
      const q = query(personsRef, where("createdBy", "==", user.uid))
      try {
        const querySnapshot = await getDocs(q)
        const personsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
        }))
        console.log("Fetched persons:", personsList)
        setExistingPersons(personsList)
      } catch (error) {
        console.error("Error fetching persons:", error)
        setExistingPersons([]) // Reset on error
      }
    }

    fetchPersons()
  }, [user]) // Re-fetch if user changes

  // Parse the text to extract people, prayer requests, and follow-ups
  useEffect(() => {
    const parseText = () => {
      const lines = text.split("\n")
      const people: Person[] = []
      let currentPerson: Person | null = null
      let currentPrayerLines: string[] = [] // Buffer for prayer request lines

      // Helper to finalize the prayer request for the current person
      const finalizePreviousPersonPrayer = () => {
        if (currentPerson && currentPrayerLines.length > 0) {
          currentPerson.prayerRequests.push({
            id: Date.now().toString() + Math.random().toString(),
            content: currentPrayerLines.join('\n'), // Join lines into one string
            createdAt: new Date(),
          })
          currentPrayerLines = [] // Reset buffer
        }
      }

      lines.forEach((line) => {
        // Check for person mention (@PersonName)
        if (line.startsWith("@")) {
          finalizePreviousPersonPrayer() // Finalize prayers for the previous person first

          const name = line.substring(1).trim()
          currentPerson = {
            id: Date.now().toString() + Math.random().toString(),
            name,
            prayerRequests: [], // Initialize empty
            followUps: [],
          }
          people.push(currentPerson)
        }
        // Check for follow-up date (#MMDD)
        else if (line.match(/^#\d{4}/) && currentPerson) {
          finalizePreviousPersonPrayer() // Finalize prayers before processing follow-up

          const dateMatch = line.match(/^#(\d{2})(\d{2})/)
          if (dateMatch) {
            const [_, month, day] = dateMatch
            const today = new Date()
            const dueDate = new Date(today.getFullYear(), Number.parseInt(month) - 1, Number.parseInt(day))

            // If the date is in the past for this year, assume next year
            if (dueDate < today) {
              dueDate.setFullYear(today.getFullYear() + 1)
            }

            const content = line.substring(5).trim()
            currentPerson.followUps.push({
              id: Date.now().toString() + Math.random().toString(),
              content,
              dueDate,
              completed: false,
            })
          }
        }
        // Regular line - potential prayer request part
        else if (line.trim() && currentPerson) {
          currentPrayerLines.push(line.trim()) // Add to buffer
        }
        // Ignore empty lines or lines before the first @person
      })

      finalizePreviousPersonPrayer() // Finalize prayers for the very last person in the note

      setParsedData(people)
    }

    parseText()
  }, [text])

  // Handle text changes and check for @ symbol to show suggestions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)

    const position = e.target.selectionStart || 0
    setCursorPosition(position)

    const textBeforeCursor = newText.substring(0, position)
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@")
    // const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ") // Removed this check

    // Show suggestions if @ exists and there's no newline between @ and cursor
    if (lastAtSymbolIndex !== -1) {
      const query = textBeforeCursor.substring(lastAtSymbolIndex + 1)
      const textBetweenAtAndCursor = textBeforeCursor.substring(lastAtSymbolIndex);

      // Only suggest if no newline between the @ and the cursor
      if (!textBetweenAtAndCursor.includes('\n')) {
        setSuggestionQuery(query)

        if (query.length >= 0) { // Check even for empty query right after @
          const lowerCaseQuery = query.toLowerCase()
          const suggestions = existingPersons.filter(person =>
            person.name.toLowerCase().includes(lowerCaseQuery)
          )
          setFilteredSuggestions(suggestions)
          // Show suggestions if there are matches OR if the query could be a new person
          const couldBeNewPerson = query.trim().length > 0 && !suggestions.some(p => p.name.toLowerCase() === lowerCaseQuery.trim());
          setShowSuggestions(suggestions.length > 0 || couldBeNewPerson)
        } 
        // Removed the 'else' block that showed all persons on empty query, as filter handles it

      } else {
        // Hide suggestions if there's a newline after @
        setShowSuggestions(false)
        setSuggestionQuery("")
        setFilteredSuggestions([])
      }
    } else {
      // Hide suggestions if no @ is found before the cursor
      setShowSuggestions(false)
      setSuggestionQuery("")
      setFilteredSuggestions([])
    }
  }

  // Handle selection of a person from suggestions
  const handleSelectPerson = (person: ExistingPerson) => {
    if (!textareaRef.current) return;

    const currentText = text;
    const currentPosition = textareaRef.current.selectionStart || 0;

    // Find the start of the @mention based on the last @ before the cursor
    const textBeforeCursor = currentText.substring(0, currentPosition);
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbolIndex === -1) return; // Should not happen if suggestions are shown

    const beforeAt = currentText.substring(0, lastAtSymbolIndex);
    const afterMention = currentText.substring(currentPosition);

    // Construct the new text with the selected person's name
    // Ensure a space is added after the name if the text doesn't continue immediately
    const suffix = afterMention.startsWith(' ') || afterMention === '' ? '' : ' ';
    const newText = `${beforeAt}@${person.name}${suffix}${afterMention}`;

    setText(newText);
    setShowSuggestions(false);
    setSuggestionQuery("");
    setFilteredSuggestions([]);

    // Set cursor position after the inserted name + space
    const newCursorPosition = lastAtSymbolIndex + 1 + person.name.length + suffix.length;

    // Defer focusing and setting cursor position to allow state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };

  // Handle adding a new person from suggestions
  const handleAddPerson = (name: string) => {
    if (!name.trim()) return; // Don't add empty names

    const newPerson: ExistingPerson = {
      // Use a temporary ID or the name itself; persistence happens on save
      id: `temp_${Date.now()}`,
      name: name.trim() // Use the trimmed query as the name
    };

    // Optimistically add to the existing persons list for immediate feedback in suggestions
    setExistingPersons(prev => [...prev, newPerson]);

    // Call handleSelectPerson to insert the tag into the textarea
    handleSelectPerson(newPerson);

    // Suggestions should hide automatically via handleSelectPerson
  };

  // Format the date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Toggle between editor and preview on mobile
  const toggleMobileView = () => {
    setActiveTab(activeTab === "editor" ? "preview" : "editor")
  }

  // Save the parsed data to Firestore
  const handleSaveNotes = async () => {
    if (!user) {
      console.error("User not logged in. Cannot save notes.")
      setSaveError("You must be logged in to save notes.");
      return;
    }
    if (parsedData.length === 0) {
        toast.info("Nothing to save", {
            description: "Your note is empty or doesn't contain any @mentions.",
        });
        return; // Don\'t attempt to save if nothing is parsed
    }

    setIsSaving(true)
    setSaveError(null); // Clear previous errors
    console.log("Starting save process for user:", user.uid);
    console.log("Data to save:", parsedData);

    // Check for existing persons in Firestore BEFORE batching
    const personNameChecks = parsedData.map(async (personData) => {
      const personsRef = collection(db, "persons");
      const q = query(personsRef, where("name", "==", personData.name), where("createdBy", "==", user.uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // Person exists, use existing ID
        const existingDoc = querySnapshot.docs[0];
        console.log(`Person '${personData.name}' already exists with ID: ${existingDoc.id}`);
        return { ...personData, id: existingDoc.id, isExisting: true };
      } else {
        // Person is new
        console.log(`Person '${personData.name}' is new.`);
        return { ...personData, isExisting: false };
      }
    });

    try {
      const resolvedPeopleData = await Promise.all(personNameChecks);
      console.log("Resolved people data (with existing check):", resolvedPeopleData);

      const batch = writeBatch(db);
      const successfullySavedNames: string[] = []; // Track names for toast

      for (const personData of resolvedPeopleData) {
        let personId = personData.id; // Use existing ID if found

        // 1. Create or Get Person document reference
        let personRef;
        if (personData.isExisting) {
          personRef = doc(db, "persons", personId);
          // No need to create/set person data if they already exist
          console.log(`Using existing person ref for '${personData.name}' (ID: ${personId})`);
        } else {
          // Create a new person document ONLY IF they don\'t exist
          personRef = doc(collection(db, "persons")); // Generate new ID client-side
          personId = personRef.id; // Update personId with the new ID
          batch.set(personRef, {
            name: personData.name,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
          console.log(`Creating new person '${personData.name}' with ID: ${personId}`);
        }

        // 2. Add Prayer Requests for this person
        personData.prayerRequests.forEach((request: PrayerRequest) => {
          const requestRef = doc(collection(db, "persons", personId, "prayerRequests"));
          batch.set(requestRef, {
            personId: personId, // Link back to the person
            personName: personData.name, // Denormalize name for easier querying later?
            content: request.content,
            createdAt: serverTimestamp(), // Use server timestamp
            createdBy: user.uid, // Track who created it
            isCompleted: false // Default completion status
          });
          console.log(`Batching prayer request for ${personData.name}: "${request.content.substring(0, 20)}..."`);
        });

        // 3. Add Follow-Ups for this person
        personData.followUps.forEach((followUp: FollowUp) => {
          const followUpRef = doc(collection(db, "persons", personId, "followUps"));
          batch.set(followUpRef, {
            personId: personId, // Link back to the person
            personName: personData.name, // Denormalize name
            content: followUp.content,
            dueDate: Timestamp.fromDate(followUp.dueDate), // Convert JS Date to Firestore Timestamp
            completed: followUp.completed,
            createdAt: serverTimestamp(), // Track creation time
            createdBy: user.uid, // Track who created it
          });
           console.log(`Batching follow-up for ${personData.name} due ${followUp.dueDate.toISOString().split('T')[0]}: "${followUp.content.substring(0, 20)}..."`);
        });

        successfullySavedNames.push(personData.name); // Add name to success list
      }

      // Commit the batch
      await batch.commit();
      console.log("Batch commit successful!");

      // Show success toast
      toast.success("Notes saved successfully!", {
          description: `Saved requests/follow-ups for: ${successfullySavedNames.join(", ")}.`,
          // action: { // Optional: Add action if needed
          //   label: "View",
          //   onClick: () => router.push('/prayer') // Or navigate somewhere else
          // },
      });

      // Clear the text area after successful save
      setText("");
      setParsedData([]); // Clear parsed data as well

    } catch (error) {
      console.error("Error saving notes:", error);
      setSaveError("An error occurred while saving. Please try again.");
      // Show error toast
      toast.error("Error Saving Notes", {
          description: "Could not save your prayer requests. Please check your connection and try again.",
      });
    } finally {
      setIsSaving(false)
    }
  }

  // Render the editor component - Added isMobileView prop
  const renderEditor = (isMobileView: boolean) => {
    const editorContent = (
      // Ensure the wrapper is always relative for suggestion card positioning
      <div className="relative">
        <TextareaAutosize
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder={`Type your prayer notes here...
Use @PersonName to mention someone.
Use #MMDD for follow-up dates.`}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-shrub min-h-[150px] resize-none"
          minRows={5}
        />
        {showSuggestions && (
          <Card
            className="absolute z-10 mt-1 w-full max-w-xs border rounded-md bg-background shadow-lg"
            style={{ top: '100%' }}
          >
            <CardContent className="p-1 max-h-48 overflow-y-auto">
              {filteredSuggestions.map((person) => (
                <Button
                  key={person.id}
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 mb-1 text-left text-sm"
                  onClick={() => handleSelectPerson(person)}
                >
                  {person.name}
                </Button>
              ))}
              {/* --- Add New Person Option --- */}
              {/* Show if query is non-empty and no exact case-insensitive match exists */}
              {suggestionQuery.trim() && !filteredSuggestions.some(p => p.name.toLowerCase() === suggestionQuery.trim().toLowerCase()) && (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 mt-1 text-left text-shrub text-sm" // Changed text-blue-600 to text-shrub
                  onClick={() => handleAddPerson(suggestionQuery.trim())} // Trim name before adding
                >
                  Add new person: "{suggestionQuery.trim()}"
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );

    if (isMobileView) {
      return editorContent; // Render only textarea and suggestions on mobile
    }

    // Render with Card wrapper on desktop
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Editor</CardTitle>
        </CardHeader>
        <CardContent>
          {editorContent}
        </CardContent>
      </Card>
    );
  }

  // Render the preview component
  const renderPreview = () => (
    <div>
      {parsedData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Your parsed prayer requests will appear here</p>
          <p className="text-sm mt-2">
            Try typing <code>@PersonName</code> to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {parsedData.map((person, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center">
                <User className="mr-2 h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">{person.name}</h3>
              </div>

              {/* Display consolidated prayer request */}
              {person.prayerRequests.length > 0 && (
                <div className="space-y-2 pl-7">
                  <p className="text-sm font-medium text-muted-foreground">Prayer Requests:</p>
                  {/* Render as list only if multiple lines, otherwise plain text */}
                  {(() => {
                    const lines = person.prayerRequests[0].content
                      .split('\n')
                      .filter(line => line.trim() !== '');
                    if (lines.length > 1) {
                      return (
                        <ul className="list-disc pl-5 space-y-1">
                          {lines.map((line, lineIndex) => (
                            <li key={lineIndex} className="text-sm">
                              {line}
                            </li>
                          ))}
                        </ul>
                      );
                    } else if (lines.length === 1) {
                      return <p className="text-sm">{lines[0]}</p>;
                    }
                    return null; // Handle case with no non-empty lines (optional)
                  })()}
                </div>
              )}

              {/* Follow-ups remain the same */}
              {person.followUps.length > 0 && (
                <div className="space-y-2 pl-7">
                  <p className="text-sm font-medium text-muted-foreground">Follow-ups:</p>
                  <ul className="space-y-2">
                    {person.followUps.map((followUp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(followUp.dueDate)}
                        </Badge>
                        <span>{followUp.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // Render desktop layout
  const renderDesktopLayout = () => (
    <>
      {/* Title and Date */}
      <div className="mb-4 md:mb-6">
        <h1 className="page-title">Notes</h1>
        <p className="text-muted-foreground">{currentDateString}</p>
      </div>

      {/* Desktop: Side-by-side Editor and Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderEditor(false)}
        {renderPreview()}
      </div>

      {/* Floating Action Button for Save */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
             <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-10 bg-shrub hover:bg-shrub/90"
                size="icon"
                onClick={handleSaveNotes}
                disabled={isSaving || parsedData.length === 0}
             >
               {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
               <span className="sr-only">Save Note</span>
             </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save Note</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  )

  // Render mobile layout (FIRST DEFINITION - KEEP THIS ONE)
  const renderMobileLayout = () => (
    <>
      {/* Title and Date */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="page-title">Notes</h1>
          <p className="text-muted-foreground">{currentDateString}</p>
        </div>
        {/* Removed original Save Button */}
      </div>

      {/* Mobile: Tabs for Editor and Preview */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "editor" | "preview")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor">
            <Edit className="mr-2 h-4 w-4" /> Editor
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" /> Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="mt-4">
          {renderEditor(true)}
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          {renderPreview()}
        </TabsContent>
      </Tabs>

       {/* Floating Action Button for Save (same as desktop) */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
             <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-10 bg-shrub hover:bg-shrub/90"
                size="icon"
                onClick={handleSaveNotes}
                disabled={isSaving || parsedData.length === 0}
             >
               {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
               <span className="sr-only">Save Note</span>
             </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save Note</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  )

  // Loading State (Only need auth loading here, no data fetch on initial render)
  const { loading: authLoading } = useAuth(); // Get authLoading specifically
  if (authLoading) {
     return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  // Logged Out State
  if (!user) {
    return (
      <div className="mobile-container pb-16 md:pb-6">
        {/* Header structure */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="page-title">Notes</h1>
            <p className="text-muted-foreground">{currentDateString}</p>
          </div>
          <Button size="sm" disabled={true}>
            <Save className="mr-2 h-4 w-4" /> Save Note
          </Button>
        </div>
        {/* Login Prompt */}
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">
            Please <strong className="text-foreground">log in</strong> or <strong className="text-foreground">sign up</strong> to save notes.
          </p>
        </div>
      </div>
    );
  }

  // Logged In State (Original Return Content)
  return (
    <div className="mobile-container pb-16 md:pb-6">
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
       {/* Display save error message */}
       {saveError && (
         <div className="mt-4 p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
           {saveError}
         </div>
       )}
    </div>
  )
}

