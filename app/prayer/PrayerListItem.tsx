"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Heart, Clock } from "lucide-react"
import { Person, PrayerRequest, FollowUp } from "@/lib/types" // Assuming types are in lib/types
import { Timestamp } from "firebase/firestore"
import { formatDate } from "@/lib/utils" // Assuming formatDate is shareable

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
              <p className="text-sm text-muted-foreground line-clamp-2"> {/* Limit lines */}
                {mostRecentRequest.content}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Added {formatDate(mostRecentRequest.createdAt.toDate())}
                </span>
                {/* Placeholder for per-request prayed count - Data model doesn't support this yet */}
                {/* {mostRecentRequest.prayedCount > 0 && (
                  <span className="flex items-center">
                    <Heart className="h-3 w-3 mr-1 text-red-500 fill-current" /> {mostRecentRequest.prayedCount}
                  </span>
                )} */}
              </div>
            </div>
          )}
        </div>
        {/* Pray Button */}
        <Button
          variant="default"
          size="sm"
          className="gap-1 bg-shrub hover:bg-shrub/90 text-white min-w-[80px]"
          onClick={handleMarkPrayed}
          disabled={isMarkingPrayed}
        >
          {isMarkingPrayed ? (
            <span className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
          ) : (
            <><Heart className="h-4 w-4" /> Pray</>
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
              {/* Prayer Requests Section */}
              <div>
                <h4 className="text-sm font-medium mb-1">Prayer Requests:</h4>
                {expandedRequests.length > 0 ? (
                  <ul className="space-y-2">
                    {expandedRequests.slice(0, 3).map((req) => (
                      <li key={req.id} className="text-sm text-muted-foreground">
                        <p className="line-clamp-3">{req.content}</p> {/* Truncate */}
                        <span className="text-xs block mt-0.5">
                          Added {formatDate(req.createdAt.toDate())}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No prayer requests found.</p>
                )}
                {expandedRequests.length > 3 && (
                   <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                     View all {expandedRequests.length} requests... {/* TODO: Implement Modal */}
                   </Button>
                )}
              </div>

              {/* Follow-ups Section */}
              <div>
                <h4 className="text-sm font-medium mb-2">Follow-ups:</h4>
                 {/* Filter for active follow-ups before mapping */}
                {expandedFollowUps.filter(fu => !fu.completed).length > 0 ? (
                  <ul className="space-y-2">
                    {expandedFollowUps.filter(fu => !fu.completed).map((fu) => (
                      <li key={fu.id} className="flex items-center gap-2">
                        <Checkbox
                           id={`followup-${fu.id}`}
                           onCheckedChange={() => handleCheckboxChange(fu.id)}
                           // Add disabled state while updating if needed
                        />
                        <label htmlFor={`followup-${fu.id}`} className="text-sm text-muted-foreground flex-1">
                          {fu.content}
                          {fu.dueDate && ( // Display due date if available
                             <span className="text-xs block text-gray-500">
                               Due {formatDate(fu.dueDate.toDate())}
                             </span>
                          )}
                        </label>
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
      <CardFooter className="pt-0 pb-3">
         <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs h-auto py-1"
            onClick={handleToggleExpand}
          >
            {isExpanded ? (
              <><ChevronUp className="h-4 w-4 mr-1" /> Show less</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-1" /> Show more</>
            )}
         </Button>
      </CardFooter>
    </Card>
  )
} 