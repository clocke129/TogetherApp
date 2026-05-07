/**
 * Demo data seeding and cleanup for new user onboarding.
 * Seeds 3 demo people whose prayer requests double as onboarding tips.
 * Tagged with isDemo: true for easy detection and cleanup.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'


const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export async function hasDemoData(db: Firestore, userId: string): Promise<boolean> {
  const personsSnap = await getDocs(
    query(collection(db, 'users', userId, 'persons'), where('isDemo', '==', true))
  )
  return !personsSnap.empty
}

export async function isNewUser(db: Firestore, userId: string): Promise<boolean> {
  const [peopleSnap, groupsSnap] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'persons')),
    getDocs(collection(db, 'users', userId, 'groups')),
  ])
  // New user has no people and no real groups (only the Everyone system group at most)
  const realGroups = groupsSnap.docs.filter(d => !d.data().isSystemGroup && !d.data().isDemo)
  return peopleSnap.empty && realGroups.length === 0
}

export async function seedDemoData(db: Firestore, userId: string): Promise<void> {
  const batch = writeBatch(db)

  // Demo people are ungrouped (no groupId) so they appear in Everyone
  const sallyRef = doc(collection(db, 'users', userId, 'persons'))
  batch.set(sallyRef, {
    name: 'Serving Sally',
    isDemo: true,
    createdAt: serverTimestamp(),
  })

  const larryRef = doc(collection(db, 'users', userId, 'persons'))
  batch.set(larryRef, {
    name: 'Lonely Larry',
    isDemo: true,
    createdAt: serverTimestamp(),
  })

  const wendyRef = doc(collection(db, 'users', userId, 'persons'))
  batch.set(wendyRef, {
    name: 'Worried Wendy',
    isDemo: true,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  // Prayer requests and follow-up need separate batch (refs depend on above IDs)
  const batch2 = writeBatch(db)

  // Larry sorts first alphabetically — swipe tip
  batch2.set(doc(collection(db, 'users', userId, 'persons', larryRef.id, 'prayerRequests')), {
    content: 'Swipe left and right to move between people on your list →',
    createdAt: serverTimestamp(),
  })

  // Sally sorts second — follow-up tip
  batch2.set(doc(collection(db, 'users', userId, 'persons', sallyRef.id, 'prayerRequests')), {
    content: "Tap the Follow-Ups tab below — there's already a reminder set for Sally.",
    createdAt: serverTimestamp(),
  })

  // Follow-up on Sally due in 3 days
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 5) // outside 3-day "soon" window so it doesn't clutter Today
  batch2.set(doc(collection(db, 'users', userId, 'persons', sallyRef.id, 'followUps')), {
    personId: sallyRef.id,
    content: 'Check in on how Sally is doing',
    dueDate: Timestamp.fromDate(dueDate),
    completed: false,
    createdAt: serverTimestamp(),
  })

  // Wendy sorts third — quick capture tip
  batch2.set(doc(collection(db, 'users', userId, 'persons', wendyRef.id, 'prayerRequests')), {
    content: 'Tap the note button (bottom right) to quickly log a prayer request for anyone using @name.',
    createdAt: serverTimestamp(),
  })

  await batch2.commit()
}

export async function resetAccount(db: Firestore, userId: string): Promise<void> {
  // Delete all persons and their subcollections
  const allPeopleSnap = await getDocs(collection(db, 'users', userId, 'persons'))
  for (const personDoc of allPeopleSnap.docs) {
    const batch = writeBatch(db)
    const [requestsSnap, followUpsSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'persons', personDoc.id, 'prayerRequests')),
      getDocs(collection(db, 'users', userId, 'persons', personDoc.id, 'followUps')),
    ])
    requestsSnap.docs.forEach(d => batch.delete(d.ref))
    followUpsSnap.docs.forEach(d => batch.delete(d.ref))
    batch.delete(personDoc.ref)
    await batch.commit()
  }

  // Delete all groups (Everyone will be recreated on next load by AuthContext)
  const groupsSnap = await getDocs(collection(db, 'users', userId, 'groups'))
  if (!groupsSnap.empty) {
    const groupBatch = writeBatch(db)
    groupsSnap.docs.forEach(d => groupBatch.delete(d.ref))
    await groupBatch.commit()
  }

  // Delete all daily prayer lists
  const listsSnap = await getDocs(collection(db, 'users', userId, 'dailyPrayerLists'))
  if (!listsSnap.empty) {
    const listBatch = writeBatch(db)
    listsSnap.docs.forEach(d => listBatch.delete(d.ref))
    await listBatch.commit()
  }

  // Recreate the Everyone system group so it exists before the page reads data
  await addDoc(collection(db, 'users', userId, 'groups'), {
    name: 'Everyone',
    personIds: [],
    prayerDays: [0, 1, 2, 3, 4, 5, 6],
    prayerSettings: {
      strategy: 'sequential',
      numPerDay: 3,
      nextIndex: 0,
    },
    createdAt: serverTimestamp(),
    order: -1,
    isSystemGroup: true,
  })

  // Re-seed demo data
  await seedDemoData(db, userId)
}

export async function removeDemoData(db: Firestore, userId: string): Promise<void> {
  // Find demo people
  const peopleSnap = await getDocs(
    query(collection(db, 'users', userId, 'persons'), where('isDemo', '==', true))
  )

  // Delete subcollections and people
  for (const personDoc of peopleSnap.docs) {
    const batch = writeBatch(db)

    const [requestsSnap, followUpsSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'persons', personDoc.id, 'prayerRequests')),
      getDocs(collection(db, 'users', userId, 'persons', personDoc.id, 'followUps')),
    ])

    requestsSnap.docs.forEach(d => batch.delete(d.ref))
    followUpsSnap.docs.forEach(d => batch.delete(d.ref))
    batch.delete(personDoc.ref)

    await batch.commit()
  }

  // Delete today's dailyPrayerList so Today recalculates fresh
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const listBatch = writeBatch(db)
  listBatch.delete(doc(db, 'users', userId, 'dailyPrayerLists', dateKey))
  await listBatch.commit()
}
