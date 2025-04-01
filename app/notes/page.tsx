"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { User, Calendar, Maximize2, Minimize2, Eye, Edit, Save } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useMobile } from "@/hooks/use-mobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { collection, addDoc, serverTimestamp, doc, writeBatch, query, where, getDocs, Timestamp } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"

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

export default function NotesPage() {
  const [text, setText] = useState("")
  const [parsedData, setParsedData] = useState<Person[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [filteredSuggestions, setFilteredSuggestions] = useState<{ id: string; name: string }[]>([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [isSaving, setIsSaving] = useState(false)

  const isMobile = useMobile()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useAuth()

  // Parse the text to extract people, prayer requests, and follow-ups
  useEffect(() => {
    const parseText = () => {
      const lines = text.split("\n")
      const people: Person[] = []
      let currentPerson: Person | null = null

      lines.forEach((line) => {
        // Check for person mention (@PersonName)
        if (line.startsWith("@")) {
          const name = line.substring(1).trim()
          currentPerson = {
            id: Date.now().toString() + Math.random().toString(),
            name,
            prayerRequests: [],
            followUps: [],
          }
          people.push(currentPerson)
        }
        // Check for follow-up date (#MMDD)
        else if (line.match(/^#\d{4}/) && currentPerson) {
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
        // Regular prayer request
        else if (line.trim() && currentPerson) {
          currentPerson.prayerRequests.push({
            id: Date.now().toString() + Math.random().toString(),
            content: line.trim(),
            createdAt: new Date(),
          })
        }
      })

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

    const lastAtSymbolIndex = newText.lastIndexOf("@", position)
    if (lastAtSymbolIndex !== -1 && lastAtSymbolIndex < position) {
      const query = newText.substring(lastAtSymbolIndex + 1, position).trim()
      setSuggestionQuery(query)
      setShowSuggestions(false)
      setFilteredSuggestions([])
    } else {
      setShowSuggestions(false)
      setSuggestionQuery("")
      setFilteredSuggestions([])
    }
  }

  // Handle selection of a person from suggestions
  const handleSelectPerson = (person: { id: string; name: string }) => {
    const beforeAt = text.substring(0, text.lastIndexOf("@", cursorPosition))
    const afterCursor = text.substring(cursorPosition)
    const newText = `${beforeAt}@${person.name}${afterCursor}`

    setText(newText)
    setShowSuggestions(false)

    // Focus back on the textarea
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

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

  // Render the editor component
  const renderEditor = () => (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        placeholder="Start typing... Use @name for people and #MMDD for follow-up dates"
        className="min-h-[200px] md:min-h-[300px] font-mono"
      />
    </div>
  )

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

              {person.prayerRequests.length > 0 && (
                <div className="space-y-2 pl-7">
                  <p className="text-sm font-medium text-muted-foreground">Prayer Requests:</p>
                  <ul className="space-y-1">
                    {person.prayerRequests.map((request, idx) => (
                      <li key={idx} className="text-sm">
                        • {request.content}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Note Editor</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)} className="h-8 w-8 p-0">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {renderEditor()}
        </CardContent>
        <div className="p-4 border-t flex justify-end">
          <Button onClick={handleSaveNotes} disabled={isSaving}>
            {isSaving ? (
                <>Saving...</>
            ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Notes</>
            )}
          </Button>
        </div>
      </Card>
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
        <div className="flex items-center justify-between p-4 border-b">
            <TabsList className="grid w-[calc(100%-50px)] grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)} className="h-8 w-8 p-0">
                <Maximize2 className="h-4 w-4" />
            </Button>
        </div>
        <TabsContent value="editor" className="flex-1 overflow-auto p-4">
          {renderEditor()}
        </TabsContent>
        <TabsContent value="preview" className="flex-1 overflow-auto p-4">
          {renderPreview()}
        </TabsContent>
        <div className="p-4 border-t flex justify-end">
           <Button onClick={handleSaveNotes} disabled={isSaving} className="w-full md:w-auto">
             {isSaving ? (
                 <>Saving...</>
             ) : (
                 <><Save className="mr-2 h-4 w-4" /> Save Notes</>
             )}
           </Button>
        </div>
      </Tabs>
    </div>
  )

  return (
    <div className="mobile-container pb-16 md:pb-6">
      <div className="mb-4 md:mb-6">
        <h1 className="page-title">Prayer Notes</h1>
        <p className="page-description">Capture prayer requests with special syntax</p>
      </div>

      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
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
              <Textarea
                value={text}
                onChange={handleTextChange}
                placeholder="Start typing... Use @name for people and #MMDD for follow-up dates"
                className="min-h-[calc(90vh-120px)] w-full font-mono resize-none border-0 shadow-none focus-visible:ring-0 p-0"
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsFullscreen(false)}>Cancel</Button>
              <Button onClick={handleSaveNotes} disabled={isSaving}>
                {isSaving ? (
                    <>Saving...</>
                ) : (
                    <><Save className="mr-2 h-4 w-4" /> Save Notes & Close</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

