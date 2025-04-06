"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Heart, Clock, Check, Calendar } from "lucide-react"
import { Person, PrayerRequest, FollowUp } from "@/lib/types" // Assuming types are in lib/types
import { Timestamp } from "firebase/firestore"
import { formatDate } from "@/lib/utils" // Assuming formatDate is shareable
import { cn } from "@/lib/utils"

// Define Props for the component
interface PrayerListItemProps {
  person: Person
  mostRecentRequest?: PrayerRequest // Passed for collapsed view
  groupName?: string
  isExpanded: boolean
  isLoadingExpanded: boolean // Loading state for requests/follow-ups
  expandedRequests: PrayerRequest[] // Fetched when expanded
  expandedFollowUps: FollowUp[] // Fetched when expanded
  onToggleExpand: (personId: string) => void
  onMarkPrayed: (person: Person) => void
  onCompleteFollowUp: (personId: string, followUpId: string) => void
  isMarkingPrayed: boolean // To disable pray button
  isPrayedToday: boolean // NEW: Indicates if prayed for today
  // Add any other necessary props like error states later
}

export function PrayerListItem({
  person,
  mostRecentRequest,
  groupName,
  isExpanded,
  isLoadingExpanded,
  expandedRequests,
  expandedFollowUps,
  onToggleExpand,
  onMarkPrayed,
  onCompleteFollowUp,
  isMarkingPrayed,
  isPrayedToday,
}: PrayerListItemProps) {

  const handleToggleExpand = () => {
    onToggleExpand(person.id)
  }

  const handleMarkPrayed = () => {
    onMarkPrayed(person)
  }

  const handleCheckboxChange = (followUpId: string) => {
    onCompleteFollowUp(person.id, followUpId)
  }

  // --- RENDER LOGIC WILL GO HERE ---
  // Based on isExpanded, render collapsed or expanded view
  // Use mostRecentRequest for collapsed view
  // Use expandedRequests, expandedFollowUps for expanded view

  return (
    <Card>
      {/* CardHeader for Name, Badge, Pray Button - Common to both views */}
      <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-2">
        <div className="flex-1 space-y-1">
          <CardTitle className="text-lg font-semibold">{person.name}</CardTitle>
          {groupName && (
            <Badge variant="outline">{groupName}</Badge>
          )}
          {/* Collapsed View: Most Recent Request Content & Date */}
          {!isExpanded && mostRecentRequest && (
            <div className="pt-1 space-y-1">
              {/* Display full content, respect newlines */}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {mostRecentRequest.content}
              </p>
              {/* Re-add the date display for collapsed view */}
              <div className="flex items-center text-xs text-muted-foreground pt-1">
                <span className="flex items-center flex-shrink-0">
                  <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                  {formatDate(mostRecentRequest.createdAt.toDate())}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Pray Button */}
        <Button
          variant={isPrayedToday ? "outline" : "default"}
          size="sm"
          className={cn(
            "gap-1 min-w-[90px]",
            !isPrayedToday && "bg-shrub hover:bg-shrub/90 text-white"
          )}
          onClick={handleMarkPrayed}
          disabled={isMarkingPrayed}
        >
          {isMarkingPrayed ? (
            <span className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
          ) : (
            <>{isPrayedToday ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />} {isPrayedToday ? "Prayed" : "Pray"}</>
          )}
        </Button>
      </CardHeader>

      {/* Expanded View: Content (Requests & Follow-ups) */}
      {isExpanded && (
        <CardContent className="pt-2 pb-3 space-y-4">
          {isLoadingExpanded ? (
            <p className="text-muted-foreground text-sm">Loading details...</p>
          ) : (
            <>
              {/* Prayer Requests Section - Handles both single consolidated and multiple individual requests */}
              <div>
                <h4 className="text-sm font-medium mb-2">Prayer Requests:</h4>
                {expandedRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic pl-4">No prayer requests found.</p>
                ) : expandedRequests.length === 1 ? (
                  // SCENARIO 1: Single Request (potentially multi-line/consolidated)
                  <div className="pl-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {expandedRequests[0].content}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground pt-1">
                       <span className="flex items-center flex-shrink-0">
                         <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                         {formatDate(expandedRequests[0].createdAt.toDate())}
                       </span>
                     </div>
                  </div>
                ) : (
                  // SCENARIO 2: Multiple Individual Requests
                  <>
                    <ul className="space-y-1 pl-4">
                      {expandedRequests.slice(0, 3).map((req) => (
                        <li key={req.id} className="text-xs py-1 flex justify-between items-start gap-4">
                          {/* Restore bullet point and content display */}
                          <p className="text-foreground flex-1"><span className="mr-2">•</span>{req.content}</p>
                          {/* Restore side-aligned date */}
                          <span className="flex items-center text-muted-foreground flex-shrink-0">
                            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            {formatDate(req.createdAt.toDate())}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {/* Restore "View all" button if more than 3 requests */}
                    {expandedRequests.length > 3 && (
                      <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs pl-4">
                        View all {expandedRequests.length} requests... {/* TODO: Implement Modal */}
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Follow-ups Section */}
              <div>
                <h4 className="text-sm font-medium mb-2">Follow-ups:</h4>
                 {/* Filter for active follow-ups before mapping */}
                {expandedFollowUps.filter(fu => !fu.completed).length > 0 ? (
                  <ul className="space-y-1 pl-4">
                    {expandedFollowUps.filter(fu => !fu.completed).map((fu) => (
                      <li key={fu.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                           id={`followup-${fu.id}`}
                           onCheckedChange={() => handleCheckboxChange(fu.id)}
                           className="flex-shrink-0"
                        />
                        <label htmlFor={`followup-${fu.id}`} className="text-xs text-muted-foreground">
                          {fu.content}
                        </label>
                        {fu.dueDate && ( // Display due date if available
                           <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                             <Calendar className="h-3 w-3" />
                             {formatDate(fu.dueDate.toDate())}
                           </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No active follow-ups.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}

      {/* CardFooter for Show More/Less */}
      <CardFooter className="pt-0 pb-3 flex justify-center"> {/* Center the button */}
         <Button
            variant="ghost"
            size="icon" // Use icon size for a smaller, square button
            className="h-7 w-7" // Make it small
            onClick={handleToggleExpand}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" /> // Icon only
            ) : (
              <ChevronDown className="h-4 w-4" /> // Icon only
            )}
            <span className="sr-only">{isExpanded ? "Show less" : "Show more"}</span> {/* Keep text for screen readers */}
         </Button>
      </CardFooter>
    </Card>
  )
} 