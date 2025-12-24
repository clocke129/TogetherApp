"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-center h-16 px-6 border-b bg-background shrink-0">
          <DialogTitle className="sr-only">{group.name}</DialogTitle>
          {allGroups.length > 0 && onSwitchGroup ? (
            <Sheet open={isGroupSwitcherOpen} onOpenChange={setIsGroupSwitcherOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="text-lg font-semibold gap-2">
                  {group.name}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Switch Group</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(80vh-8rem)]">
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
              </SheetContent>
            </Sheet>
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
                <CarouselItem key={person.id} className="h-full">
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

        {/* Footer */}
        <div className="border-t bg-background shrink-0">
          {/* Pray Button */}
          <div className="flex items-center justify-center px-6 pt-4 pb-2">
            <Button
              variant={isSameDay(people[currentPersonIndex]?.lastPrayedFor, prayerListDate) ? "secondary" : "default"}
              size="lg"
              onClick={() => people[currentPersonIndex] && onMarkPrayed(people[currentPersonIndex])}
              disabled={isMarkingPrayed || !people[currentPersonIndex]}
              className="w-full max-w-sm"
            >
              {isSameDay(people[currentPersonIndex]?.lastPrayedFor, prayerListDate) ? (
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
          </div>

          {/* Navigation and Counter */}
          <div className="flex items-center justify-between h-16 px-6 pb-4">
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
