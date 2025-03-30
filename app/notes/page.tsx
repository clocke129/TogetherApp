"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { User, Calendar, Maximize2, Minimize2, Eye, Edit } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useMobile } from "@/hooks/use-mobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

// Mock data for suggestions
const PEOPLE_SUGGESTIONS = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Sarah Johnson" },
  { id: "3", name: "Michael Brown" },
  { id: "4", name: "Emily Davis" },
]

export default function NotesPage() {
  const [text, setText] = useState("")
  const [parsedData, setParsedData] = useState<Person[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [filteredSuggestions, setFilteredSuggestions] = useState(PEOPLE_SUGGESTIONS)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")

  const isMobile = useMobile()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

    // Get cursor position
    const position = e.target.selectionStart || 0
    setCursorPosition(position)

    // Check if we should show suggestions (after @ symbol)
    const lastAtSymbolIndex = newText.lastIndexOf("@", position)
    if (lastAtSymbolIndex !== -1 && lastAtSymbolIndex < position) {
      const query = newText.substring(lastAtSymbolIndex + 1, position).trim()
      setSuggestionQuery(query)

      // Filter suggestions based on query
      const filtered = PEOPLE_SUGGESTIONS.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()))
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
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

      {/* Suggestions popup */}
      {showSuggestions && (
        <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-auto rounded-md border bg-popover shadow-md">
          <div className="p-2 text-xs text-muted-foreground">People suggestions:</div>
          {filteredSuggestions.map((person) => (
            <button
              key={person.id}
              className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
              onClick={() => handleSelectPerson(person)}
            >
              <User className="mr-2 h-4 w-4" />
              {person.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Render the preview component
  const renderPreview = () => (
    <div>
      {parsedData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Your parsed prayer requests will appear here</p>
          <p className="text-sm mt-2">
            Try typing <code>@John Smith</code> to get started
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
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Note Editor</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8 p-0">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {renderEditor()}
            <div className="mt-4 flex justify-end">
              <Button>Save Notes</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>{renderPreview()}</CardContent>
        </Card>
      </div>
    </div>
  )

  // Render mobile layout
  const renderMobileLayout = () => (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "editor" | "preview")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Note Editor</CardTitle>
                <Button variant="ghost" size="sm" onClick={toggleMobileView} className="h-8 w-8 p-0">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {renderEditor()}
              <div className="mt-4 flex justify-end">
                <Button>Save Notes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Preview</CardTitle>
                <Button variant="ghost" size="sm" onClick={toggleMobileView} className="h-8 w-8 p-0">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>{renderPreview()}</CardContent>
          </Card>
        </TabsContent>
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

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen} className="max-w-[95vw]">
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0">
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
                className="min-h-[calc(90vh-120px)] w-full font-mono resize-none"
              />

              {/* Suggestions popup (same as above) */}
              {showSuggestions && (
                <div className="absolute z-10 mt-1 w-full max-w-[calc(100%-2rem)] max-h-[200px] overflow-auto rounded-md border bg-popover shadow-md">
                  <div className="p-2 text-xs text-muted-foreground">People suggestions:</div>
                  {filteredSuggestions.map((person) => (
                    <button
                      key={person.id}
                      className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
                      onClick={() => handleSelectPerson(person)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      {person.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <Button>Save Notes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

