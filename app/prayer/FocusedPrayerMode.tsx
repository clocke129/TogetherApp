"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  onAddRequest
}: FocusedPrayerModeProps) {
  const [api, setApi] = useState<CarouselApi>()

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
          <DialogTitle className="text-lg font-semibold">
            {group.name}
          </DialogTitle>
        </div>

        {/* Carousel Area */}
        <div className="flex-1 overflow-hidden">
          <Carousel
            setApi={setApi}
            opts={{
              startIndex: currentPersonIndex,
              loop: false,
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
                    onMarkPrayed={onMarkPrayed}
                    isMarkingPrayed={isMarkingPrayed}
                    isPrayedToday={isSameDay(person.lastPrayedFor, prayerListDate)}
                    onAddRequest={onAddRequest ? () => onAddRequest(person.id) : undefined}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between h-20 px-6 border-t bg-background shrink-0">
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
      </DialogContent>
    </Dialog>
  )
}
