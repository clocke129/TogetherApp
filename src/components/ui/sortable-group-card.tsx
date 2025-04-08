import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users, User, UserPlus, GripVertical } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Group, Person } from '@/lib/types'; // Assuming types are correctly defined

// Props needed by the SortableGroupCard
interface SortableGroupCardProps {
  group: Group;
  peopleInGroup: Person[];
  expandedGroupId: string | null;
  toggleExpandGroup: (groupId: string) => void;
  openGroupActionsDialog: (group: Group) => void;
  openPersonActionsDialog: (person: Person) => void; // Needed for clicking person name
  handleAddPersonToGroup: (groupId: string) => void; // Needed for the "Add Person" button
}

export function SortableGroupCard({
  group,
  peopleInGroup,
  expandedGroupId,
  toggleExpandGroup,
  openGroupActionsDialog,
  openPersonActionsDialog, // Receive handler
  handleAddPersonToGroup, // Receive handler
}: SortableGroupCardProps) {
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

  const isExpanded = expandedGroupId === group.id;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      key={group.id} // Key might not be strictly needed here if handled in map, but good practice
      className="mb-4"
      {...attributes} // Spread attributes for DND kit
    >
      {/* We apply the listener to the header instead for better UX */}
      <CardHeader
        className="pb-3 pt-4 px-4 cursor-pointer" // Use regular cursor
        onClick={() => toggleExpandGroup(group.id)}
      >
        <div className="flex items-center justify-between">
          {/* Group Name & Icon - Clickable for Actions (stop propagation) */}
          <div
            className="flex items-center gap-2 cursor-pointer flex-grow mr-2" // Added flex-grow and margin
            onClick={(e) => {
              e.stopPropagation(); // Prevent header onClick (expand/collapse)
              openGroupActionsDialog(group);
            }}
          >
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base hover:underline">{group.name}</CardTitle>
            <Badge variant="outline" className="ml-2 flex-shrink-0">
              {peopleInGroup.length} people
            </Badge>
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
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {peopleInGroup.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No people in this group</p>
          ) : (
            <div className="space-y-2 mb-4">
              {/* Render people in the group */}
              {peopleInGroup.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                >
                  {/* Make the name + icon clickable for person actions */}
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => {
                       e.stopPropagation(); // Prevent card header click if somehow it bubbles
                       openPersonActionsDialog(person);
                    }}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{person.name}</span>
                  </div>
                  {/* Optional: Add remove button or other actions here */}
                </div>
              ))}
            </div>
          )}

          {/* Add Person to THIS Group Button - REMOVED */}
          {/* 
          <Button variant="outline" size="sm" className="gap-1 w-full" onClick={(e) => {
              e.stopPropagation(); // Prevent card header click
              handleAddPersonToGroup(group.id)
            }}>
            <UserPlus className="h-4 w-4" />
            Add Person to Group
          </Button>
          */}
        </CardContent>
      )}
    </Card>
  );
} 