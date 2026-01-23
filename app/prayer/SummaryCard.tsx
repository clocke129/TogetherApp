"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, RotateCcw } from "lucide-react"
import type { Person, PrayerRequest } from "@/lib/types"

interface PrayedPerson {
  person: Person & { mostRecentRequest?: PrayerRequest }
  groupId: string
  groupName: string
  prayedAt: Date
}

interface SummaryCardProps {
  prayedPeople: PrayedPerson[]
  onRestoreMultiple: (prayedPeople: PrayedPerson[]) => void
  onDone: () => void
}

export function SummaryCard({
  prayedPeople,
  onRestoreMultiple,
  onDone
}: SummaryCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelection = (personId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(personId)) {
        next.delete(personId)
      } else {
        next.add(personId)
      }
      return next
    })
  }

  const handlePrayAgain = () => {
    const selectedPeople = prayedPeople.filter(p => selectedIds.has(p.person.id))
    if (selectedPeople.length > 0) {
      onRestoreMultiple(selectedPeople)
      setSelectedIds(new Set())
    }
  }

  const selectedCount = selectedIds.size
  // Group prayed people by their group
  const groupedPrayed = prayedPeople.reduce((acc, item) => {
    if (!acc[item.groupName]) {
      acc[item.groupName] = []
    }
    acc[item.groupName].push(item)
    return acc
  }, {} as Record<string, PrayedPerson[]>)

  const totalPrayed = prayedPeople.length

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      {/* Header with checkmark */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Prayer Complete!</h2>
        <p className="text-muted-foreground">
          You prayed for {totalPrayed} {totalPrayed === 1 ? 'person' : 'people'}
        </p>
      </div>

      {/* Prayed people grouped by group */}
      {totalPrayed > 0 && (
        <div className="flex-1 space-y-4 mb-6 overflow-y-auto">
          {Object.entries(groupedPrayed).map(([groupName, people]) => (
            <div key={groupName}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {groupName}
              </h3>
              <div className="space-y-2">
                {people.map((prayedPerson) => {
                  const isSelected = selectedIds.has(prayedPerson.person.id)
                  return (
                    <div
                      key={prayedPerson.person.id}
                      className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => toggleSelection(prayedPerson.person.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(prayedPerson.person.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">{prayedPerson.person.name}</span>
                      </div>
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state when no one was prayed for */}
      {totalPrayed === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            Everyone has already been prayed for today!
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {selectedCount > 0 && (
          <Button
            variant="outline"
            onClick={handlePrayAgain}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Pray Again ({selectedCount})
          </Button>
        )}
        <Button
          onClick={onDone}
          className="w-full"
        >
          Done
        </Button>
      </div>
    </div>
  )
}
