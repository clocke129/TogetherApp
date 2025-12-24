"use client"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import type { Group, Person } from "@/lib/types"
import { Users } from "lucide-react"

interface GroupSwitcherDrawerProps {
  isOpen: boolean
  onClose: () => void
  person: Person
  groups: Group[]
  currentGroupId?: string
  onSelectGroup: (groupId: string | undefined) => void
}

export function GroupSwitcherDrawer({
  isOpen,
  onClose,
  person,
  groups,
  currentGroupId,
  onSelectGroup
}: GroupSwitcherDrawerProps) {
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move {person.name} to Group</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto pb-8">
          {groups.map((group) => {
            const isCurrentGroup = group.id === currentGroupId
            const isEveryoneGroup = group.isSystemGroup

            return (
              <Button
                key={group.id}
                variant={isCurrentGroup ? "secondary" : "ghost"}
                className="w-full justify-start text-base"
                onClick={() => {
                  // Everyone group uses undefined groupId
                  const targetGroupId = isEveryoneGroup ? undefined : group.id
                  onSelectGroup(targetGroupId)
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                {group.name}
                {isCurrentGroup && <span className="ml-auto text-xs text-muted-foreground">(Current)</span>}
              </Button>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
