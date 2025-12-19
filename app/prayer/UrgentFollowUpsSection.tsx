"use client"

import { useMemo } from "react"
import { AlertTriangle, Clock, Calendar, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { FollowUp, Person } from "@/lib/types"
import { getUrgencyLevel, formatFollowUpDate } from "@/lib/followUpUtils"
import { cn } from "@/lib/utils"

interface UrgentFollowUpsSectionProps {
  followUps: FollowUp[]
  people: Person[]
  onComplete: (personId: string, followUpId: string) => void
  onPersonClick?: (personId: string) => void
  isCompletingId?: string | null
}

export function UrgentFollowUpsSection({
  followUps,
  people,
  onComplete,
  onPersonClick,
  isCompletingId
}: UrgentFollowUpsSectionProps) {
  // Categorize follow-ups by urgency
  const { overdue, today, soon } = useMemo(() => {
    const overdue: FollowUp[] = []
    const today: FollowUp[] = []
    const soon: FollowUp[] = []

    followUps.forEach(fu => {
      const urgency = getUrgencyLevel(fu.dueDate)
      if (urgency === "overdue") overdue.push(fu)
      else if (urgency === "today") today.push(fu)
      else if (urgency === "soon") soon.push(fu)
    })

    // Sort by due date within each category
    const sortByDate = (a: FollowUp, b: FollowUp) =>
      (a.dueDate?.seconds ?? 0) - (b.dueDate?.seconds ?? 0)

    return {
      overdue: overdue.sort(sortByDate),
      today: today.sort(sortByDate),
      soon: soon.sort(sortByDate)
    }
  }, [followUps])

  // Helper to get person name
  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId)
    return person?.name || "Unknown"
  }

  // Don't render if no urgent items
  if (overdue.length === 0 && today.length === 0 && soon.length === 0) {
    return null
  }

  return (
    <Card className="mb-6 border-shrub/30">
      <Accordion type="multiple" defaultValue={overdue.length > 0 ? ['overdue'] : []}>
        {/* Overdue Section */}
        {overdue.length > 0 && (
          <AccordionItem value="overdue">
            <AccordionTrigger className="bg-card border border-shrub/20 px-4 py-3 hover:no-underline hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-shrub" />
                <span className="font-semibold">Attention</span>
                <Badge className="bg-shrub hover:bg-shrub/90 text-primary-foreground">
                  {overdue.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4">
              <ul className="space-y-3">
                {overdue.map(fu => (
                  <li
                    key={fu.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted border border-shrub/20"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => onComplete(fu.personId, fu.id)}
                      disabled={isCompletingId === fu.id}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onPersonClick?.(fu.personId)}
                        className="font-medium text-sm hover:underline text-left"
                      >
                        {getPersonName(fu.personId)}
                      </button>
                      <p className="text-sm mt-1">{fu.content}</p>
                      {fu.dueDate && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-shrub hover:bg-shrub/90 text-primary-foreground text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatFollowUpDate(fu.dueDate)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Due Today Section */}
        {today.length > 0 && (
          <AccordionItem value="today">
            <AccordionTrigger className="bg-card border px-4 py-3 hover:no-underline hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-shrub" />
                <span className="font-semibold">Due Today</span>
                <Badge variant="outline">
                  {today.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4">
              <ul className="space-y-3">
                {today.map(fu => (
                  <li
                    key={fu.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => onComplete(fu.personId, fu.id)}
                      disabled={isCompletingId === fu.id}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onPersonClick?.(fu.personId)}
                        className="font-medium text-sm hover:underline text-left"
                      >
                        {getPersonName(fu.personId)}
                      </button>
                      <p className="text-sm mt-1">{fu.content}</p>
                      {fu.dueDate && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Today
                          </Badge>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Due Soon Section */}
        {soon.length > 0 && (
          <AccordionItem value="soon">
            <AccordionTrigger className="bg-card border px-4 py-3 hover:no-underline hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-shrub" />
                <span className="font-semibold">Due Soon (Next 3 Days)</span>
                <Badge variant="outline">
                  {soon.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4">
              <ul className="space-y-3">
                {soon.map(fu => (
                  <li
                    key={fu.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => onComplete(fu.personId, fu.id)}
                      disabled={isCompletingId === fu.id}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onPersonClick?.(fu.personId)}
                        className="font-medium text-sm hover:underline text-left"
                      >
                        {getPersonName(fu.personId)}
                      </button>
                      <p className="text-sm mt-1">{fu.content}</p>
                      {fu.dueDate && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatFollowUpDate(fu.dueDate)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </Card>
  )
}
