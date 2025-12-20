"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Heart, Calendar, Check, Plus } from "lucide-react"
import type { Person, PrayerRequest, FollowUp } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { getUrgencyLevel, sortFollowUpsByUrgency } from "@/lib/followUpUtils"
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
  expandedFollowUps: FollowUp[]
  isLoadingExpanded: boolean
  onMarkPrayed: (person: Person) => void
  onCompleteFollowUp: (personId: string, followUpId: string) => void
  isMarkingPrayed: boolean
  isCompletingFollowUpId: string | null
  isPrayedToday: boolean
  onAddRequest?: () => void
  onAddFollowUp?: () => void
}

export function PersonPrayerCard({
  person,
  mostRecentRequest,
  expandedRequests,
  expandedFollowUps,
  isLoadingExpanded,
  onMarkPrayed,
  onCompleteFollowUp,
  isMarkingPrayed,
  isCompletingFollowUpId,
  isPrayedToday,
  onAddRequest,
  onAddFollowUp
}: PersonPrayerCardProps) {
  const activeFollowUps = sortFollowUpsByUrgency(
    expandedFollowUps.filter(fu => !fu.completed)
  )

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{person.name}</h2>
          {person.lastPrayedFor && (
            <p className="text-sm text-muted-foreground mt-1">
              Last prayed: {formatDate(person.lastPrayedFor.toDate())}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            variant={isPrayedToday ? "secondary" : "default"}
            size="lg"
            onClick={() => onMarkPrayed(person)}
            disabled={isMarkingPrayed}
          >
            {isPrayedToday ? (
              <>
                <Check className="mr-2 h-5 w-5" />
                Prayed
              </>
            ) : (
              <>
                <Heart className="mr-2 h-5 w-5" />
                Pray
              </>
            )}
          </Button>
          {(onAddRequest || onAddFollowUp) && (
            <div className="flex gap-2">
              {onAddRequest && (
                <Button variant="outline" size="sm" onClick={onAddRequest}>
                  <Plus className="h-4 w-4 mr-1" />
                  Request
                </Button>
              )}
              {onAddFollowUp && (
                <Button variant="outline" size="sm" onClick={onAddFollowUp}>
                  <Plus className="h-4 w-4 mr-1" />
                  Follow-up
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current Requests */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Current Requests</h3>
        {isLoadingExpanded ? (
          <p className="text-sm text-muted-foreground italic">Loading...</p>
        ) : expandedRequests.length > 0 ? (
          <ul className="space-y-3">
            {expandedRequests.slice(0, 3).map((request) => (
              <li key={request.id} className="text-base">
                • {request.content}
                {request.createdAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({formatDate(request.createdAt.toDate())})
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : mostRecentRequest ? (
          <p className="text-base">• {mostRecentRequest.content}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No prayer requests yet.</p>
        )}
      </div>

      {/* Past Requests (Accordion) */}
      {expandedRequests.length > 3 && (
        <Accordion type="single" collapsible className="mb-6">
          <AccordionItem value="past-requests">
            <AccordionTrigger className="text-base font-semibold">
              Past Requests ({expandedRequests.length - 3} more)
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {expandedRequests.slice(3).map((request) => (
                  <li key={request.id} className="text-sm">
                    • {request.content}
                    {request.createdAt && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({formatDate(request.createdAt.toDate())})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Follow-ups */}
      {activeFollowUps.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Follow-ups</h3>
          <ul className="space-y-2">
            {activeFollowUps.map((fu) => {
              const urgency = getUrgencyLevel(fu.dueDate)
              const isOverdue = urgency === "overdue"
              const isToday = urgency === "today"
              const isSoon = urgency === "soon"

              return (
                <li
                  key={fu.id}
                  className={cn(
                    "flex items-start gap-2 p-3 rounded-lg",
                    isOverdue && "bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-800",
                    isToday && "bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200 dark:border-orange-800",
                    isSoon && "bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-800"
                  )}
                >
                  <Checkbox
                    id={`followup-${fu.id}`}
                    onCheckedChange={() => onCompleteFollowUp(person.id, fu.id)}
                    disabled={isCompletingFollowUpId === fu.id}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`followup-${fu.id}`} className="text-sm block cursor-pointer">
                      {fu.content}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      {fu.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(fu.dueDate.toDate())}
                        </span>
                      )}
                      {isOverdue && (
                        <Badge className="bg-red-600 dark:bg-red-700 text-white text-[10px] px-1.5 py-0">
                          Overdue
                        </Badge>
                      )}
                      {isToday && (
                        <Badge className="bg-orange-600 dark:bg-orange-700 text-white text-[10px] px-1.5 py-0">
                          Today
                        </Badge>
                      )}
                      {isSoon && (
                        <Badge className="bg-blue-600 dark:bg-blue-700 text-white text-[10px] px-1.5 py-0">
                          Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
