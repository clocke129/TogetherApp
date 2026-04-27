"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { X } from "lucide-react"

const STORAGE_KEY = "togetherOnboardingComplete"

const SLIDES = [
  {
    emoji: "🙏",
    title: "Welcome to Together",
    body: "A simple app for praying intentionally for the people in your life — so no one falls through the cracks.",
  },
  {
    emoji: "👥",
    title: "Add your people",
    body: "Go to the Groups tab and create groups — like \"Close Friends\" or \"Family.\" Add people and set which days you want to pray for them.",
  },
  {
    emoji: "📋",
    title: "Your daily list",
    body: "Each day, Together generates a rotation of who to pray for based on who's been prayed for least recently. Swipe through their cards to see prayer requests.",
  },
  {
    emoji: "✅",
    title: "Follow-ups & requests",
    body: "Add prayer requests for people and set follow-up reminders so nothing gets forgotten. Use #MMDD to set a date (e.g. #0510 for May 10th).",
  },
  {
    emoji: "⚡",
    title: "Quick capture",
    body: "Tap the + button anywhere to jot something down fast. Use @ to tag a person and save a prayer request on the spot.",
  },
]

interface GettingStartedOverlayProps {
  open: boolean
  onClose: () => void
}

export function GettingStartedOverlay({ open, onClose }: GettingStartedOverlayProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!api) return
    const handler = () => setIndex(api.selectedScrollSnap())
    api.on("select", handler)
    return () => { api.off("select", handler) }
  }, [api])

  // Reset to first slide when opened
  useEffect(() => {
    if (open && api) {
      api.scrollTo(0, true)
      setIndex(0)
    }
  }, [open, api])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    onClose()
  }

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      api?.scrollNext()
    } else {
      handleClose()
    }
  }

  if (!open) return null

  const isLast = index === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="relative bg-background rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Skip / close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip"
        >
          <X className="h-5 w-5" />
        </button>

        <Carousel setApi={setApi} opts={{ loop: false, watchDrag: true }}>
          <CarouselContent>
            {SLIDES.map((slide, i) => (
              <CarouselItem key={i}>
                <div className="flex flex-col items-center text-center px-8 pt-10 pb-8 min-h-[280px]">
                  <span className="text-5xl mb-5">{slide.emoji}</span>
                  <h2 className="text-xl font-semibold mb-3">{slide.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-shrub" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-8 pb-8 pt-4">
          {!isLast && (
            <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={handleClose}>
              Skip
            </Button>
          )}
          <Button
            className={`bg-shrub hover:bg-shrub/90 ${isLast ? "w-full" : "flex-1"}`}
            onClick={handleNext}
          >
            {isLast ? "Get Started" : "Next →"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Hook to auto-show on first visit
export function useGettingStarted() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setOpen(true)
  }, [])

  return { open, setOpen }
}
