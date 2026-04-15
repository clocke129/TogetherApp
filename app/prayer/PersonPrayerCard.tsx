"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, CalendarIcon } from "lucide-react"
import type { Person, PrayerRequest } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface PersonPrayerCardProps {
  person: Person
  mostRecentRequest?: PrayerRequest
  expandedRequests: PrayerRequest[]
  isLoadingExpanded: boolean
  onAddRequest?: (content: string) => Promise<void>
  onAddFollowUp?: (content: string, dueDate?: Date) => Promise<void>
}

export function PersonPrayerCard({
  person,
  mostRecentRequest,
  expandedRequests,
  isLoadingExpanded,
  onAddRequest,
  onAddFollowUp
}: PersonPrayerCardProps) {
  const isMobile = useMobile()
  const [isPastRequestsOpen, setIsPastRequestsOpen] = useState(false)
  const [isCurrentRequestExpanded, setIsCurrentRequestExpanded] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"request" | "followup">("request")
  const [requestContent, setRequestContent] = useState("")
  const [followUpContent, setFollowUpContent] = useState("")
  const [followUpDueDate, setFollowUpDueDate] = useState<Date | undefined>(undefined)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const MAX_CHARS = 150 // Reduced to ensure "See Past Requests" is visible
  const pastRequestsToShow = expandedRequests.slice(1, 6) // Show up to 5 past requests

  // Helper function to render content with bullet points for newline-separated items
  const renderContent = (content: string, isExpanded: boolean) => {
    const shouldTruncate = content.length > MAX_CHARS
    const displayText = isExpanded || !shouldTruncate
      ? content
      : content.slice(0, MAX_CHARS) + '...'

    // Split by newlines and filter out empty lines
    const lines = displayText.split('\n').filter(line => line.trim())

    // If multiple lines, render as bullets; otherwise render as paragraph
    if (lines.length > 1) {
      return (
        <>
          <ul className="list-disc list-inside space-y-1 text-base">
            {lines.map((line, index) => (
              <li key={index} className="whitespace-pre-wrap">{line.trim()}</li>
            ))}
          </ul>
          {shouldTruncate && (
            <Button
              variant="link"
              onClick={() => setIsCurrentRequestExpanded(!isCurrentRequestExpanded)}
              className="p-0 h-auto text-sm"
            >
              {isCurrentRequestExpanded ? 'Show less' : 'Read more'}
            </Button>
          )}
        </>
      )
    } else {
      return (
        <>
          <p className="text-base whitespace-pre-wrap">{displayText}</p>
          {shouldTruncate && (
            <Button
              variant="link"
              onClick={() => setIsCurrentRequestExpanded(!isCurrentRequestExpanded)}
              className="p-0 h-auto text-sm"
            >
              {isCurrentRequestExpanded ? 'Show less' : 'Read more'}
            </Button>
          )}
        </>
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto overscroll-contain prayer-card-scroll" style={{
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y'
    }}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{person.name}</h2>
      </div>

      {/* Current Requests */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Current Requests</h3>
          {(onAddRequest || onAddFollowUp) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
        {isLoadingExpanded ? (
          <p className="text-sm text-muted-foreground italic">Loading...</p>
        ) : expandedRequests.length > 0 ? (
          <div className="space-y-2">
            {renderContent(expandedRequests[0].content, isCurrentRequestExpanded)}
            {expandedRequests[0].createdAt && (
              <p className="text-xs text-muted-foreground">
                {formatDate(expandedRequests[0].createdAt.toDate())}
              </p>
            )}
          </div>
        ) : mostRecentRequest ? (
          <div className="space-y-2">
            {renderContent(mostRecentRequest.content, isCurrentRequestExpanded)}
            {mostRecentRequest.createdAt && (
              <p className="text-xs text-muted-foreground">
                {formatDate(mostRecentRequest.createdAt.toDate())}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No prayer requests yet.</p>
        )}
      </div>

      {/* Past Requests */}
      {expandedRequests.length > 1 && (
        <>
          {isMobile ? (
            // Mobile: Button that opens Dialog modal
            <>
              <Button
                variant="outline"
                className="w-full justify-start text-base font-semibold mb-6"
                onClick={() => setIsPastRequestsOpen(true)}
              >
                See Past Requests ({pastRequestsToShow.length} recent)
              </Button>

              <Dialog open={isPastRequestsOpen} onOpenChange={setIsPastRequestsOpen}>
                <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Past Requests for {person.name}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {pastRequestsToShow.map((request) => (
                      <div key={request.id} className="space-y-1 pb-4 border-b last:border-0">
                        <p className="text-sm whitespace-pre-wrap">{request.content}</p>
                        {request.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(request.createdAt.toDate())}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            // Desktop: Keep Accordion
            <Accordion type="single" collapsible className="mb-6">
              <AccordionItem value="past-requests">
                <AccordionTrigger className="text-base font-semibold">
                  Past Requests ({pastRequestsToShow.length} recent)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {pastRequestsToShow.map((request) => (
                      <div key={request.id} className="space-y-1">
                        <p className="text-sm whitespace-pre-wrap">{request.content}</p>
                        {request.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(request.createdAt.toDate())}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </>
      )}

      {/* Add Prayer Request / Follow-Up Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add for {person.name}</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "request" | "followup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="request">Prayer Request</TabsTrigger>
              <TabsTrigger value="followup">Follow-Up</TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="space-y-4 mt-4">
              <Textarea
                placeholder="What would you like prayer for?"
                value={requestContent}
                onChange={(e) => setRequestContent(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setRequestContent("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!requestContent.trim() || isSubmitting || !onAddRequest}
                  onClick={async () => {
                    if (onAddRequest && requestContent.trim()) {
                      setIsSubmitting(true)
                      try {
                        await onAddRequest(requestContent.trim())
                        setIsAddModalOpen(false)
                        setRequestContent("")
                      } catch (error) {
                        console.error("Error adding prayer request:", error)
                      } finally {
                        setIsSubmitting(false)
                      }
                    }
                  }}
                >
                  {isSubmitting ? "Adding..." : "Add Request"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="followup" className="space-y-4 mt-4">
              <Textarea
                placeholder="Quick note or follow-up..."
                value={followUpContent}
                onChange={(e) => setFollowUpContent(e.target.value)}
                rows={4}
              />

              {/* Due Date Picker */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Due date:</Label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal flex-1",
                        !followUpDueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {followUpDueDate ? formatDate(followUpDueDate) : "Optional"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followUpDueDate}
                      onSelect={(date) => {
                        setFollowUpDueDate(date)
                        setIsDatePickerOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {followUpDueDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFollowUpDueDate(undefined)}
                    className="text-muted-foreground h-8 px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setFollowUpContent("")
                    setFollowUpDueDate(undefined)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!followUpContent.trim() || isSubmitting || !onAddFollowUp}
                  onClick={async () => {
                    if (onAddFollowUp && followUpContent.trim()) {
                      setIsSubmitting(true)
                      try {
                        await onAddFollowUp(followUpContent.trim(), followUpDueDate)
                        setIsAddModalOpen(false)
                        setFollowUpContent("")
                        setFollowUpDueDate(undefined)
                      } catch (error) {
                        console.error("Error adding follow-up:", error)
                      } finally {
                        setIsSubmitting(false)
                      }
                    }
                  }}
                >
                  {isSubmitting ? "Adding..." : "Add Follow-Up"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
