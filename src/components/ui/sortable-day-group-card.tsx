import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Users, Loader2, GripVertical } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import type { Group } from '@/lib/types'; // Assuming types are correctly defined

// Props needed by the SortableDayGroupCard
interface SortableDayGroupCardProps {
  group: Group;
  isExpanded: boolean;
  currentNumSetting: number | null;
  displayDays: string[];
  groupSize: number;
  isMobile: boolean;
  isLoading: boolean;
  isUpdatingDays: boolean;
  isSavingNumPerDay: boolean;
  onExpandToggle: () => void;
  onDayToggle: (groupId: string, dayIndex: number) => void;
  onNumPerDayChange: (groupId: string, newValue: number | null) => void;
}

export function SortableDayGroupCard({
  group,
  isExpanded,
  currentNumSetting,
  displayDays,
  groupSize,
  isMobile,
  isLoading,
  isUpdatingDays,
  isSavingNumPerDay,
  onExpandToggle,
  onDayToggle,
  onNumPerDayChange,
}: SortableDayGroupCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      key={group.id} // Key might not be strictly needed here if handled in map, but good practice
      className="mb-4 overflow-hidden"
      {...attributes} // Spread attributes for DND kit
    >
      <CardHeader
        className="pb-3 pt-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50" // Regular cursor
        onClick={onExpandToggle} // Apply expand toggle
      >
        {/* Group Name & Icon */}
        <div className="flex items-center gap-2 flex-grow mr-2">
          <Users className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-lg">{group.name}</CardTitle>
        </div>

        {/* Right side container for handle and chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Drag Handle - Use GripVertical with size/opacity */}
          <span 
            className="cursor-grab p-1 text-muted-foreground hover:bg-muted rounded opacity-75"
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </span>

          {/* Expand/Collapse Icon */}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-2 pb-4 px-4 border-t">
          {/* Prayer Days Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Select prayer days:</p>
            <div className="flex flex-wrap gap-2">
              {displayDays.map((day, index) => {
                const isSelected = group.prayerDays?.includes(index);
                return (
                  <Button
                    key={index}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent header click/drag
                      onDayToggle(group.id, index)
                    }}
                    disabled={isLoading || isUpdatingDays}
                    className={cn(
                      "w-10 md:w-12",
                      isSelected && "bg-shrub hover:bg-shrub/90",
                      isUpdatingDays && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
            {isUpdatingDays && <p className="text-xs text-muted-foreground mt-2">Updating days...</p>}
          </div>

          {/* People Per Day Setting */}
          <div className="pt-2">
            <Label className="text-sm text-muted-foreground block mb-2">People per day:</Label>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[100px] justify-start font-normal"
                    disabled={isLoading || isSavingNumPerDay}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {isSavingNumPerDay ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <span>{currentNumSetting === null ? "All" : currentNumSetting}</span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-[100px]" 
                  onPointerDown={(e) => e.stopPropagation()} 
                >
                  <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                    <DropdownMenuRadioGroup
                      value={currentNumSetting == null ? "all" : currentNumSetting.toString()}
                      onValueChange={(value) => {
                        const newValue = value === "all" ? null : parseInt(value, 10);
                        onNumPerDayChange(group.id, newValue);
                      }}
                    >
                      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                      {groupSize > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          {Array.from({ length: groupSize }, (_, i) => i + 1).map(num => (
                            <DropdownMenuRadioItem key={num} value={num.toString()}>{num}</DropdownMenuRadioItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuRadioGroup>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
} 