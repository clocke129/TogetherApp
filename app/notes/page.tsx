"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import TextareaAutosize from 'react-textarea-autosize'
import { Badge } from "@/components/ui/badge"
import { User, Calendar, Maximize2, Minimize2, Eye, Edit, Save } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useMobile } from "@/hooks/use-mobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { collection, addDoc, serverTimestamp, doc, writeBatch, query, where, getDocs, Timestamp } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"
import { cn } from "@/lib/utils"

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

  // --- Restore Original Save Notes Functionality --- //
  const handleSaveNotes = async () => {
    if (!user) {
      alert("Please log in to save notes.");
      return;
    }
    // Check if there is actually parsed data from the notes
    if (parsedData.length === 0) {
      alert("No prayer requests or follow-ups found in the notes to save.");
      return;
    }

    setIsSaving(true);
    console.log("Starting batch write for parsed notes...");
    const batch = writeBatch(db);
    const personsRef = collection(db, "persons");

    try {
      // --- Original Batch Logic (Uncommented) --- 
      for (const person of parsedData) {
        let personRef;
        console.log(`Processing person: ${person.name}`);

        // Check if person already exists for this user
        const q = query(
          personsRef,
          where("name", "==", person.name),
          where("createdBy", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Person exists, use the existing document reference
          personRef = querySnapshot.docs[0].ref;
          console.log(`Found existing person: ${person.name} (ID: ${personRef.id})`);
        } else {
          // Person does not exist, create a new document reference and add set operation
          personRef = doc(personsRef); // Generate new ID
          batch.set(personRef, {
            name: person.name,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            // groupIds: [], // Initialize if needed
          });
          console.log(`Creating new person: ${person.name} (New ID: ${personRef.id})`);
        }

        // Add prayer requests to subcollection
        if (person.prayerRequests.length > 0) {
          const requestsRef = collection(personRef, "prayerRequests");
          person.prayerRequests.forEach((request) => {
            const newRequestRef = doc(requestsRef);
            batch.set(newRequestRef, {
              content: request.content,
              createdAt: serverTimestamp(),
              createdBy: user.uid,
              personId: personRef.id, // Store parent person ID for potential denormalization/queries
              // prayedForDates: [] // Initialize if needed
            });
          });
          console.log(`Adding ${person.prayerRequests.length} request(s) for ${person.name}`);
        }

        // Add follow-ups to subcollection
        if (person.followUps.length > 0) {
          const followUpsRef = collection(personRef, "followUps");
          person.followUps.forEach((followUp) => {
            const newFollowUpRef = doc(followUpsRef);
            batch.set(newFollowUpRef, {
              content: followUp.content,
              dueDate: Timestamp.fromDate(followUp.dueDate), // Convert JS Date to Firestore Timestamp
              completed: followUp.completed,
              createdBy: user.uid,
              personId: personRef.id, // Store parent person ID
              // isRecurring, recurringPattern if needed
            });
          });
          console.log(`Adding ${person.followUps.length} follow-up(s) for ${person.name}`);
        }
      }
      // --- End Original Batch Logic --- 

      // Commit all operations in the batch
      console.log("Committing batch...");
      await batch.commit();
      console.log("Batch commit successful!");
      alert("Notes saved successfully!");
      setText(""); // Clear the textarea on successful save
      setParsedData([]); // Clear the parsed data as well

    } catch (error) {
      console.error("Error saving notes: ", error);
      alert("An error occurred while saving notes. Please check the console.");
    } finally {
      setIsSaving(false);
    }
  };
  // --- End Save Notes Functionality --- //

  // Render the editor component - Added isMobileView prop
  const renderEditor = (isMobileView: boolean) => {
    const editorContent = (
      // Added relative positioning for suggestion card when isMobileView is true
      <div className={cn(isMobileView && "relative")}>
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
    <div className="grid gap-4 md:gap-6 md:grid-cols-2">
      {renderEditor(false)} {/* Pass false for desktop */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {renderPreview()}
        </CardContent>
      </Card>
    </div>
  )

  // Render mobile layout (FIRST DEFINITION - KEEP THIS ONE)
  const renderMobileLayout = () => (
     <div className="flex flex-col h-[calc(100vh-10rem)]">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "editor" | "preview")} className="flex-1 flex flex-col">
        <div className="p-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="editor" className="flex-1 overflow-auto p-4">
          {renderEditor(true)} {/* Pass true for mobile */}
        </TabsContent>
        <TabsContent value="preview" className="flex-1 overflow-auto p-4">
          {renderPreview()}
        </TabsContent>
      </Tabs>
    </div>
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
      {/* Consistent Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="page-title">Notes</h1>
          <p className="text-muted-foreground">{currentDateString}</p>
        </div>
        <Button onClick={handleSaveNotes} disabled={isSaving} size="sm">
           {/* Restore Save button content */}
           {isSaving ? (
               <>Saving...</>
           ) : (
               <><Save className="mr-2 h-4 w-4" /> Save Note</>
           )}
        </Button>
      </div>

      {/* Main Content */}
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      {/* <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0">
          <VisuallyHidden>
            <DialogTitle>Fullscreen Note Editor</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Note Editor (Fullscreen)</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)} className="h-8 w-8 p-0">
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative flex-1 p-4">
              <TextareaAutosize
                value={text}
                onChange={handleTextChange}
                placeholder="Start typing... Use @name for people and #MMDD for follow-up dates"
                className="w-full resize-none appearance-none overflow-hidden bg-transparent focus:outline-none focus:ring-0 border-0 p-0 font-mono min-h-[calc(90vh-120px)]"
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsFullscreen(false)}>Cancel</Button>
              <Button onClick={handleSaveNotes} disabled={isSaving}>
                {isSaving ? (
                    <>Saving...</>
                ) : (
                    <><Save className="mr-2 h-4 w-4" /> Save Note & Close</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}
    </div>
  )
}

