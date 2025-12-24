"use client"

import { Check } from "lucide-react"
import type { Person } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isSameDay } from "@/lib/utils"

interface PersonStatusItemProps {
  person: Person
  prayerListDate: Date
}

export function PersonStatusItem({ person, prayerListDate }: PersonStatusItemProps) {
  const isPrayed = isSameDay(person.lastPrayedFor, prayerListDate)

  return (
    <div className="flex items-center gap-2 py-1">
      {isPrayed ? (
        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
      )}
      <span
        className={cn(
          "text-sm",
          isPrayed && "line-through text-muted-foreground"
        )}
      >
        {person.name}
      </span>
    </div>
  )
}
