"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, ChevronUp, Plus, User, UserPlus, X, Users, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// Types
type Person = {
  id: string
  name: string
  groupId?: string
}

type Group = {
  id: string
  name: string
  personIds: string[]
  prayerDays: number[] // 0-6 for Sunday-Saturday
  prayerSettings: {
    type: "random" | "recent" | "all"
    count?: number
  }
}

// Mock data
const MOCK_PEOPLE: Person[] = [
  { id: "1", name: "John Smith", groupId: "g1" },
  { id: "2", name: "Sarah Johnson", groupId: "g2" },
  { id: "3", name: "Michael Brown", groupId: "g3" },
  { id: "4", name: "Emily Davis", groupId: "g1" },
  { id: "5", name: "David Wilson", groupId: "g2" },
  { id: "6", name: "Lisa Thompson", groupId: "g3" },
  { id: "7", name: "Robert Garcia" }, // Uncategorized
  { id: "8", name: "Jennifer Martinez" }, // Uncategorized
  { id: "9", name: "William Anderson" }, // Uncategorized
]

const MOCK_GROUPS: Group[] = [
  {
    id: "g1",
    name: "Family",
    personIds: ["1", "4"],
    prayerDays: [0, 3, 6], // Sunday, Wednesday, Saturday
    prayerSettings: { type: "all" },
  },
  {
    id: "g2",
    name: "Church",
    personIds: ["2", "5"],
    prayerDays: [0, 4], // Sunday, Thursday
    prayerSettings: { type: "random", count: 2 },
  },
  {
    id: "g3",
    name: "Work",
    personIds: ["3", "6"],
    prayerDays: [1, 5], // Monday, Friday
    prayerSettings: { type: "recent" },
  },
]

// Day names
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function AssignmentsPage() {
  const [people] = useState<Person[]>(MOCK_PEOPLE)
  const [groups] = useState<Group[]>(MOCK_GROUPS)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  // Get uncategorized people
  const uncategorizedPeople = people.filter((person) => !person.groupId)

  // Get people in a specific group
  const getPeopleInGroup = (groupId: string) => {
    return people.filter((person) => person.groupId === groupId)
  }

  // Toggle expanded state for a group
  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId)
  }

  // Toggle day selection for a group
  const toggleDayForGroup = (groupId: string, dayIndex: number) => {
    // In a real app, this would update the database
    console.log(`Toggled day ${dayIndex} for group ${groupId}`)
  }

  // Toggle selection type for a group
  const toggleSelectionType = (groupId: string, type: "random" | "recent" | "all") => {
    // In a real app, this would update the database
    console.log(`Set selection type to ${type} for group ${groupId}`)
  }

  return (
    <div className="mobile-container pb-16 md:pb-6">
      <div className="mb-4 md:mb-6">
        <h1 className="page-title">Prayer Assignments</h1>
        <p className="page-description">Manage groups and prayer day assignments</p>
      </div>

      <Tabs defaultValue="people" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="people">People & Groups</TabsTrigger>
          <TabsTrigger value="days">Groups & Days</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-6">
          {/* Uncategorized People Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Uncategorized People</span>
                <Button size="sm" variant="outline" className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  Add Person
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uncategorizedPeople.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No uncategorized people</p>
              ) : (
                <div className="space-y-2">
                  {uncategorizedPeople.map((person) => (
                    <div key={person.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{person.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        Assign to Group
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Groups Section */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Groups</h2>
            <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90">
              <Plus className="h-4 w-4" />
              New Group
            </Button>
          </div>

          {groups.map((group) => (
            <Card key={group.id} className="mb-4">
              <CardHeader className="pb-3 pt-4 px-4 cursor-pointer" onClick={() => toggleExpandGroup(group.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {getPeopleInGroup(group.id).length} people
                    </Badge>
                  </div>
                  {expandedGroupId === group.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {expandedGroupId === group.id && (
                <CardContent className="pt-0">
                  {getPeopleInGroup(group.id).length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No people in this group</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {getPeopleInGroup(group.id).map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{person.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="gap-1 w-full">
                    <UserPlus className="h-4 w-4" />
                    Add Person to Group
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="days" className="space-y-6">
          {groups.map((group) => (
            <Card key={group.id} className="mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{group.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{getPeopleInGroup(group.id).length} people</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Prayer Days:</h3>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <Button
                        key={index}
                        variant={group.prayerDays.includes(index) ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-9 w-9 p-0 md:h-10 md:w-10",
                          group.prayerDays.includes(index) && "bg-shrub hover:bg-shrub/90",
                        )}
                        onClick={() => toggleDayForGroup(group.id, index)}
                      >
                        {day.charAt(0)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Selection Method:</h3>
                  <div className="flex gap-2">
                    <Button
                      variant={group.prayerSettings.type === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSelectionType(group.id, "all")}
                    >
                      All
                    </Button>
                    <Button
                      variant={group.prayerSettings.type === "random" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSelectionType(group.id, "random")}
                    >
                      Random
                    </Button>
                    <Button
                      variant={group.prayerSettings.type === "recent" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSelectionType(group.id, "recent")}
                    >
                      Least Recent
                    </Button>
                  </div>
                </div>

                {group.prayerSettings.type === "random" && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">People per day:</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{group.prayerSettings.count || 1}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

