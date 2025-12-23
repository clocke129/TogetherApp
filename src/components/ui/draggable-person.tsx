"use client"

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { User, Edit, GripVertical } from 'lucide-react'
import type { Person } from '@/lib/types'

interface DraggablePersonProps {
  person: Person
  onOpenPersonDetailsModal: (person: Person) => void
  onOpenPersonActionsDialog: (person: Person) => void
  isDragOverlay?: boolean
}

export function DraggablePerson({
  person,
  onOpenPersonDetailsModal,
  onOpenPersonActionsDialog,
  isDragOverlay = false
}: DraggablePersonProps) {
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
      {/* Drag Handle - left side */}
      <div className="flex items-center gap-2">
        <span
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:bg-muted hover:text-foreground rounded"
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </span>
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
