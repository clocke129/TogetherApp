"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { FileText, User, Calendar, Eye, Edit } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TextareaAutosize from "react-textarea-autosize"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/firebaseConfig"
import { collection, addDoc, serverTimestamp, doc, writeBatch, query, where, getDocs, Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { useMobile } from "@/hooks/use-mobile"

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

type ExistingPerson = {
  id: string
  name: string
}

type DateSuggestion = {
  label: string        // "Tomorrow", "Next week", "Next month"
  dateText: string     // "Dec 24", "Dec 29", "Jan 22"
  dueDate: Date        // Actual Date object for setting field
}

export function MobileFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState("")
  const [parsedData, setParsedData] = useState<Person[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [existingPersons, setExistingPersons] = useState<ExistingPerson[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [filteredSuggestions, setFilteredSuggestions] = useState<ExistingPerson[]>([])

  // Date autocomplete state (similar to @ mentions)
  const [showDateSuggestions, setShowDateSuggestions] = useState(false)
  const [dateSuggestionQuery, setDateSuggestionQuery] = useState("")
  const [filteredDateSuggestions, setFilteredDateSuggestions] = useState<DateSuggestion[]>([])

  const { user } = useAuth()
  const isMobile = useMobile()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch existing persons for autocomplete
  useEffect(() => {
    if (!user) {
      setExistingPersons([])
      return
    }

    const fetchPersons = async () => {
      const q = query(collection(db, "users", user.uid, "persons"))
      try {
        const querySnapshot = await getDocs(q)
        const personsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
        }))
        setExistingPersons(personsList)
      } catch (error) {
        console.error("Error fetching persons:", error)
        setExistingPersons([])
      }
    }

    if (isOpen) {
      fetchPersons()
    }
  }, [user, isOpen])

  // Parse the text to extract people, prayer requests, and follow-ups
  useEffect(() => {
    const parseText = () => {
      const lines = text.split("\n")
      const people: Person[] = []
      let currentPerson: Person | null = null
      let currentPrayerLines: string[] = []

      const finalizePreviousPersonPrayer = () => {
        if (currentPerson && currentPrayerLines.length > 0) {
          currentPerson.prayerRequests.push({
            id: Date.now().toString() + Math.random().toString(),
            content: currentPrayerLines.join('\n'),
            createdAt: new Date(),
          })
          currentPrayerLines = []
        }
      }

      lines.forEach((line) => {
        // Check for person mention (@PersonName)
        if (line.startsWith("@")) {
          finalizePreviousPersonPrayer()

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
          finalizePreviousPersonPrayer()

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
          currentPrayerLines.push(line.trim())
        }
      })

      finalizePreviousPersonPrayer()

      setParsedData(people)
    }

    parseText()
  }, [text])

  // Generate date suggestions (Tomorrow, Next week, Next month)
  const getDateSuggestions = (): DateSuggestion[] => {
    const today = new Date()

    // Tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    // Next week
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)

    // Next month
    const nextMonth = new Date(today)
    nextMonth.setMonth(today.getMonth() + 1)
    // JavaScript automatically handles month-end edge cases

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return [
      { label: "Tomorrow", dateText: formatDate(tomorrow), dueDate: tomorrow },
      { label: "Next week", dateText: formatDate(nextWeek), dueDate: nextWeek },
      { label: "Next month", dateText: formatDate(nextMonth), dueDate: nextMonth },
    ]
  }

  // Handle text changes and check for @ symbol to show suggestions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)

    const position = e.target.selectionStart || 0
    const textBeforeCursor = newText.substring(0, position)
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtSymbolIndex !== -1) {
      const query = textBeforeCursor.substring(lastAtSymbolIndex + 1)
      const textBetweenAtAndCursor = textBeforeCursor.substring(lastAtSymbolIndex)

      if (!textBetweenAtAndCursor.includes('\n')) {
        setSuggestionQuery(query)

        if (query.length >= 0) {
          const lowerCaseQuery = query.toLowerCase()
          const suggestions = existingPersons.filter(person =>
            person.name.toLowerCase().includes(lowerCaseQuery)
          )
          setFilteredSuggestions(suggestions)
          const couldBeNewPerson = query.trim().length > 0 && !suggestions.some(p => p.name.toLowerCase() === lowerCaseQuery.trim())
          setShowSuggestions(suggestions.length > 0 || couldBeNewPerson)
        }
      } else {
        setShowSuggestions(false)
        setSuggestionQuery("")
        setFilteredSuggestions([])
      }
    } else {
      setShowSuggestions(false)
      setSuggestionQuery("")
      setFilteredSuggestions([])
    }

    // NEW: # date autocomplete logic (same pattern as @)
    const lastHashSymbolIndex = textBeforeCursor.lastIndexOf("#")
    if (lastHashSymbolIndex !== -1) {
      const query = textBeforeCursor.substring(lastHashSymbolIndex + 1)
      const textBetweenHashAndCursor = textBeforeCursor.substring(lastHashSymbolIndex)

      // Only show if no newline between # and cursor
      if (!textBetweenHashAndCursor.includes('\n')) {
        setDateSuggestionQuery(query)

        const allDateSuggestions = getDateSuggestions()
        const filtered = allDateSuggestions.filter(suggestion =>
          suggestion.label.toLowerCase().includes(query.toLowerCase())
        )

        setFilteredDateSuggestions(filtered)
        setShowDateSuggestions(filtered.length > 0)
      } else {
        setShowDateSuggestions(false)
      }
    } else {
      setShowDateSuggestions(false)
    }
  }

  // Handle selection of a person from suggestions
  const handleSelectPerson = (person: ExistingPerson) => {
    if (!textareaRef.current) return

    const currentText = text
    const currentPosition = textareaRef.current.selectionStart || 0
    const textBeforeCursor = currentText.substring(0, currentPosition)
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtSymbolIndex === -1) return

    const beforeAt = currentText.substring(0, lastAtSymbolIndex)
    const afterMention = currentText.substring(currentPosition)
    const suffix = afterMention.startsWith(' ') || afterMention === '' ? '' : ' '
    const newText = `${beforeAt}@${person.name}${suffix}${afterMention}`

    setText(newText)
    setShowSuggestions(false)
    setSuggestionQuery("")
    setFilteredSuggestions([])

    const newCursorPosition = lastAtSymbolIndex + 1 + person.name.length + suffix.length

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
      }
    }, 0)
  }

  // Handle adding a new person from suggestions
  const handleAddPerson = (name: string) => {
    if (!name.trim()) return

    const newPerson: ExistingPerson = {
      id: `temp_${Date.now()}`,
      name: name.trim()
    }

    setExistingPersons(prev => [...prev, newPerson])
    handleSelectPerson(newPerson)
  }

  // Handle selection of a date from suggestions
  const handleSelectDate = (suggestion: DateSuggestion) => {
    if (!textareaRef.current) return

    const currentText = text
    const currentPosition = textareaRef.current.selectionStart || 0
    const textBeforeCursor = currentText.substring(0, currentPosition)
    const lastHashSymbolIndex = textBeforeCursor.lastIndexOf("#")

    if (lastHashSymbolIndex === -1) return

    // Convert date to #MMDD format that the parser recognizes
    const month = String(suggestion.dueDate.getMonth() + 1).padStart(2, '0')
    const day = String(suggestion.dueDate.getDate()).padStart(2, '0')
    const dateFormat = `#${month}${day}`

    // Replace #query with #MMDD format
    const beforeHash = currentText.substring(0, lastHashSymbolIndex)
    const afterQuery = currentText.substring(currentPosition)
    const newText = `${beforeHash}${dateFormat}${afterQuery}`

    setText(newText)
    setShowDateSuggestions(false)

    // Reset cursor position
    const newCursorPosition = lastHashSymbolIndex + dateFormat.length
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
      }
    }, 0)
  }

  // Format the date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Save the parsed data to Firestore
  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in to save notes")
      return
    }

    if (parsedData.length === 0) {
      toast.info("Nothing to save", {
        description: "Your note is empty or doesn't contain any @mentions.",
      })
      return
    }

    setIsSaving(true)

    // Check for existing persons in Firestore BEFORE batching
    const personNameChecks = parsedData.map(async (personData) => {
      const q = query(collection(db, "users", user.uid, "persons"), where("name", "==", personData.name))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0]
        return { ...personData, id: existingDoc.id, isExisting: true }
      } else {
        return { ...personData, isExisting: false }
      }
    })

    try {
      const resolvedPeopleData = await Promise.all(personNameChecks)
      const batch = writeBatch(db)
      const successfullySavedNames: string[] = []

      for (const personData of resolvedPeopleData) {
        let personId = personData.id
        let personRef

        if (personData.isExisting) {
          personRef = doc(db, "users", user.uid, "persons", personId)
        } else {
          personRef = doc(collection(db, "users", user.uid, "persons"))
          personId = personRef.id
          batch.set(personRef, {
            name: personData.name,
            createdAt: serverTimestamp(),
          })
        }

        // Add Prayer Requests
        personData.prayerRequests.forEach((request: PrayerRequest) => {
          const requestRef = doc(collection(db, "users", user.uid, "persons", personId, "prayerRequests"))
          batch.set(requestRef, {
            personId: personId,
            personName: personData.name,
            content: request.content,
            createdAt: serverTimestamp(),
            isCompleted: false
          })
        })

        // Add Follow-Ups
        personData.followUps.forEach((followUp: FollowUp) => {
          const followUpRef = doc(collection(db, "users", user.uid, "persons", personId, "followUps"))
          batch.set(followUpRef, {
            personId: personId,
            personName: personData.name,
            content: followUp.content,
            dueDate: Timestamp.fromDate(followUp.dueDate),
            completed: followUp.completed,
            createdAt: serverTimestamp(),
          })
        })

        successfullySavedNames.push(personData.name)
      }

      await batch.commit()

      toast.success("Notes saved successfully!", {
        description: `Saved requests/follow-ups for: ${successfullySavedNames.join(", ")}.`,
      })

      setText("")
      setParsedData([])
      setIsOpen(false)
    } catch (error) {
      console.error("Error saving notes:", error)
      toast.error("Error Saving Notes", {
        description: "Could not save your prayer requests. Please check your connection and try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Render the editor
  const renderEditor = () => (
    <div className="relative">
      <TextareaAutosize
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        placeholder={`Type your prayer notes here...
Use @PersonName to mention someone.
Use #MMDD for follow-up dates.`}
        className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-shrub min-h-[200px] resize-none"
        minRows={8}
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
            {suggestionQuery.trim() && !filteredSuggestions.some(p => p.name.toLowerCase() === suggestionQuery.trim().toLowerCase()) && (
              <Button
                variant="ghost"
                className="w-full justify-start h-8 px-2 mt-1 text-left text-shrub text-sm"
                onClick={() => handleAddPerson(suggestionQuery.trim())}
              >
                Add new person: "{suggestionQuery.trim()}"
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date Autocomplete Suggestions */}
      {showDateSuggestions && (
        <Card
          className="absolute z-10 mt-1 w-full max-w-xs border rounded-md bg-background shadow-lg"
          style={{ top: '100%' }}
        >
          <CardContent className="p-1 max-h-48 overflow-y-auto">
            {filteredDateSuggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-between h-8 px-2 mb-1 text-left text-sm"
                onClick={() => handleSelectDate(suggestion)}
              >
                <span>{suggestion.label}</span>
                <span className="text-muted-foreground text-xs">{suggestion.dateText}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )

  // Render the preview
  const renderPreview = () => (
    <div className="min-h-[200px]">
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
                  {(() => {
                    const lines = person.prayerRequests[0].content
                      .split('\n')
                      .filter(line => line.trim() !== '')
                    if (lines.length > 1) {
                      return (
                        <ul className="list-disc pl-5 space-y-1">
                          {lines.map((line, lineIndex) => (
                            <li key={lineIndex} className="text-sm">
                              {line}
                            </li>
                          ))}
                        </ul>
                      )
                    } else if (lines.length === 1) {
                      return <p className="text-sm">{lines[0]}</p>
                    }
                    return null
                  })()}
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

  if (!user) return null

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full bg-shrub text-white shadow-lg hover:bg-shrub/90 transition-all hover:scale-110 flex items-center justify-center"
        aria-label="Quick capture"
      >
        <FileText className="h-6 w-6" />
      </button>

      {/* Quick Capture Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogDescription>
              Add prayer notes, requests, or follow-ups
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isMobile ? (
              // Mobile: Tabs
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
                  {renderEditor()}
                </TabsContent>
                <TabsContent value="preview" className="mt-4">
                  {renderPreview()}
                </TabsContent>
              </Tabs>
            ) : (
              // Desktop: Side by side
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Editor</h3>
                  {renderEditor()}
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Preview</h3>
                  {renderPreview()}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setText("")
                setParsedData([])
                setIsOpen(false)
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={parsedData.length === 0 || isSaving}
              className="bg-shrub hover:bg-shrub/90"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
