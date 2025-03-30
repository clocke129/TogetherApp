"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, AlertTriangle, User, Check, Plus, Repeat, CalendarPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

// Types
type Person = {
  id: string
  name: string
}

type RecurringPattern = {
  type: "daily" | "weekly" | "monthly" | "yearly"
  interval: number
}

type FollowUp = {
  id: string
  personId: string
  content: string
  dueDate: Date
  completed: boolean
  isRecurring?: boolean
  recurringPattern?: RecurringPattern
}

// Mock data
const MOCK_PEOPLE: Person[] = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Sarah Johnson" },
  { id: "3", name: "Michael Brown" },
  { id: "4", name: "Emily Davis" },
]

const MOCK_FOLLOWUPS: FollowUp[] = [
  {
    id: "f1",
    personId: "1",
    content: "Check in about job search",
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
    completed: false,
  },
  {
    id: "f2",
    personId: "2",
    content: "Ask about her mom's test results",
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
    completed: false,
  },
  {
    id: "f3",
    personId: "3",
    content: "Follow up on presentation",
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    completed: false,
  },
  {
    id: "f4",
    personId: "4",
    content: "Check on exam results",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    completed: false,
    isRecurring: true,
    recurringPattern: {
      type: "weekly",
      interval: 1,
    },
  },
  {
    id: "f5",
    personId: "1",
    content: "Discuss career options",
    dueDate: new Date(0), // No specific date
    completed: false,
  },
  {
    id: "f6",
    personId: "2",
    content: "Pray for upcoming surgery",
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    completed: false,
    isRecurring: true,
    recurringPattern: {
      type: "daily",
      interval: 1,
    },
  },
  {
    id: "f7",
    personId: "3",
    content: "Check on family situation",
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (overdue)
    completed: true,
  },
]

