/**
 * Server-side prayer list builder for email digests.
 * Mirrors calculateAndSaveDailyPrayerList from lib/utils.ts but uses Firebase Admin SDK.
 */

import { adminDb } from '@/lib/firebase-admin'
import type { FieldValue } from 'firebase-admin/firestore'

interface PersonDigest {
  name: string
  prayerRequest?: string
}

interface DigestData {
  people: PersonDigest[]
  dateLabel: string  // "Monday, April 21"
}

function sortByLastPrayedFor(people: Array<{ id: string; lastPrayedFor?: { toMillis(): number } }>): typeof people {
  return people.slice().sort((a, b) => {
    const timeA = a.lastPrayedFor?.toMillis() ?? 0
    const timeB = b.lastPrayedFor?.toMillis() ?? 0
    if (timeA !== timeB) return timeA - timeB
    return a.id.localeCompare(b.id)
  })
}

export async function buildDailyDigestData(userId: string, targetDate: Date): Promise<DigestData> {
  const currentDayIndex = targetDate.getDay()
  const dateKey = targetDate.toISOString().split('T')[0]

  const dateLabel = targetDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // 1. Check if daily list already exists for today
  const dailyListRef = adminDb.doc(`users/${userId}/dailyPrayerLists/${dateKey}`)
  const existingList = await dailyListRef.get()

  let personIds: string[] = []

  if (existingList.exists) {
    personIds = existingList.data()?.personIds ?? []
  } else {
    // Calculate the list (mirrors client-side logic)
    const groupsSnap = await adminDb
      .collection('groups')
      .where('createdBy', '==', userId)
      .get()
    const groups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any)

    const peopleSnap = await adminDb
      .collection('persons')
      .where('createdBy', '==', userId)
      .get()
    const allPeople = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any)

    const activeGroups = groups.filter((g: any) => g.prayerDays?.includes(currentDayIndex))
    const selectedIds = new Set<string>()
    const settingsSnapshot: Record<string, { numPerDay: number | null }> = {}

    activeGroups.forEach((group: any) => {
      let groupPeople: any[]
      if (group.isSystemGroup && group.name === 'Everyone') {
        groupPeople = allPeople.filter((p: any) => !p.groupId)
      } else {
        groupPeople = allPeople.filter((p: any) => p.groupId === group.id)
      }
      if (groupPeople.length === 0) return

      const numPerDaySetting = group.prayerSettings?.numPerDay ?? null
      const actualNum = numPerDaySetting === null
        ? groupPeople.length
        : Math.min(numPerDaySetting, groupPeople.length)

      settingsSnapshot[group.id] = { numPerDay: actualNum }

      const sorted = sortByLastPrayedFor(groupPeople)
      sorted.slice(0, actualNum).forEach((p: any) => selectedIds.add(p.id))
    })

    personIds = Array.from(selectedIds)

    // Save the list so the client finds it when the user opens the app
    await dailyListRef.set({
      userId,
      date: dateKey,
      personIds,
      settingsSnapshot,
      createdAt: new Date(),
    })
  }

  if (personIds.length === 0) {
    return { people: [], dateLabel }
  }

  // 2. Fetch person names in batches (Firestore getAll supports up to 500)
  const personRefs = personIds.map(id => adminDb.doc(`persons/${id}`))
  const personSnaps = await adminDb.getAll(...personRefs)
  const personMap = new Map(personSnaps.map(s => [s.id, s.data()]))

  // 3. For each person, fetch their most recent active prayer request
  const people: PersonDigest[] = await Promise.all(
    personIds.map(async (personId) => {
      const personData = personMap.get(personId)
      const name = personData?.name ?? 'Unknown'

      let prayerRequest: string | undefined
      try {
        const requestsSnap = await adminDb
          .collection(`persons/${personId}/prayerRequests`)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()
        if (!requestsSnap.empty) {
          prayerRequest = requestsSnap.docs[0].data().content
        }
      } catch {
        // Subcollection may not exist yet — skip silently
      }

      return { name, prayerRequest }
    })
  )

  return { people, dateLabel }
}

/**
 * Generates a simple HMAC-SHA256 token for unsubscribe links.
 * Uses CRON_SECRET as the key so it can be verified server-side.
 */
export function generateUnsubscribeToken(userId: string): string {
  const { createHmac } = require('crypto')
  return createHmac('sha256', process.env.CRON_SECRET ?? 'fallback')
    .update(userId)
    .digest('hex')
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return token === generateUnsubscribeToken(userId)
}
