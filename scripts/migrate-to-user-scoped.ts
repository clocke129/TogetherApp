/**
 * One-time migration script: copies persons and groups from top-level
 * collections to users/{uid}/persons and users/{uid}/groups.
 *
 * Safe to re-run — uses set() so existing docs are just overwritten.
 * Does NOT delete old data. Delete manually after verifying.
 *
 * Run: npx tsx scripts/migrate-to-user-scoped.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set in .env.local')
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  return initializeApp({ credential: cert(serviceAccount) })
}

const db = getFirestore(getAdminApp())

// Commit a batch and return a fresh one
async function flushBatch(batch: FirebaseFirestore.WriteBatch, count: number): Promise<{ batch: FirebaseFirestore.WriteBatch, count: number }> {
  if (count > 0) {
    await batch.commit()
    console.log(`  ↳ committed batch of ${count} ops`)
  }
  return { batch: db.batch(), count: 0 }
}

async function copySubcollection(
  fromParent: FirebaseFirestore.DocumentReference,
  toParent: FirebaseFirestore.DocumentReference,
  subcollectionName: string,
  batchState: { batch: FirebaseFirestore.WriteBatch, count: number }
): Promise<{ batch: FirebaseFirestore.WriteBatch, count: number }> {
  const snap = await fromParent.collection(subcollectionName).get()
  if (snap.empty) return batchState

  let { batch, count } = batchState
  for (const docSnap of snap.docs) {
    const toRef = toParent.collection(subcollectionName).doc(docSnap.id)
    batch.set(toRef, docSnap.data())
    count++
    if (count >= 400) {
      ;({ batch, count } = await flushBatch(batch, count))
    }
  }
  return { batch, count }
}

async function main() {
  console.log('=== Starting Firestore migration ===\n')

  let totalPersons = 0
  let totalGroups = 0
  let totalFollowUps = 0
  let totalPrayerRequests = 0

  let batchState = { batch: db.batch(), count: 0 }

  // ── Migrate persons ──────────────────────────────────────────────
  console.log('Fetching all persons...')
  const personsSnap = await db.collection('persons').get()
  console.log(`Found ${personsSnap.size} persons\n`)

  for (const personDoc of personsSnap.docs) {
    const data = personDoc.data()
    const uid = data.createdBy as string | undefined
    if (!uid) {
      console.warn(`  SKIP person ${personDoc.id} — no createdBy field`)
      continue
    }

    const fromRef = db.collection('persons').doc(personDoc.id)
    const toRef = db.collection('users').doc(uid).collection('persons').doc(personDoc.id)

    batchState.batch.set(toRef, data)
    batchState.count++
    totalPersons++

    if (batchState.count >= 400) {
      batchState = await flushBatch(batchState.batch, batchState.count)
    }

    // Copy followUps subcollection
    const before = batchState
    batchState = await copySubcollection(fromRef, toRef, 'followUps', batchState)
    const fuAdded = batchState.count - before.count + (batchState.count < before.count ? 400 : 0)
    totalFollowUps += fuAdded

    // Copy prayerRequests subcollection
    batchState = await copySubcollection(fromRef, toRef, 'prayerRequests', batchState)
  }

  // ── Migrate groups ───────────────────────────────────────────────
  console.log('\nFetching all groups...')
  const groupsSnap = await db.collection('groups').get()
  console.log(`Found ${groupsSnap.size} groups\n`)

  for (const groupDoc of groupsSnap.docs) {
    const data = groupDoc.data()
    const uid = data.createdBy as string | undefined
    if (!uid) {
      console.warn(`  SKIP group ${groupDoc.id} — no createdBy field`)
      continue
    }

    const toRef = db.collection('users').doc(uid).collection('groups').doc(groupDoc.id)
    batchState.batch.set(toRef, data)
    batchState.count++
    totalGroups++

    if (batchState.count >= 400) {
      batchState = await flushBatch(batchState.batch, batchState.count)
    }
  }

  // Final flush
  batchState = await flushBatch(batchState.batch, batchState.count)

  console.log('\n=== Migration complete ===')
  console.log(`  persons migrated:        ${totalPersons}`)
  console.log(`  groups migrated:         ${totalGroups}`)
  console.log(`  followUps copied:        ${totalFollowUps}`)
  console.log(`  prayerRequests copied:   ~see above`)
  console.log('\nVerify in Firebase console, then delete old top-level collections manually.')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
