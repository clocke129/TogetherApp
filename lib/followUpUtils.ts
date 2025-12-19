import { Timestamp } from "firebase/firestore"
import type { FollowUp } from "./types"

export type UrgencyLevel = "overdue" | "today" | "soon" | "normal"

export interface CategorizedFollowUps {
  overdue: FollowUp[]
  thisWeek: FollowUp[]
  future: FollowUp[]
  noDate: FollowUp[]
}

/**
 * Get the urgency level of a follow-up based on its due date
 */
export function getUrgencyLevel(dueDate: Timestamp | undefined): UrgencyLevel {
  if (!dueDate) return "normal"

  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today

  const due = dueDate.toDate()
  due.setHours(0, 0, 0, 0) // Start of due date

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const threeDaysFromNow = new Date(today)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  // Overdue if due date is before today
  if (due < today) return "overdue"

  // Due today if same day
  if (due.getTime() === today.getTime()) return "today"

  // Due soon if within next 3 days
  if (due < threeDaysFromNow) return "soon"

  return "normal"
}

/**
 * Categorize follow-ups by date into overdue, this week, future, and no date
 */
export function categorizeFollowUps(followUps: FollowUp[]): CategorizedFollowUps {
  const now = Timestamp.now()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysTimestamp = Timestamp.fromDate(sevenDaysFromNow)

  // Epoch zero used as placeholder for "no date"
  const epochZeroTimestamp = Timestamp.fromDate(new Date(0))

  const overdue = followUps
    .filter(
      (fu) =>
        fu.dueDate &&
        fu.dueDate < now &&
        fu.dueDate.seconds !== epochZeroTimestamp.seconds
    )
    .sort(
      (a, b) =>
        (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity)
    )

  const thisWeek = followUps
    .filter(
      (fu) =>
        fu.dueDate &&
        fu.dueDate >= now &&
        fu.dueDate < sevenDaysTimestamp
    )
    .sort(
      (a, b) =>
        (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity)
    )

  const future = followUps
    .filter((fu) => fu.dueDate && fu.dueDate >= sevenDaysTimestamp)
    .sort(
      (a, b) =>
        (a.dueDate?.seconds ?? Infinity) - (b.dueDate?.seconds ?? Infinity)
    )

  const noDate = followUps.filter(
    (fu) =>
      !fu.dueDate || fu.dueDate.seconds === epochZeroTimestamp.seconds
  )

  return {
    overdue,
    thisWeek,
    future,
    noDate,
  }
}

/**
 * Sort follow-ups by urgency level (overdue first, then today, then soon, then normal)
 */
export function sortFollowUpsByUrgency(followUps: FollowUp[]): FollowUp[] {
  const urgencyOrder: Record<UrgencyLevel, number> = {
    overdue: 0,
    today: 1,
    soon: 2,
    normal: 3,
  }

  return [...followUps].sort((a, b) => {
    const urgencyA = getUrgencyLevel(a.dueDate)
    const urgencyB = getUrgencyLevel(b.dueDate)

    const orderDiff = urgencyOrder[urgencyA] - urgencyOrder[urgencyB]

    // If same urgency, sort by due date
    if (orderDiff === 0) {
      const dateA = a.dueDate?.seconds ?? Infinity
      const dateB = b.dueDate?.seconds ?? Infinity
      return dateA - dateB
    }

    return orderDiff
  })
}

/**
 * Format a Firestore Timestamp to a readable date string
 */
export function formatFollowUpDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return "No date"

  const date = timestamp.toDate()
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
