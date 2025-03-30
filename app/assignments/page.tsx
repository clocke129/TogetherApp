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

// Day names
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function AssignmentsPage() {
  // Initialize state with empty arrays
  const [people, setPeople] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  // useEffect hook will be needed here to fetch people and groups from Firestore
  // useEffect(() => {
  //   // Fetch data based on logged-in user
  // }, []);


  // Get uncategorized people - uses local state, will update when fetching real data
  const uncategorizedPeople = people.filter((person) => !person.groupId)

  // Get people in a specific group - uses local state, will update when fetching real data
  const getPeopleInGroup = (groupId: string) => {
    return people.filter((person) => person.groupId === groupId)
  }

  // Toggle expanded state for a group - remains the same
  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId)
  }

  // Toggle day for group - Needs Firestore update
  const toggleDayForGroup = (groupId: string, dayIndex: number) => {
    // TODO: Replace with Firestore updateDoc for the specific group
    console.log(`Toggled day ${dayIndex} for group ${groupId} (needs Firestore implementation)`);
  }

  // Toggle selection type for group - Needs Firestore update
  const toggleSelectionType = (groupId: string, type: "random" | "recent" | "all") => {
    // TODO: Replace with Firestore updateDoc for the specific group
    console.log(`Set selection type to ${type} for group ${groupId} (needs Firestore implementation)`);
  }
  
  // Add Person - Needs Firestore add/update
  const handleAddPerson = () => {
    // TODO: Implement adding a person (likely involves a dialog/form and Firestore addDoc)
    console.log("Add Person clicked (needs implementation)");
  };

  // Assign Person to Group - Needs Firestore update
  const handleAssignPerson = (personId: string, groupId: string) => {
     // TODO: Implement assigning person to group (update Person doc, potentially update Group doc)
     console.log(`Assign person ${personId} to group ${groupId} (needs implementation)`);
  };
  
  // Add Group - Needs Firestore add
  const handleAddGroup = () => {
    // TODO: Implement adding a group (likely involves a dialog/form and Firestore addDoc)
     console.log("Add Group clicked (needs implementation)");
  };
  
  // Remove Person from Group - Needs Firestore update
  const handleRemovePersonFromGroup = (personId: string, groupId: string) => {
    // TODO: Implement removing person from group (update Person doc, potentially update Group doc)
     console.log(`Remove person ${personId} from group ${groupId} (needs implementation)`);
  };
  
  // Add Person to Specific Group - Needs Firestore update
  const handleAddPersonToGroup = (groupId: string) => {
     // TODO: Implement adding person to a specific group (likely involves a dialog/form selecting existing people or adding new, then update Firestore)
     console.log(`Add Person to group ${groupId} clicked (needs implementation)`);
  };


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
                {/* Connect handleAddPerson */}
                <Button size="sm" variant="outline" className="gap-1" onClick={handleAddPerson}>
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
                      {/* TODO: Add actual assign functionality - maybe dropdown with groups? */}
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => console.log('Assign clicked for', person.id)}> 
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
            {/* Connect handleAddGroup */}
            <Button size="sm" className="gap-1 bg-shrub hover:bg-shrub/90" onClick={handleAddGroup}>
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
                          {/* Connect handleRemovePersonFromGroup */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemovePersonFromGroup(person.id, group.id)} 
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connect handleAddPersonToGroup */}
                  <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => handleAddPersonToGroup(group.id)}>
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

