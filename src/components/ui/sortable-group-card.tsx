import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Users, User, UserPlus, GripVertical, Loader2, Edit } from "lucide-react";
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import type { Group, Person } from '@/lib/types';
import { DraggablePerson } from './draggable-person';

// Props needed by the CONSOLIDATED SortableGroupCard
interface SortableGroupCardProps {
  group: Group;
  peopleInGroup: Person[];
  expandedGroupIds: string[];
  toggleExpandGroup: (groupId: string) => void;
  openGroupActionsDialog: (group: Group) => void;
  openPersonActionsDialog: (person: Person) => void;
  handleAddPersonToGroup: (groupId: string) => void;
  isMobile: boolean;
  // Props from SortableDayGroupCard
  currentNumSetting: number | null;
  displayDays: string[];
  groupSize: number;
  isLoading: boolean; // Generic loading state (might need refinement)
  isUpdatingDays: boolean;
  isSavingNumPerDay: boolean;
  onDayToggle: (groupId: string, dayIndex: number) => void;
  onNumPerDayChange: (groupId: string, newValue: number | null) => void;
  onOpenPersonDetailsModal: (person: Person) => void;
  onOpenGroupSwitcher?: (person: Person) => void;
  // Drag-and-drop props
  isPersonDragActive: boolean;
  isDropTarget: boolean;
}

export function SortableGroupCard({
  group,
  peopleInGroup,
  expandedGroupIds,
  toggleExpandGroup,
  openGroupActionsDialog,
  openPersonActionsDialog,
  handleAddPersonToGroup,
  isMobile,
  // Destructure new props
  currentNumSetting,
  displayDays,
  groupSize,
  isLoading,
  isUpdatingDays,
  isSavingNumPerDay,
  onDayToggle,
  onNumPerDayChange,
  onOpenPersonDetailsModal,
  onOpenGroupSwitcher,
  isPersonDragActive,
  isDropTarget,
}: SortableGroupCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-${group.id}`,
    data: { type: 'group', group }
  });

  // Separate droppable for accepting person drops
  const droppable = useDroppable({
    id: `group-${group.id}`,
    data: { type: 'group-drop', groupId: group.id }
  });

  // Merge both refs
  const setRefs = useCallback((node: HTMLElement | null) => {
    setNodeRef(node);
    droppable.setNodeRef(node);
  }, [setNodeRef, droppable]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isExpanded = expandedGroupIds.includes(group.id);

  return (
    <Card
      ref={setRefs}
      style={style}
      key={group.id}
      className={cn(
        "mb-4 overflow-hidden transition-colors",
        isDropTarget && "border-2 border-shrub bg-shrub/5"
      )}
      {...attributes}
    >
      <CardHeader
        className="pb-3 pt-4 px-4 flex flex-row items-center justify-between hover:bg-muted/50 cursor-pointer"
        onClick={() => toggleExpandGroup(group.id)}
      >
          <div
            className="flex items-center gap-2 flex-grow mr-2"
          >
            <Users className="h-5 w-5 text-primary flex-shrink-0" />
            <CardTitle 
              className="text-base hover:underline"
              onClick={(e) => {
                  e.stopPropagation(); 
                  openGroupActionsDialog(group);
              }}
            >
              {group.name}
            </CardTitle>
            <Badge variant="outline" className="ml-2 flex-shrink-0">
              {peopleInGroup.length} people
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
             <div 
                 className="p-2 md:p-1 text-muted-foreground rounded hover:bg-muted"
                 onClick={(e) => {
                    e.stopPropagation(); 
                    toggleExpandGroup(group.id);
                 }}
             >
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
             </div>
             {!isMobile && (
                <span 
                  className="cursor-grab p-2 md:p-1 text-muted-foreground hover:bg-muted rounded opacity-75"
                  {...listeners}
                  onClick={(e) => e.stopPropagation()}
                >
                   <GripVertical className="h-4 w-4" />
                </span>
            )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-4 pb-4 px-4 border-t space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">People in group:</p>
          {peopleInGroup.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No people in this group</p>
          ) : (
              <SortableContext
                items={peopleInGroup.map(p => `person-${p.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-2">
                  {peopleInGroup.map((person) => (
                    <DraggablePerson
                      key={person.id}
                      person={person}
                      onOpenPersonDetailsModal={onOpenPersonDetailsModal}
                      onOpenPersonActionsDialog={openPersonActionsDialog}
                      onOpenGroupSwitcher={onOpenGroupSwitcher}
                    />
                  ))}
                </div>
              </SortableContext>
          )}
          </div>

          <div className="space-y-3 border-t pt-3">
             <div>
               <p className="text-xs text-muted-foreground mb-2">Select prayer days:</p>
               <div className="flex flex-wrap gap-2">
                 {displayDays.map((day, index) => {
                   const isSelected = group.prayerDays?.includes(index);
                   return (
                     <Button
                       key={index}
                       variant={isSelected ? "default" : "outline"}
                       size="sm"
                       onClick={(e) => {
                         e.stopPropagation();
                         onDayToggle(group.id, index)
                       }}
                       disabled={isLoading || isUpdatingDays}
                       className={cn(
                         "w-10 md:w-12 h-8",
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

             <div>
               <Label className="text-xs text-muted-foreground block mb-2">People per day:</Label>
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button
                     variant="outline"
                     size="sm"
                     className="w-[80px] justify-start font-normal h-8"
                     disabled={isLoading || isSavingNumPerDay}
                     onClick={(e) => e.stopPropagation()}
                     onPointerDown={(e) => e.stopPropagation()}
                   >
                     {isSavingNumPerDay ? (
                       <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                     ) : (
                       <span className="text-xs">{currentNumSetting === null ? "All" : currentNumSetting}</span>
                     )}
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent 
                   className="w-[80px]"
                   onPointerDown={(e) => e.stopPropagation()} 
                 >
                   <div className="max-h-[150px] overflow-y-auto overflow-x-hidden">
                     <DropdownMenuRadioGroup
                       value={currentNumSetting == null ? "all" : currentNumSetting.toString()}
                       onValueChange={(value) => {
                         const newValue = value === "all" ? null : parseInt(value, 10);
                         onNumPerDayChange(group.id, newValue);
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
        </CardContent>
      )}
    </Card>
  );
} 