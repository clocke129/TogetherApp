"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
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
import { useMobile } from "@/hooks/use-mobile"

interface PersonPrayerCardProps {
  person: Person
  mostRecentRequest?: PrayerRequest
  expandedRequests: PrayerRequest[]
  isLoadingExpanded: boolean
  onAddRequest?: () => void
}

export function PersonPrayerCard({
  person,
  mostRecentRequest,
  expandedRequests,
  isLoadingExpanded,
  onAddRequest
}: PersonPrayerCardProps) {
  const isMobile = useMobile()
  const [isPastRequestsOpen, setIsPastRequestsOpen] = useState(false)
  const [isCurrentRequestExpanded, setIsCurrentRequestExpanded] = useState(false)
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
        {person.lastPrayedFor && (
          <p className="text-sm text-muted-foreground mt-1">
            Last prayed: {formatDate(person.lastPrayedFor.toDate())}
          </p>
        )}
      </div>

      {/* Current Requests */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Current Requests</h3>
          {onAddRequest && (
            <Button variant="ghost" size="sm" onClick={onAddRequest} className="text-muted-foreground hover:text-foreground">
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

    </div>
  )
}
