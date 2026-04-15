"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings, User, UserPlus, Users, Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group, Person } from '@/lib/types';

function formatDaySummary(prayerDays: number[]): string {
  if (!prayerDays || prayerDays.length === 0) return "No days"
  if (prayerDays.length === 7) return "Daily"
  const weekdays = [1, 2, 3, 4, 5]
  if (prayerDays.length === 5 && weekdays.every(d => prayerDays.includes(d))) return "Weekdays"
  const names = ["Su", "M", "T", "W", "Th", "F", "Sa"]
  return [...prayerDays].sort((a, b) => a - b).map(d => names[d]).join(" ")
}

interface SortableGroupCardProps {
  group: Group;
  peopleInGroup: Person[];
  openGroupActionsDialog: (group: Group) => void;
  openPersonActionsDialog: (person: Person) => void;
  handleAddPersonToGroup: (groupId: string | undefined) => void;
  isMobile: boolean;
  currentNumSetting: number | null;
  displayDays: string[];
  groupSize: number;
  isLoading: boolean;
  isUpdatingDays: boolean;
  isSavingNumPerDay: boolean;
  onDayToggle: (groupId: string, dayIndex: number) => void;
  onNumPerDayChange: (groupId: string, newValue: number | null) => void;
  onOpenPersonDetailsModal: (person: Person) => void;
}

const TRUNCATE_AT = 5

export function SortableGroupCard({
  group,
  peopleInGroup,
  openGroupActionsDialog,
  openPersonActionsDialog,
  handleAddPersonToGroup,
  isMobile,
  currentNumSetting,
  displayDays,
  groupSize,
  isLoading,
  isUpdatingDays,
  isSavingNumPerDay,
  onDayToggle,
  onNumPerDayChange,
  onOpenPersonDetailsModal,
}: SortableGroupCardProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const shouldTruncate = peopleInGroup.length > TRUNCATE_AT
  const visiblePeople = shouldTruncate && !isExpanded
    ? peopleInGroup.slice(0, TRUNCATE_AT)
    : peopleInGroup
  const hiddenCount = peopleInGroup.length - TRUNCATE_AT

  const daySummary = formatDaySummary(group.prayerDays || [])
  const perDaySummary = currentNumSetting === null ? "All" : `${currentNumSetting}/day`

  return (
    <>
      <div className="rounded-lg border bg-transparent overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-base leading-none">{group.name}</span>

          <span className="text-xs text-muted-foreground truncate">
            {daySummary} · {perDaySummary}
          </span>

          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true) }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); openGroupActionsDialog(group) }}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* People list */}
        <div className="px-4 pb-3 border-t pt-2">
          {peopleInGroup.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1 italic">No people in this group</p>
          ) : (
            <div className="space-y-0.5">
              {visiblePeople.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-2 w-full px-1 py-1.5 rounded-md hover:bg-muted/60 transition-colors group/person"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <button
                    className="flex-1 text-left text-sm"
                    onClick={() => onOpenPersonDetailsModal(person)}
                  >
                    {person.name}
                  </button>
                  <button
                    className="opacity-0 group-hover/person:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => openPersonActionsDialog(person)}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(e => !e)}
                  className="flex items-center gap-2 w-full text-left px-1 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {isExpanded ? `Show less` : `Show ${hiddenCount} more`}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => handleAddPersonToGroup(group.isSystemGroup ? undefined : group.id)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors px-1 py-1 mt-1"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add person
          </button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{group.name} Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Prayer days</Label>
              <div className="flex flex-wrap gap-2">
                {displayDays.map((day, index) => {
                  const isSelected = group.prayerDays?.includes(index)
                  return (
                    <Button
                      key={index}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onDayToggle(group.id, index)}
                      disabled={isLoading || isUpdatingDays}
                      className={cn(
                        "w-10 h-8",
                        isSelected && "bg-shrub hover:bg-shrub/90"
                      )}
                    >
                      {day}
                    </Button>
                  )
                })}
              </div>
              {isUpdatingDays && <p className="text-xs text-muted-foreground mt-2">Saving...</p>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">People per day</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-[80px] justify-start font-normal h-8"
                    disabled={isLoading || isSavingNumPerDay}
                  >
                    {isSavingNumPerDay ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <span className="text-xs">{currentNumSetting === null ? "All" : currentNumSetting}</span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[80px]">
                  <div className="max-h-[150px] overflow-y-auto overflow-x-hidden">
                    <DropdownMenuRadioGroup
                      value={currentNumSetting == null ? "all" : currentNumSetting.toString()}
                      onValueChange={(value) => {
                        const newValue = value === "all" ? null : parseInt(value, 10)
                        onNumPerDayChange(group.id, newValue)
                      }}
                    >
                      <DropdownMenuRadioItem value="all" className="text-xs">All</DropdownMenuRadioItem>
                      {groupSize > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          {Array.from({ length: groupSize }, (_, i) => i + 1).map(num => (
                            <DropdownMenuRadioItem key={num} value={num.toString()} className="text-xs">{num}</DropdownMenuRadioItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuRadioGroup>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
