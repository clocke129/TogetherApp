"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronDown, Heart, Check, Users } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { PersonPrayerCard } from "./PersonPrayerCard"
import { SummaryCard } from "./SummaryCard"
import type { Group, Person, PrayerRequest } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"

interface PersonWithDetails extends Person {
  mostRecentRequest?: PrayerRequest
  expandedRequests: PrayerRequest[]
  isLoadingExpanded: boolean
}

interface UnifiedLoopPerson {
  person: Person & { mostRecentRequest?: PrayerRequest }
  groupId: string
  groupName: string
}

interface PrayedPerson {
  person: Person & { mostRecentRequest?: PrayerRequest }
  groupId: string
  groupName: string
  prayedAt: Date
}

interface GroupNavInfo {
  index: number
  name: string
  count: number
}

// Legacy props for single group mode
interface SingleGroupModeProps {
  mode: 'single'
  group: Group
  people: PersonWithDetails[]
}

// New props for unified mode
interface UnifiedModeProps {
  mode: 'unified'
  unifiedLoopPeople: UnifiedLoopPerson[]
  expandedData: {
    requests: PrayerRequest[]
    loading: boolean
  }
  prayedThisSession: PrayedPerson[]
  showSummaryCard: boolean
  groupStartIndices: Map<string, GroupNavInfo>
  onJumpToGroup: (groupId: string) => void
  onRestoreMultiple: (prayedPeople: PrayedPerson[]) => void
}

type FocusedPrayerModeProps = {
  isOpen: boolean
  onClose: () => void
  currentPersonIndex: number
  onPersonIndexChange: (index: number) => void
  onMarkPrayed: (person: Person) => void
  isMarkingPrayed: boolean
  prayerListDate: Date
  onAddRequest?: (personId: string) => void
  onAddFollowUp?: (personId: string, content: string, dueDate?: Date) => Promise<void>
} & (SingleGroupModeProps | UnifiedModeProps)

