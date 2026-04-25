"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, Plus, User, Check, CalendarIcon, CalendarPlus, Clock, Calendar as CalendarIconLucide } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PersonPrayerCard } from "./PersonPrayerCard"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { Person, Group, PrayerRequest, FollowUp } from '@/lib/types'
import { getUrgencyLevel, formatFollowUpDate, sortFollowUpsByUrgency } from "@/lib/followUpUtils"
import { calculateAndSaveDailyPrayerList, previewDailyPrayerList, parseMapWithSets, stringifyMapWithSets } from "@/lib/utils"

// Firestore and Auth Imports
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import {
  collection, query, where, getDocs, doc, getDoc, Timestamp,
  serverTimestamp, orderBy, limit, addDoc
} from 'firebase/firestore'
import { updateDoc } from 'firebase/firestore'

// A person enriched with their most recent request (for the overview card)
type PersonWithRequest = Person & { mostRecentRequest?: PrayerRequest }

// A group with today's people resolved
interface TodayGroup {
  group: Group
  people: PersonWithRequest[]
}

export default function PrayerPage() {
  const { user, loading: authLoading } = useAuth()
  const effectRan = useRef(false)

  const todayKey = new Date().toISOString().split('T')[0]
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date())
  const viewingDateKey = viewingDate.toISOString().split('T')[0]
  const isToday = viewingDateKey === todayKey

  const daysFromToday = Math.round(
    (new Date(viewingDateKey).getTime() - new Date(todayKey).getTime()) / (1000 * 60 * 60 * 24)
  )

  const dateLabel = (() => {
    if (daysFromToday === 0) return viewingDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })
    if (daysFromToday === -1) return "Yesterday"
    if (daysFromToday === 1) return "Tomorrow"
    if (daysFromToday > 1) return viewingDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })
    return viewingDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })
  })()

  // --- Data state ---
  const [allUserGroups, setAllUserGroups] = useState<Group[]>([])
  const [allUserPeople, setAllUserPeople] = useState<PersonWithRequest[]>([])
  const [todaysGroups, setTodaysGroups] = useState<TodayGroup[]>([])
  const [allFollowUps, setAllFollowUps] = useState<FollowUp[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [isCompletingFollowUpId, setIsCompletingFollowUpId] = useState<string | null>(null)

  // --- Daily list cache ---
  const [dailySelectedIdsCache, setDailySelectedIdsCache] = useState<Map<string, Set<string>>>(new Map())

  // --- Carousel state ---
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [carouselIndex, setCarouselIndex] = useState(0) // 0 = overview card

  // --- Expanded details for current person card ---
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<{
    requests: PrayerRequest[]
    followUps: FollowUp[]
    loading: boolean
    error: string | null
  }>({ requests: [], followUps: [], loading: false, error: null })

  // --- Edit follow-up dialog ---
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [editFollowUpContent, setEditFollowUpContent] = useState("")
  const [editFollowUpDueDate, setEditFollowUpDueDate] = useState<Date | undefined>(undefined)
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false)
  const [isEditDatePickerOpen, setIsEditDatePickerOpen] = useState(false)

  // --- Header add prayer dialog ---
  const [headerAddPrayerOpen, setHeaderAddPrayerOpen] = useState(false)
  const [headerPrayerPersonId, setHeaderPrayerPersonId] = useState("")
  const [headerPrayerContent, setHeaderPrayerContent] = useState("")
  const [headerGroupFilter, setHeaderGroupFilter] = useState("all")
  const [isAddingHeaderPrayer, setIsAddingHeaderPrayer] = useState(false)

  // All people in today's list (flattened from todaysGroups), in order
  const todaysPeople: PersonWithRequest[] = todaysGroups.flatMap(tg => tg.people)

  // Total carousel items: 1 overview + N person cards
  const totalCards = 1 + todaysPeople.length

  // ----------------------------------------------------------------
  // Sync carousel index when the API fires a select event
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!carouselApi) return
    const handler = () => setCarouselIndex(carouselApi.selectedScrollSnap())
    carouselApi.on('select', handler)
    return () => { carouselApi.off('select', handler) }
  }, [carouselApi])

  // ----------------------------------------------------------------
  // Auto-fetch expanded details when carousel moves to a person card
  // ----------------------------------------------------------------
  useEffect(() => {
    if (carouselIndex === 0 || todaysPeople.length === 0) return
    const person = todaysPeople[carouselIndex - 1]
    if (!person) return
    if (person.id !== expandedPersonId) {
      setExpandedPersonId(person.id)
      fetchExpandedDetails(person.id)
    }
  }, [carouselIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------------------------------------------
  // Fetch full prayer requests + follow-ups for a person
  // ----------------------------------------------------------------
  const fetchExpandedDetails = async (personId: string) => {
    if (!personId) return
    setExpandedData({ requests: [], followUps: [], loading: true, error: null })
    try {
      const [requestsSnap, followUpsSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user!.uid, "persons", personId, "prayerRequests"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "users", user!.uid, "persons", personId, "followUps")))
      ])
      setExpandedData({
        requests: requestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrayerRequest)),
        followUps: followUpsSnap.docs.map(d => ({ id: d.id, ...d.data() } as FollowUp)),
        loading: false,
        error: null
      })
    } catch {
      setExpandedData({ requests: [], followUps: [], loading: false, error: "Could not load details." })
    }
  }

  // ----------------------------------------------------------------
  // Fetch all active follow-ups for all people (for urgent strip)
  // ----------------------------------------------------------------
  const fetchAllFollowUps = async (people: Person[]): Promise<FollowUp[]> => {
    if (people.length === 0) return []
    try {
      const results = await Promise.all(
        people.map(async (person) => {
          const snap = await getDocs(
            query(collection(db, "users", user!.uid, "persons", person.id, "followUps"), where("completed", "==", false))
          )
          return snap.docs.map(d => ({ id: d.id, ...d.data(), personId: person.id } as FollowUp))
            .filter(fu => !fu.archived)
        })
      )
      return results.flat()
    } catch {
      return []
    }
  }

  // ----------------------------------------------------------------
  // Build today's groups from fetched data + daily list
  // Groups ordered by their `order` field (assignment-page order)
  // ----------------------------------------------------------------
  const buildTodaysGroups = (
    fetchedGroups: Group[],
    fetchedPeople: PersonWithRequest[],
    todayIds: Set<string>,
    dayIndex: number
  ): TodayGroup[] => {
    // Only groups scheduled today
    const activeGroups = fetchedGroups.filter(g => g.prayerDays?.includes(dayIndex))

    // Sort by `order` field (how they appear on assignments page), system groups last
    const sorted = [...activeGroups].sort((a, b) => {
      if (a.isSystemGroup && !b.isSystemGroup) return 1
      if (!a.isSystemGroup && b.isSystemGroup) return -1
      const orderA = a.order ?? 999
      const orderB = b.order ?? 999
      return orderA - orderB
    })

    return sorted.map(group => {
      let groupPeople: PersonWithRequest[]
      if (group.isSystemGroup && group.name === "Everyone") {
        groupPeople = fetchedPeople.filter(p => !p.groupId)
      } else {
        groupPeople = fetchedPeople.filter(p => p.groupId === group.id)
      }
      // Filter to only today's selected people
      const people = groupPeople.filter(p => todayIds.has(p.id))
      // Sort by name within the group
      people.sort((a, b) => a.name.localeCompare(b.name))
      return { group, people }
    }).filter(tg => tg.people.length > 0)
  }

  // ----------------------------------------------------------------
  // Main data load
  // ----------------------------------------------------------------
  const refreshPrayerList = async () => {
    if (!user) { setLoadingData(false); return }
    const userId = user.uid
    const today = new Date()
    const dayIndex = today.getDay()
    const dateKey = today.toISOString().split('T')[0]

    setLoadingData(true)
    try {
      // Fetch people and groups in parallel
      const [peopleSnap, groupsSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "persons")),
        getDocs(collection(db, "users", userId, "groups"))
      ])

      const fetchedGroups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group))
      const fetchedPeople = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() } as Person))

      setAllUserGroups(fetchedGroups)

      // Fetch most recent prayer request for each person
      const peopleWithRequests = await Promise.all(
        fetchedPeople.map(async (person) => {
          const reqSnap = await getDocs(
            query(collection(db, "users", userId, "persons", person.id, "prayerRequests"), orderBy("createdAt", "desc"), limit(1))
          )
          const mostRecentRequest = reqSnap.empty ? undefined : { id: reqSnap.docs[0].id, ...reqSnap.docs[0].data() } as PrayerRequest
          return { ...person, mostRecentRequest }
        })
      )
      setAllUserPeople(peopleWithRequests)

      // Fetch follow-ups for urgent strip
      const followUps = await fetchAllFollowUps(fetchedPeople)
      setAllFollowUps(followUps)

      // Determine today's person IDs (Firestore cache + settings validation)
      let todayIds: Set<string>

      // Check Firestore cache
      const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey)
      const dailyListSnap = await getDoc(dailyListRef)

      if (dailyListSnap.exists()) {
        const data = dailyListSnap.data()
        const storedIds = new Set<string>(data.personIds || [])
        const storedSnapshot = data.settingsSnapshot || {}

        // Build current settings snapshot to validate
        const currentSnapshot: Record<string, { numPerDay: number | null }> = {}
        const activeGroups = fetchedGroups.filter(g => g.prayerDays?.includes(dayIndex))
        activeGroups.forEach(group => {
          let totalPeople: number
          if (group.isSystemGroup && group.name === "Everyone") {
            totalPeople = fetchedPeople.filter(p => !p.groupId).length
          } else {
            totalPeople = (group.personIds ?? []).length
          }
          if (totalPeople > 0) {
            const numPerDay = group.prayerSettings?.numPerDay ?? null
            const actual = numPerDay === null ? totalPeople : Math.min(numPerDay, totalPeople)
            currentSnapshot[group.id] = { numPerDay: actual }
          }
        })

        const storedStr = JSON.stringify(storedSnapshot, Object.keys(storedSnapshot).sort())
        const currentStr = JSON.stringify(currentSnapshot, Object.keys(currentSnapshot).sort())

        if (storedStr === currentStr) {
          todayIds = storedIds
        } else {
          todayIds = await calculateAndSaveDailyPrayerList(db, userId, today)
        }
      } else {
        // Check session storage fallback
        const sessionData = sessionStorage.getItem(`prayerApp_dailyCache_${userId}`)
        const sessionCache = parseMapWithSets(sessionData)
        if (sessionCache.has(dateKey)) {
          todayIds = sessionCache.get(dateKey)!
          setDailySelectedIdsCache(sessionCache)
        } else {
          todayIds = await calculateAndSaveDailyPrayerList(db, userId, today)
          setDailySelectedIdsCache(prev => {
            const next = new Map(prev)
            next.set(dateKey, todayIds)
            try { sessionStorage.setItem(`prayerApp_dailyCache_${userId}`, stringifyMapWithSets(next)) } catch {}
            return next
          })
        }
      }

      const groups = buildTodaysGroups(fetchedGroups, peopleWithRequests, todayIds, dayIndex)
      setTodaysGroups(groups)

    } catch (err) {
      console.error("[PrayerPage] Error loading data:", err)
    } finally {
      setLoadingData(false)
    }
  }

  // ----------------------------------------------------------------
  // Effects
  // ----------------------------------------------------------------
  useEffect(() => {
    if (effectRan.current === true || process.env.NODE_ENV !== 'development') {
      if (!authLoading && user) {
        refreshPrayerList()
      } else if (!authLoading && !user) {
        setLoadingData(false)
        setAllUserGroups([])
        setAllUserPeople([])
        setTodaysGroups([])
      }
    }
    return () => { effectRan.current = true }
  }, [user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------------------------------------------
  // Follow-up completion
  // ----------------------------------------------------------------
  const handleCompleteFollowUp = async (personId: string, followUpId: string) => {
    if (isCompletingFollowUpId) return
    setIsCompletingFollowUpId(followUpId)
    try {
      await updateDoc(doc(db, "users", user!.uid, "persons", personId, "followUps", followUpId), {
        completed: true,
        completedAt: serverTimestamp()
      })
      setAllFollowUps(prev => prev.filter(fu => fu.id !== followUpId))
      setExpandedData(prev => ({
        ...prev,
        followUps: prev.followUps.map(fu => fu.id === followUpId ? { ...fu, completed: true } : fu)
      }))
    } catch (err) {
      console.error("Error completing follow-up:", err)
    } finally {
      setIsCompletingFollowUpId(null)
    }
  }

  // ----------------------------------------------------------------
  // Edit follow-up
  // ----------------------------------------------------------------
  const handleEditFollowUpSave = async () => {
    if (!editingFollowUp || !editFollowUpContent.trim()) return
    setIsEditingFollowUp(true)
    try {
      await updateDoc(doc(db, "users", user!.uid, "persons", editingFollowUp.personId, "followUps", editingFollowUp.id), {
        content: editFollowUpContent.trim(),
        dueDate: editFollowUpDueDate ? Timestamp.fromDate(editFollowUpDueDate) : null,
      })
      setAllFollowUps(prev => prev.map(fu =>
        fu.id === editingFollowUp.id
          ? { ...fu, content: editFollowUpContent.trim(), dueDate: editFollowUpDueDate ? Timestamp.fromDate(editFollowUpDueDate) : undefined }
          : fu
      ))
      setEditingFollowUp(null)
    } catch (err) {
      console.error("Error editing follow-up:", err)
    } finally {
      setIsEditingFollowUp(false)
    }
  }

  // ----------------------------------------------------------------
  // Add prayer request from person card
  // ----------------------------------------------------------------
  const handleAddPrayerRequestFromCard = async (personId: string, content: string) => {
    if (!user || !content) return
    const person = allUserPeople.find(p => p.id === personId)
    await addDoc(collection(db, "users", user.uid, "persons", personId, "prayerRequests"), {
      personId,
      personName: person?.name || "Unknown",
      content,
      createdAt: serverTimestamp(),
      isCompleted: false
    })
    if (expandedPersonId === personId) fetchExpandedDetails(personId)
  }

  // ----------------------------------------------------------------
  // Add follow-up from person card
  // ----------------------------------------------------------------
  const handleAddQuickFollowUp = async (personId: string, content: string, dueDate?: Date) => {
    if (!user || !content) return
    const followUpData: Record<string, unknown> = {
      personId,
      content,
      createdAt: serverTimestamp(),
      completed: false,
      archived: false
    }
    if (dueDate) followUpData.dueDate = Timestamp.fromDate(dueDate)
    await addDoc(collection(db, "users", user.uid, "persons", personId, "followUps"), followUpData)
    if (expandedPersonId === personId) fetchExpandedDetails(personId)
  }

  // ----------------------------------------------------------------
  // Header add prayer dialog
  // ----------------------------------------------------------------
  const filteredPeopleForHeaderDialog = headerGroupFilter === "all"
    ? allUserPeople
    : (() => {
        const everyoneGroup = allUserGroups.find(g => g.isSystemGroup && g.name === "Everyone")
        if (headerGroupFilter === everyoneGroup?.id) return allUserPeople.filter(p => !p.groupId)
        return allUserPeople.filter(p => p.groupId === headerGroupFilter)
      })()

  const handleAddHeaderPrayer = async () => {
    if (!user || !headerPrayerContent || !headerPrayerPersonId) return
    setIsAddingHeaderPrayer(true)
    try {
      const person = allUserPeople.find(p => p.id === headerPrayerPersonId)
      await addDoc(collection(db, "users", user.uid, "persons", headerPrayerPersonId, "prayerRequests"), {
        personId: headerPrayerPersonId,
        personName: person?.name || "Unknown",
        content: headerPrayerContent,
        createdAt: serverTimestamp(),
        isCompleted: false
      })
      if (expandedPersonId === headerPrayerPersonId) fetchExpandedDetails(headerPrayerPersonId)
      setHeaderPrayerContent("")
      setHeaderPrayerPersonId("")
      setHeaderGroupFilter("all")
      setHeaderAddPrayerOpen(false)
    } catch (err) {
      console.error("Error adding prayer request:", err)
    } finally {
      setIsAddingHeaderPrayer(false)
    }
  }

  // ----------------------------------------------------------------
  // Load list for a specific date (past = read Firestore, future = preview)
  // ----------------------------------------------------------------
  const loadDateList = async (date: Date) => {
    if (!user) return
    const userId = user.uid
    const dateKey = date.toISOString().split('T')[0]
    const dayIndex = date.getDay()
    const today = new Date().toISOString().split('T')[0]

    setLoadingData(true)
    try {
      // Always need people/groups for building the display
      const [peopleSnap, groupsSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "persons")),
        getDocs(collection(db, "users", userId, "groups"))
      ])
      const fetchedGroups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group))
      const fetchedPeople = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() } as Person))
      setAllUserGroups(fetchedGroups)

      const peopleWithRequests = await Promise.all(
        fetchedPeople.map(async (person) => {
          const reqSnap = await getDocs(
            query(collection(db, "users", userId, "persons", person.id, "prayerRequests"), orderBy("createdAt", "desc"), limit(1))
          )
          const mostRecentRequest = reqSnap.empty ? undefined : { id: reqSnap.docs[0].id, ...reqSnap.docs[0].data() } as PrayerRequest
          return { ...person, mostRecentRequest }
        })
      )
      setAllUserPeople(peopleWithRequests)

      let dateIds: Set<string>

      if (dateKey === today) {
        // Today: use existing full logic
        await refreshPrayerList()
        return
      } else if (dateKey < today) {
        // Past: read stored list from Firestore
        const listSnap = await getDoc(doc(db, "users", userId, "dailyPrayerLists", dateKey))
        if (listSnap.exists()) {
          dateIds = new Set<string>(listSnap.data().personIds || [])
        } else {
          dateIds = new Set<string>()
        }
      } else {
        // Future: calculate preview without writing
        dateIds = await previewDailyPrayerList(db, userId, date)
      }

      const groups = buildTodaysGroups(fetchedGroups, peopleWithRequests, dateIds, dayIndex)
      setTodaysGroups(groups)
    } catch (err) {
      console.error("[PrayerPage] Error loading date list:", err)
    } finally {
      setLoadingData(false)
    }
  }

  // ----------------------------------------------------------------
  // Date navigation
  // ----------------------------------------------------------------
  const navigateDate = (delta: number) => {
    const next = new Date(viewingDate)
    next.setDate(next.getDate() + delta)
    setViewingDate(next)
    setCarouselIndex(0)
    carouselApi?.scrollTo(0, true)
    loadDateList(next)
  }

  // ----------------------------------------------------------------
  // Navigation helpers
  // ----------------------------------------------------------------
  const handlePrevious = () => carouselApi?.scrollPrev()
  const handleNext = () => carouselApi?.scrollNext()
  const handleJumpToPerson = (personIndex: number) => {
    // personIndex is 0-based in todaysPeople; carousel index is 1-based (0 = overview)
    carouselApi?.scrollTo(personIndex + 1)
  }

  // ----------------------------------------------------------------
  // Auth loading / not logged in states
  // ----------------------------------------------------------------
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>
  }

  if (!user) {
    return (
      <div className="mobile-container pb-16 md:pb-6">
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="page-title">Today</h1>
            <p className="text-muted-foreground">{dateLabel}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <p className="text-muted-foreground">
            Please <strong className="text-foreground">log in</strong> or <strong className="text-foreground">sign up</strong> to view your prayer list.
          </p>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  const urgentFollowUps = allFollowUps.filter(fu => {
    const urgency = getUrgencyLevel(fu.dueDate)
    return ['overdue', 'today', 'soon'].includes(urgency)
  })

  const currentPersonIndex = carouselIndex - 1 // -1 when on overview card
  const currentPerson = currentPersonIndex >= 0 ? todaysPeople[currentPersonIndex] : null

  return (
    <div className="mobile-container pb-16 md:pb-6 flex flex-col">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -ml-1.5"
              onClick={() => navigateDate(-1)}
              disabled={loadingData}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="page-title">{isToday ? "Today" : daysFromToday === 1 ? "Tomorrow" : daysFromToday === -1 ? "Yesterday" : viewingDate.toLocaleDateString("en-US", { weekday: 'long' })}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateDate(1)}
              disabled={loadingData || daysFromToday >= 7}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground">{dateLabel}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setHeaderAddPrayerOpen(true)}
          className="bg-shrub hover:bg-shrub/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Prayer
        </Button>
      </div>

      {loadingData ? (
        <div className="text-center py-10 text-muted-foreground">Loading prayer list...</div>
      ) : (
        <>
          {todaysPeople.length === 0 ? (
            <div className="text-center py-8 px-4 text-muted-foreground">
              {!isToday
                ? <p>No prayer list for this day.</p>
                : allUserPeople.length > 0
                  ? <><p className="mb-2">No groups scheduled for prayer today.</p><p>Assign people to groups and set prayer days in the <span className="font-semibold">People</span> tab.</p></>
                  : <p>No groups or people yet.</p>
              }
            </div>
          ) : (
            <>
              {/* Carousel */}
              <Carousel
                setApi={setCarouselApi}
                opts={{ loop: true, duration: 30 }}
                className="flex-1 min-h-0"
              >
                <CarouselContent className="h-full">
                  {/* Card 0: Overview */}
                  <CarouselItem className="h-full">
                    <div className="h-full overflow-y-auto p-6">
                      {/* Conditional "Prayer List" header */}
                      {urgentFollowUps.length > 0 && (
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prayer List</p>
                      )}

                      {/* People list */}
                      <div className="space-y-1">
                        {todaysGroups.map(({ group, people }, groupIdx) =>
                          people.map((person, personIdx) => {
                            const absoluteIdx = todaysGroups
                              .slice(0, groupIdx)
                              .reduce((sum, tg) => sum + tg.people.length, 0) + personIdx
                            return (
                              <button
                                key={person.id}
                                onClick={() => handleJumpToPerson(absoluteIdx)}
                                className="flex items-start gap-2 w-full text-left px-2 py-2 rounded-md hover:bg-muted/60 transition-colors"
                              >
                                <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-base leading-snug">{person.name}</p>
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                                      {group.name}
                                    </span>
                                  </div>
                                  {person.mostRecentRequest?.content && (
                                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                                      {person.mostRecentRequest.content.replace(/\n/g, ' ').slice(0, 80)}
                                      {person.mostRecentRequest.content.length > 80 ? '…' : ''}
                                    </p>
                                  )}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>

                      {/* Follow-ups section */}
                      {urgentFollowUps.length > 0 && (
                        <div className="mt-6">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Follow Ups</p>
                          <div className="space-y-1">
                            {sortFollowUpsByUrgency(urgentFollowUps).map(fu => {
                              const person = allUserPeople.find(p => p.id === fu.personId)
                              const urgency = getUrgencyLevel(fu.dueDate)
                              const isOverdue = urgency === "overdue" || urgency === "today"
                              return (
                                <div key={fu.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
                                  <Checkbox
                                    id={`today-fu-${fu.id}`}
                                    checked={false}
                                    onCheckedChange={() => handleCompleteFollowUp(fu.personId, fu.id)}
                                    disabled={isCompletingFollowUpId === fu.id}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <label htmlFor={`today-fu-${fu.id}`} className="font-medium cursor-pointer text-base leading-snug">{fu.content}</label>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>{person?.name || "Unknown"}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                    {fu.dueDate && (
                                      <Badge className="bg-shrub hover:bg-shrub/90 text-primary-foreground text-xs gap-1">
                                        {isOverdue ? <Clock className="h-3 w-3" /> : <CalendarIconLucide className="h-3 w-3" />}
                                        {formatFollowUpDate(fu.dueDate)}
                                      </Badge>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setEditingFollowUp(fu)
                                        setEditFollowUpContent(fu.content)
                                        setEditFollowUpDueDate(fu.dueDate?.toDate())
                                      }}
                                    >
                                      <CalendarPlus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  {/* Cards 1–N: Individual person cards */}
                  {todaysPeople.map((person, idx) => (
                    <CarouselItem key={person.id} className="h-full">
                      <PersonPrayerCard
                        person={person}
                        mostRecentRequest={person.mostRecentRequest}
                        expandedRequests={expandedPersonId === person.id ? expandedData.requests : []}
                        isLoadingExpanded={expandedPersonId === person.id && expandedData.loading}
                        onAddRequest={(content) => handleAddPrayerRequestFromCard(person.id, content)}
                        onAddFollowUp={(content, dueDate) => handleAddQuickFollowUp(person.id, content, dueDate)}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {/* Navigation footer — hidden on mobile, swipe to navigate */}
              <div className="hidden sm:block border-t bg-background shrink-0">
                <div className="flex items-center justify-between h-14 px-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={carouselIndex === 0}
                    className={cn("gap-1", carouselIndex === 0 && "invisible")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    {carouselIndex === 0
                      ? `${todaysPeople.length} people`
                      : `${carouselIndex} / ${todaysPeople.length}`}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={carouselIndex === totalCards - 1}
                    className={cn("gap-1", carouselIndex === totalCards - 1 && "invisible")}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Edit Follow-Up Dialog */}
      <Dialog open={!!editingFollowUp} onOpenChange={(open) => { if (!open) setEditingFollowUp(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Follow-Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editFollowUpContent}
              onChange={(e) => setEditFollowUpContent(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground shrink-0">Due date:</Label>
              <Popover open={isEditDatePickerOpen} onOpenChange={setIsEditDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal flex-1", !editFollowUpDueDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editFollowUpDueDate
                      ? editFollowUpDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Optional"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editFollowUpDueDate}
                    onSelect={(date) => { setEditFollowUpDueDate(date); setIsEditDatePickerOpen(false) }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {editFollowUpDueDate && (
                <Button variant="ghost" size="sm" onClick={() => setEditFollowUpDueDate(undefined)} className="text-muted-foreground h-8 px-2">
                  Clear
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFollowUp(null)}>Cancel</Button>
            <Button onClick={handleEditFollowUpSave} disabled={isEditingFollowUp || !editFollowUpContent.trim()}>
              {isEditingFollowUp ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Add Prayer Dialog */}
      <Dialog open={headerAddPrayerOpen} onOpenChange={setHeaderAddPrayerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Prayer Request</DialogTitle>
            <DialogDescription>Add a prayer request for someone</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-filter">Group (Filter)</Label>
              <Select
                value={headerGroupFilter}
                onValueChange={(value) => {
                  setHeaderGroupFilter(value)
                  setHeaderPrayerPersonId("")
                }}
              >
                <SelectTrigger id="group-filter">
                  <SelectValue placeholder="Filter by group..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All People</SelectItem>
                  {allUserGroups.filter(g => g.isSystemGroup).map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                  {allUserGroups.filter(g => !g.isSystemGroup).length > 0 && <SelectSeparator />}
                  {allUserGroups.filter(g => !g.isSystemGroup).map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-select">Person</Label>
              <Select
                value={headerPrayerPersonId}
                onValueChange={setHeaderPrayerPersonId}
                disabled={filteredPeopleForHeaderDialog.length === 0}
              >
                <SelectTrigger id="person-select">
                  <SelectValue placeholder={filteredPeopleForHeaderDialog.length > 0 ? "Select a person..." : "No people in selected group"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPeopleForHeaderDialog.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prayer-content">Prayer Request</Label>
              <Textarea
                id="prayer-content"
                value={headerPrayerContent}
                onChange={(e) => setHeaderPrayerContent(e.target.value)}
                placeholder="Enter prayer request..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeaderAddPrayerOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddHeaderPrayer}
              disabled={isAddingHeaderPrayer || !headerPrayerPersonId || !headerPrayerContent}
            >
              {isAddingHeaderPrayer ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
