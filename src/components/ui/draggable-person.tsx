"use client"

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { User, Edit, GripVertical, MoreVertical } from 'lucide-react'
import type { Person } from '@/lib/types'
import { useMobile } from '@/hooks/use-mobile'

interface DraggablePersonProps {
  person: Person
  onOpenPersonDetailsModal: (person: Person) => void
  onOpenPersonActionsDialog: (person: Person) => void
  onOpenGroupSwitcher?: (person: Person) => void
  isDragOverlay?: boolean
}

export function DraggablePerson({
  person,
  onOpenPersonDetailsModal,
  onOpenPersonActionsDialog,
  onOpenGroupSwitcher,
  isDragOverlay = false
}: DraggablePersonProps) {
  const isMobile = useMobile()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `person-${person.id}`,
    data: { type: 'person', person }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
      {...attributes}
    >
      {/* Drag Handle (desktop) or Three-Dot Menu (mobile) */}
      <div className="flex items-center gap-2">
        {isMobile ? (
          // Mobile: Three dots that opens group drawer
          <span
            className="cursor-pointer p-1 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
            onClick={(e) => {
              e.stopPropagation()
              onOpenGroupSwitcher?.(person)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </span>
        ) : (
          // Desktop: Drag handle
          <span
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span
          className="text-sm cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation()
            onOpenPersonDetailsModal(person)
          }}
        >
          {person.name}
        </span>
      </div>

      {/* Edit Button - right side */}
      <div
        className="p-1 cursor-pointer text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation()
          onOpenPersonActionsDialog(person)
        }}
      >
        <Edit className="h-4 w-4" />
      </div>
    </div>
  )
}