export function FocusedPrayerMode(props: FocusedPrayerModeProps) {
  const {
    isOpen,
    onClose,
    currentPersonIndex,
    onPersonIndexChange,
    onMarkPrayed,
    isMarkingPrayed,
    prayerListDate,
    onAddRequest,
    onAddFollowUp
  } = props

  const [api, setApi] = useState<CarouselApi>()
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false)
  const [exitingPersonId, setExitingPersonId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()

  // Determine mode and get relevant data
  const isUnifiedMode = props.mode === 'unified'

  const people: PersonWithDetails[] = isUnifiedMode
    ? props.unifiedLoopPeople.map(item => ({
        ...item.person,
        expandedRequests: props.expandedData?.requests || [],
        isLoadingExpanded: props.expandedData?.loading || false
      }))
    : (props as SingleGroupModeProps).people

  const currentGroupName = isUnifiedMode && props.unifiedLoopPeople.length > 0 && currentPersonIndex < props.unifiedLoopPeople.length
    ? props.unifiedLoopPeople[currentPersonIndex].groupName
    : (props as SingleGroupModeProps).group?.name || ''

  const showSummary = isUnifiedMode && props.showSummaryCard

  // Get all unique groups for the navigation dropdown
  const groupsForNav = isUnifiedMode
    ? Array.from(props.groupStartIndices.entries()).map(([id, info]) => ({
        id,
        name: info.name,
        count: info.count,
        index: info.index
      }))
    : []

  // Sync carousel to state
  useEffect(() => {
    if (!api) return

    api.on('select', () => {
      onPersonIndexChange(api.selectedScrollSnap())
    })

    return () => {
      api.off('select', () => {})
    }
  }, [api, onPersonIndexChange])

  // Sync state to carousel when index changes externally
  useEffect(() => {
    if (api && isOpen && !showSummary) {
      api.scrollTo(currentPersonIndex, false)
    }
  }, [currentPersonIndex, api, isOpen, showSummary])

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMobile && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGroupSwitcherOpen(false)
      }
    }

    if (isGroupSwitcherOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isGroupSwitcherOpen, isMobile])

  const canScrollPrev = api?.canScrollPrev() ?? false
  const canScrollNext = api?.canScrollNext() ?? false

  const handlePrevious = () => {
    if (api) {
      api.scrollPrev()
    }
  }

  const handleNext = () => {
    if (api) {
      api.scrollNext()
    }
  }

  const handleMarkPrayed = (person: Person) => {
    if (isUnifiedMode) {
      // Start exit animation
      setExitingPersonId(person.id)
      // Wait for animation, then call actual handler
      setTimeout(() => {
        onMarkPrayed(person)
        setExitingPersonId(null)
      }, 250)
    } else {
      onMarkPrayed(person)
    }
  }

  const isSameDay = (timestamp: any, date: Date): boolean => {
    if (!timestamp || !timestamp.toDate) return false
    const tsDate = timestamp.toDate()
    return (
      tsDate.getFullYear() === date.getFullYear() &&
      tsDate.getMonth() === date.getMonth() &&
      tsDate.getDate() === date.getDate()
    )
  }

  const handleGroupSelect = (groupId: string) => {
    if (isUnifiedMode) {
      props.onJumpToGroup(groupId)
    }
    setIsGroupSwitcherOpen(false)
  }

  // Empty state
  if (people.length === 0 && !showSummary) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl w-full">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No people to pray for</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Render group switcher button and dropdown/drawer
  const renderGroupSwitcher = () => {
    if (!isUnifiedMode || groupsForNav.length <= 1) {
      return <h2 className="text-lg font-semibold">{currentGroupName}</h2>
    }

    if (isMobile) {
      return (
        <>
          <Button
            variant="ghost"
            className="text-lg font-semibold gap-2"
            onClick={() => setIsGroupSwitcherOpen(true)}
          >
            {currentGroupName}
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Drawer open={isGroupSwitcherOpen} onOpenChange={setIsGroupSwitcherOpen}>
            <DrawerContent>
              <DrawerTitle className="sr-only">Jump to Group</DrawerTitle>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {groupsForNav.map((g) => (
                  <Button
                    key={g.id}
                    variant={g.name === currentGroupName ? "secondary" : "ghost"}
                    className="w-full justify-between text-base"
                    onClick={() => handleGroupSelect(g.id)}
                  >
                    <span>{g.name}</span>
                    <span className="text-muted-foreground text-sm flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {g.count}
                    </span>
                  </Button>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )
    }

    // Desktop dropdown
    return (
      <div ref={dropdownRef} className="relative">
        <Button
          variant="ghost"
          className="text-lg font-semibold gap-2"
          onClick={() => setIsGroupSwitcherOpen(!isGroupSwitcherOpen)}
        >
          {currentGroupName}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isGroupSwitcherOpen && "rotate-180")} />
        </Button>

        {isGroupSwitcherOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-h-80 overflow-y-auto bg-popover border rounded-md shadow-lg z-50">
            <div className="p-2 space-y-1">
              {groupsForNav.map((g) => (
                <Button
                  key={g.id}
                  variant={g.name === currentGroupName ? "secondary" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => handleGroupSelect(g.id)}
                >
                  <span>{g.name}</span>
                  <span className="text-muted-foreground text-xs flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {g.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "w-full flex flex-col",
        isMobile ? "max-h-[95vh]" : "max-w-2xl max-h-[85vh]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-center h-16 px-6 border-b bg-background shrink-0 relative">
          <DialogTitle className="sr-only">{currentGroupName}</DialogTitle>
          {!showSummary && renderGroupSwitcher()}
          {showSummary && <h2 className="text-lg font-semibold">Summary</h2>}
        </div>

        {/* Content Area */}
        {showSummary && isUnifiedMode ? (
          <SummaryCard
            prayedPeople={props.prayedThisSession}
            onRestoreMultiple={props.onRestoreMultiple}
            onDone={onClose}
          />
        ) : (
          <>
            {/* Carousel Area */}
            <div className="flex-1 overflow-hidden">
              <Carousel
                setApi={setApi}
                opts={{
                  startIndex: currentPersonIndex,
                  loop: false,
                  duration: 40,
                }}
                className="h-full"
              >
                <CarouselContent className="h-full">
                  {people.map((person, idx) => (
                    <CarouselItem
                      key={person.id}
                      className={cn(
                        "h-full flex flex-col transition-all duration-250",
                        exitingPersonId === person.id && "opacity-0 scale-95"
                      )}
                    >
                      <PersonPrayerCard
                        person={person}
                        mostRecentRequest={person.mostRecentRequest}
                        expandedRequests={person.expandedRequests}
                        isLoadingExpanded={person.isLoadingExpanded}
                        onAddRequest={onAddRequest ? () => onAddRequest(person.id) : undefined}
                        onAddFollowUp={onAddFollowUp ? (content: string, dueDate?: Date) => onAddFollowUp(person.id, content, dueDate) : undefined}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>

            {/* Floating Action Button - Pray */}
            <Button
              variant={isSameDay(people[currentPersonIndex]?.lastPrayedFor, prayerListDate) ? "secondary" : "default"}
              size="lg"
              onClick={() => people[currentPersonIndex] && handleMarkPrayed(people[currentPersonIndex])}
              disabled={isMarkingPrayed || !people[currentPersonIndex] || exitingPersonId !== null}
              className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-50 p-0"
              aria-label={isSameDay(people[currentPersonIndex]?.lastPrayedFor, prayerListDate) ? "Prayed" : "Pray"}
            >
              {isSameDay(people[currentPersonIndex]?.lastPrayedFor, prayerListDate) ? (
                <Check className="h-6 w-6" />
              ) : (
                <Heart className="h-6 w-6" />
              )}
            </Button>

            {/* Footer - Navigation Only */}
            <div className="border-t bg-background shrink-0">
              <div className="flex items-center justify-between h-16 px-6 py-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={!canScrollPrev}
                  className={cn("gap-2", !canScrollPrev && "invisible")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="text-sm font-medium text-muted-foreground">
                  {currentPersonIndex + 1} / {people.length}
                </div>

                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={!canScrollNext}
                  className={cn("gap-2", !canScrollNext && "invisible")}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
