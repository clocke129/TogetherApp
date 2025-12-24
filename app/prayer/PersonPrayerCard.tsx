"use client"

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

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto overscroll-contain prayer-card-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
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
            <p className="text-base whitespace-pre-wrap">{expandedRequests[0].content}</p>
            {expandedRequests[0].createdAt && (
              <p className="text-xs text-muted-foreground">
                {formatDate(expandedRequests[0].createdAt.toDate())}
              </p>
            )}
          </div>
        ) : mostRecentRequest ? (
          <div className="space-y-2">
            <p className="text-base whitespace-pre-wrap">{mostRecentRequest.content}</p>
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

      {/* Past Requests (Accordion) */}
      {expandedRequests.length > 1 && (
        <Accordion type="single" collapsible className="mb-6">
          <AccordionItem value="past-requests">
            <AccordionTrigger className="text-base font-semibold">
              Past Requests ({expandedRequests.length - 1} more)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {expandedRequests.slice(1, 4).map((request) => (
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

    </div>
  )
}
