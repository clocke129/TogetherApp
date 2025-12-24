"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Check } from "lucide-react"
import type { Group, Person } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PersonStatusItem } from "./PersonStatusItem"

interface GroupPrayerCardProps {
  group: Group
  people: Person[]
  prayedCount: number
  totalCount: number
  onOpenFocusedMode: (groupId: string) => void
  prayerListDate: Date
}

export function GroupPrayerCard({
  group,
  people,
  prayedCount,
  totalCount,
  onOpenFocusedMode,
  prayerListDate
}: GroupPrayerCardProps) {
  const allPrayed = totalCount > 0 && prayedCount === totalCount

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={`people-${group.id}`} className="border-none">
        <Card className="relative hover:bg-muted/50 transition-colors">
          <CardHeader className="pb-3">
            <AccordionTrigger className="hover:no-underline p-0 [&[data-state=open]>div>svg]:rotate-180">
              <div className="flex items-start justify-between w-full">
                <div className="flex-1 min-w-0 pr-2">
                  <CardTitle className="text-lg text-left">{group.name}</CardTitle>
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenFocusedMode(group.id)
                  }}
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
            </AccordionTrigger>
          </CardHeader>

          <AccordionContent>
            <CardContent className="pt-0 pb-4">
              {people.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">People:</p>
                  <div className="space-y-1">
                    {people.map((person) => (
                      <PersonStatusItem
                        key={person.id}
                        person={person}
                        prayerListDate={prayerListDate}
                      />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {prayedCount}/{totalCount} prayed today
              </p>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  )
}