export default function FollowupsPage() {
  const [people] = useState<Person[]>(MOCK_PEOPLE)
  const [followUps, setFollowUps] = useState<FollowUp[]>(MOCK_FOLLOWUPS)
  const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUp>>({
    content: "",
    personId: "",
    dueDate: new Date(),
    completed: false,
    isRecurring: false,
    recurringPattern: {
      type: "weekly",
      interval: 1,
    },
  })
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Get person by ID
  const getPersonById = (personId: string) => {
    return people.find((person) => person.id === personId)
  }

  // Toggle follow-up completion
  const toggleFollowUpCompletion = (followUpId: string) => {
    setFollowUps((prev) =>
      prev.map((followUp) => (followUp.id === followUpId ? { ...followUp, completed: !followUp.completed } : followUp)),
    )
  }

  // Format date for display
  const formatDate = (date: Date) => {
    if (date.getTime() === 0) return "No date"

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    if (isToday) return "Today"
    if (isTomorrow) return "Tomorrow"

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Format date for input
  const formatDateForInput = (date: Date) => {
    if (date.getTime() === 0) return ""

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  // Handle adding a new follow-up
  const handleAddFollowUp = () => {
    if (!newFollowUp.content || !newFollowUp.personId) return

    const newId = `f${Date.now()}`

    setFollowUps((prev) => [
      ...prev,
      {
        id: newId,
        personId: newFollowUp.personId || "",
        content: newFollowUp.content || "",
        dueDate: newFollowUp.dueDate || new Date(),
        completed: false,
        isRecurring: newFollowUp.isRecurring,
        recurringPattern: newFollowUp.isRecurring ? newFollowUp.recurringPattern : undefined,
      },
    ])

    // Reset form
    setNewFollowUp({
      content: "",
      personId: "",
      dueDate: new Date(),
      completed: false,
      isRecurring: false,
      recurringPattern: {
        type: "weekly",
        interval: 1,
      },
    })

    setIsAddDialogOpen(false)
  }

  // Handle editing a follow-up
  const handleEditFollowUp = () => {
    if (!editingFollowUp) return

    setFollowUps((prev) => prev.map((followUp) => (followUp.id === editingFollowUp.id ? editingFollowUp : followUp)))

    setEditingFollowUp(null)
    setIsEditDialogOpen(false)
  }

  // Open edit dialog for a follow-up
  const openEditDialog = (followUp: FollowUp) => {
    setEditingFollowUp(followUp)
    setIsEditDialogOpen(true)
  }

  // Set date for a follow-up with no date
  const setDateForFollowUp = (followUpId: string) => {
    const followUp = followUps.find((f) => f.id === followUpId)
    if (followUp) {
      setEditingFollowUp(followUp)
      setIsEditDialogOpen(true)
    }
  }

  // Get overdue follow-ups
  const overdueFollowUps = followUps.filter(
    (followUp) => !followUp.completed && followUp.dueDate < new Date() && followUp.dueDate.getTime() !== 0,
  )

  // Get upcoming follow-ups
  const upcomingFollowUps = followUps.filter((followUp) => !followUp.completed && followUp.dueDate >= new Date())

  // Get follow-ups with no date
  const noDateFollowUps = followUps.filter((followUp) => !followUp.completed && followUp.dueDate.getTime() === 0)

  // Get completed follow-ups
  const completedFollowUps = followUps.filter((followUp) => followUp.completed)

  // Get recurring pattern text
  const getRecurringPatternText = (pattern?: RecurringPattern) => {
    if (!pattern) return ""

    switch (pattern.type) {
      case "daily":
        return pattern.interval === 1 ? "Daily" : `Every ${pattern.interval} days`
      case "weekly":
        return pattern.interval === 1 ? "Weekly" : `Every ${pattern.interval} weeks`
      case "monthly":
        return pattern.interval === 1 ? "Monthly" : `Every ${pattern.interval} months`
      case "yearly":
        return pattern.interval === 1 ? "Yearly" : `Every ${pattern.interval} years`
      default:
        return ""
    }
  }

  return (
    <div className="mobile-container pb-16 md:pb-6">
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-description">Track and manage your follow-up items</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-shrub hover:bg-shrub/90">
              <Plus className="mr-2 h-4 w-4" />
              New Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Follow-up</DialogTitle>
              <DialogDescription>Create a new follow-up item to track</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="content">Follow-up Item</Label>
                <Input
                  id="content"
                  value={newFollowUp.content}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                  placeholder="What do you need to follow up on?"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="person">Person</Label>
                <Select
                  value={newFollowUp.personId}
                  onValueChange={(value) => setNewFollowUp({ ...newFollowUp, personId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formatDateForInput(newFollowUp.dueDate || new Date())}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : new Date(0)
                    setNewFollowUp({ ...newFollowUp, dueDate: date })
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={newFollowUp.isRecurring}
                  onCheckedChange={(checked) => setNewFollowUp({ ...newFollowUp, isRecurring: checked })}
                />
                <Label htmlFor="recurring">Recurring Follow-up</Label>
              </div>

              {newFollowUp.isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="recurringType">Frequency</Label>
                    <Select
                      value={newFollowUp.recurringPattern?.type}
                      onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") =>
                        setNewFollowUp({
                          ...newFollowUp,
                          recurringPattern: {
                            ...(newFollowUp.recurringPattern as RecurringPattern),
                            type: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="interval">Every</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="1"
                      value={newFollowUp.recurringPattern?.interval || 1}
                      onChange={(e) =>
                        setNewFollowUp({
                          ...newFollowUp,
                          recurringPattern: {
                            ...(newFollowUp.recurringPattern as RecurringPattern),
                            interval: Number.parseInt(e.target.value) || 1,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddFollowUp} className="bg-shrub hover:bg-shrub/90">
                Add Follow-up
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Follow-up Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Follow-up</DialogTitle>
              <DialogDescription>Update the follow-up details</DialogDescription>
            </DialogHeader>
            {editingFollowUp && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-content">Follow-up Item</Label>
                  <Input
                    id="edit-content"
                    value={editingFollowUp.content}
                    onChange={(e) => setEditingFollowUp({ ...editingFollowUp, content: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-person">Person</Label>
                  <Select
                    value={editingFollowUp.personId}
                    onValueChange={(value) => setEditingFollowUp({ ...editingFollowUp, personId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-dueDate">Due Date</Label>
                  <Input
                    id="edit-dueDate"
                    type="date"
                    value={formatDateForInput(editingFollowUp.dueDate)}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : new Date(0)
                      setEditingFollowUp({ ...editingFollowUp, dueDate: date })
                    }}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-recurring"
                    checked={editingFollowUp.isRecurring}
                    onCheckedChange={(checked) => {
                      setEditingFollowUp({
                        ...editingFollowUp,
                        isRecurring: checked,
                        recurringPattern: checked
                          ? editingFollowUp.recurringPattern || { type: "weekly", interval: 1 }
                          : undefined,
                      })
                    }}
                  />
                  <Label htmlFor="edit-recurring">Recurring Follow-up</Label>
                </div>

                {editingFollowUp.isRecurring && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-recurringType">Frequency</Label>
                      <Select
                        value={editingFollowUp.recurringPattern?.type || "weekly"}
                        onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") =>
                          setEditingFollowUp({
                            ...editingFollowUp,
                            recurringPattern: {
                              ...(editingFollowUp.recurringPattern as RecurringPattern),
                              type: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-interval">Every</Label>
                      <Input
                        id="edit-interval"
                        type="number"
                        min="1"
                        value={editingFollowUp.recurringPattern?.interval || 1}
                        onChange={(e) =>
                          setEditingFollowUp({
                            ...editingFollowUp,
                            recurringPattern: {
                              ...(editingFollowUp.recurringPattern as RecurringPattern),
                              interval: Number.parseInt(e.target.value) || 1,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditFollowUp} className="bg-shrub hover:bg-shrub/90">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Overdue Follow-ups */}
          {overdueFollowUps.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span>Overdue</span>
                  <Badge variant="destructive">{overdueFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {overdueFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonById(followUp.personId)?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(followUp.dueDate)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(followUp)}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Follow-ups */}
          {upcomingFollowUps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-shrub" />
                  <span>Upcoming</span>
                  <Badge variant="outline">{upcomingFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonById(followUp.personId)?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(followUp.dueDate)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(followUp)}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Date Follow-ups */}
          {noDateFollowUps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>No Date Assigned</span>
                  <Badge variant="outline">{noDateFollowUps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {noDateFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="font-medium cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{getPersonById(followUp.personId)?.name}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setDateForFollowUp(followUp.id)}>
                        Set Date
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && noDateFollowUps.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No active follow-ups</h3>
              <p className="text-muted-foreground mt-1">All your follow-ups are completed!</p>
              <Button className="mt-4 bg-shrub hover:bg-shrub/90" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Follow-up
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span>Completed</span>
                <Badge variant="outline">{completedFollowUps.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedFollowUps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No completed follow-ups yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedFollowUps.map((followUp) => (
                    <div key={followUp.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted">
                      <Checkbox
                        id={followUp.id}
                        checked={followUp.completed}
                        onCheckedChange={() => toggleFollowUpCompletion(followUp.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={followUp.id} className="line-through text-muted-foreground cursor-pointer">
                            {followUp.content}
                          </label>
                          {followUp.isRecurring && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-birchwood/20">
                              <Repeat className="h-3 w-3" />
                              {getRecurringPatternText(followUp.recurringPattern)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{getPersonById(followUp.personId)?.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

