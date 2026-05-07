"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Group, Person } from "@/lib/types"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface PendingGroupState {
  prayerDays: number[]
  numPerDay: number | null  // null = all
}

interface WeeklyScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: Group[]
  people: Person[]
  onSave: (changes: Record<string, PendingGroupState>) => Promise<void>
}

export function WeeklyScheduleDialog({
  open,
  onOpenChange,
  groups,
  people,
  onSave,
}: WeeklyScheduleDialogProps) {
  const [pending, setPending] = useState<Record<string, PendingGroupState>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Initialise local state from current group data whenever dialog opens
  useEffect(() => {
    if (open) {
      const initial: Record<string, PendingGroupState> = {}
      groups.forEach(g => {
        initial[g.id] = {
          prayerDays: [...(g.prayerDays ?? [])],
          numPerDay: g.prayerSettings?.numPerDay ?? null,
        }
      })
      setPending(initial)
    }
  }, [open, groups])

  function getMemberCount(group: Group): number {
    if (group.isSystemGroup && group.name === "Everyone") {
      return people.filter(p => !p.groupId).length
    }
    return people.filter(p => p.groupId === group.id).length
  }

  function getActualPerDay(groupId: string, group: Group): number {
    const count = getMemberCount(group)
    const numPerDay = pending[groupId]?.numPerDay ?? null
    return numPerDay === null ? count : Math.min(numPerDay, count)
  }

  function getDailyTotal(dayIndex: number): number {
    return groups.reduce((sum, g) => {
      const active = pending[g.id]?.prayerDays.includes(dayIndex) ?? false
      return active ? sum + getActualPerDay(g.id, g) : sum
    }, 0)
  }

  function toggleDay(groupId: string, dayIndex: number) {
    setPending(prev => {
      const current = prev[groupId]?.prayerDays ?? []
      const next = current.includes(dayIndex)
        ? current.filter(d => d !== dayIndex)
        : [...current, dayIndex].sort((a, b) => a - b)
      return { ...prev, [groupId]: { ...prev[groupId], prayerDays: next } }
    })
  }

  function setNumPerDay(groupId: string, value: number | null) {
    setPending(prev => ({
      ...prev,
      [groupId]: { ...prev[groupId], numPerDay: value },
    }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await onSave(pending)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Weekly Schedule</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground pb-3 pr-4 w-40">Group</th>
                <th className="text-left font-medium text-muted-foreground pb-3 pr-4 w-24">Per day</th>
                {DAYS.map(day => (
                  <th key={day} className="text-center font-medium text-muted-foreground pb-3 w-12">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map(group => {
                const memberCount = getMemberCount(group)
                const state = pending[group.id]

                return (
                  <tr key={group.id}>
                    <td className="py-3 pr-4">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-muted-foreground text-xs ml-1">({memberCount})</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Select
                        value={state?.numPerDay === null ? "all" : String(state?.numPerDay ?? "all")}
                        onValueChange={val => setNumPerDay(group.id, val === "all" ? null : Number(val))}
                        disabled={memberCount === 0}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {Array.from({ length: memberCount }, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const active = state?.prayerDays.includes(dayIndex) ?? false
                      return (
                        <td key={dayIndex} className="py-3 text-center">
                          <Checkbox
                            checked={active}
                            onCheckedChange={() => toggleDay(group.id, dayIndex)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="pt-3 pr-4 font-medium text-muted-foreground">Total / day</td>
                <td className="pt-3 pr-4" />
                {DAYS.map((_, dayIndex) => {
                  const total = getDailyTotal(dayIndex)
                  return (
                    <td key={dayIndex} className="pt-3 text-center">
                      <span className={`font-semibold ${total === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                        {total}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-shrub hover:bg-shrub/90">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
