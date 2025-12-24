"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Check } from "lucide-react"
import type { Group, Person } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GroupPrayerCardProps {
  group: Group
  people: Person[]
  prayedCount: number
  totalCount: number
  onOpenFocusedMode: (groupId: string) => void
}

export function GroupPrayerCard({
  group,
  people,
  prayedCount,
  totalCount,
  onOpenFocusedMode
}: GroupPrayerCardProps) {
  const allPrayed = totalCount > 0 && prayedCount === totalCount

  return (
    <Card className="relative hover:bg-muted/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {group.isSystemGroup ? "All" : "Custom"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {totalCount} {totalCount === 1 ? "person" : "people"}
              </span>
            </div>
          </div>
          <Button
            variant={allPrayed ? "secondary" : "default"}
            size="sm"
            className="shrink-0"
            onClick={() => onOpenFocusedMode(group.id)}
            disabled={totalCount === 0}
            aria-label={`Pray for ${group.name}`}
          >
            {allPrayed ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Prayed
              </>
            ) : (
              <>
                <Heart className="mr-2 h-4 w-4" />
                Pray
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">
          {prayedCount}/{totalCount} prayed today
        </p>
      </CardContent>
    </Card>
  )
}
