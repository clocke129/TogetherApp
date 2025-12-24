"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronDown, Heart, Check } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { PersonPrayerCard } from "./PersonPrayerCard"
import type { Group, Person, PrayerRequest } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"

interface PersonWithDetails extends Person {
  mostRecentRequest?: PrayerRequest
  expandedRequests: PrayerRequest[]
  isLoadingExpanded: boolean
}

interface FocusedPrayerModeProps {
  isOpen: boolean
  onClose: () => void
  group: Group
  people: PersonWithDetails[]
  currentPersonIndex: number
  onPersonIndexChange: (index: number) => void
  onMarkPrayed: (person: Person) => void
  isMarkingPrayed: boolean
  prayerListDate: Date
  onAddRequest?: (personId: string) => void
  allGroups?: Group[]
  onSwitchGroup?: (groupId: string) => void
}

export function FocusedPrayerMode({
  isOpen,
  onClose,
  group,
  people,
  currentPersonIndex,
  onPersonIndexChange,
  onMarkPrayed,
  isMarkingPrayed,
  prayerListDate,
  onAddRequest,
  allGroups = [],
  onSwitchGroup
}: FocusedPrayerModeProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()

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
    if (api && isOpen) {
      api.scrollTo(currentPersonIndex, false)
    }
  }, [currentPersonIndex, api, isOpen])

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

  const isSameDay = (timestamp: any, date: Date): boolean => {
    if (!timestamp || !timestamp.toDate) return false
    const tsDate = timestamp.toDate()
    return (
      tsDate.getFullYear() === date.getFullYear() &&
      tsDate.getMonth() === date.getMonth() &&
      tsDate.getDate() === date.getDate()
    )
  }

  if (people.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl w-full">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No people in this group</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
          <DialogTitle className="sr-only">{group.name}</DialogTitle>
          {allGroups.length > 0 && onSwitchGroup ? (
            isMobile ? (
              // Mobile: Drawer (bottom sheet with drag handle)
              <>
                <Button
                  variant="ghost"
                  className="text-lg font-semibold gap-2"
                  onClick={() => setIsGroupSwitcherOpen(true)}
                >
                  {group.name}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Drawer open={isGroupSwitcherOpen} onOpenChange={setIsGroupSwitcherOpen}>
                  <DrawerContent>
                    <DrawerTitle className="sr-only">Switch Group</DrawerTitle>
                    <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                      {allGroups.map((g) => (
                        <Button
                          key={g.id}
                          variant={g.id === group.id ? "secondary" : "ghost"}
                          className="w-full justify-start text-base"
                          onClick={() => {
                            onSwitchGroup(g.id)
                            setIsGroupSwitcherOpen(false)
                          }}
                        >
                          {g.name}
                        </Button>
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>
              </>
            ) : (
              // Desktop: Custom dropdown
              <div ref={dropdownRef} className="relative">
                <Button
                  variant="ghost"
                  className="text-lg font-semibold gap-2"
                  onClick={() => setIsGroupSwitcherOpen(!isGroupSwitcherOpen)}
                >
                  {group.name}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isGroupSwitcherOpen && "rotate-180")} />
                </Button>

                {isGroupSwitcherOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-h-80 overflow-y-auto bg-popover border rounded-md shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      {allGroups.map((g) => (
                        <Button
                          key={g.id}
                          variant={g.id === group.id ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => {
                            onSwitchGroup(g.id)
                            setIsGroupSwitcherOpen(false)
                          }}
                        >
                          {g.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <h2 className="text-lg font-semibold">{group.name}</h2>
          )}
        </div>

        {/* Carousel Area */}
        <div className="flex-1 overflow-hidden">
          <Carousel
            setApi={setApi}
            opts={{
              startIndex: currentPersonIndex,
              loop: false,
              duration: 40, // Slower, smoother animation (default is 25)
            }}
            className="h-full"
          >
            <CarouselContent className="h-full">
              {people.map((person) => (
                <CarouselItem key={person.id} className="h-full flex flex-col">
                  <PersonPrayerCard
                    person={person}
                    mostRecentRequest={person.mostRecentRequest}
                    expandedRequests={person.expandedRequests}
                    isLoadingExpanded={person.isLoadingExpanded}
                    onAddRequest={onAddRequest ? () => onAddRequest(person.id) : undefined}
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
          onClick={() => people[currentPersonIndex] && onMarkPrayed(people[currentPersonIndex])}
          disabled={isMarkingPrayed || !people[currentPersonIndex]}
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
          {/* Navigation and Counter */}
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
      </DialogContent>
    </Dialog>
  )
}
