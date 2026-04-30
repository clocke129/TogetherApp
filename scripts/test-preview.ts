/**
 * Test script for simulateFutureDays rotation logic.
 * Run with: npx tsx scripts/test-preview.ts
 *
 * Key design note: simulateFutureDays starts the chain at TOMORROW (not today).
 * This is intentional — by the time a user is previewing future dates, today's
 * prayer list has already been generated and lastPrayedFor is up-to-date in Firestore.
 * The simulation only needs to chain from tomorrow onward.
 */

import { computeDayPreview, simulateFutureDays } from '../lib/utils'
import type { Group, Person } from '../lib/types'
import { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgoTimestamp(daysAgo: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return Timestamp.fromDate(d)
}

function localDateKey(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayName(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function names(ids: Set<string>, nameMap: Record<string, string>): string {
  return [...ids].map(id => nameMap[id]).sort().join(', ')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.log(`  ✗ ${msg}`); process.exitCode = 1 }
function check(condition: boolean, msg: string) { condition ? pass(msg) : fail(msg) }

// ---------------------------------------------------------------------------
// Shared test data
// "Close Friends" group: 4 people, active every day, numPerDay = 2
// Sorted by lastPrayedFor (oldest first): Dave (never), Carol (5d), Bob (3d), Alice (1d)
// So today's list = Dave + Carol
// ---------------------------------------------------------------------------

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const group: Group = {
  id: 'g1',
  name: 'Close Friends',
  personIds: ['p1', 'p2', 'p3', 'p4'],
  prayerDays: ALL_DAYS,
  prayerSettings: { strategy: 'sequential', numPerDay: 2, nextIndex: 0 },
}

const people: Person[] = [
  { id: 'p1', name: 'Alice', groupId: 'g1', lastPrayedFor: daysAgoTimestamp(1) },
  { id: 'p2', name: 'Bob',   groupId: 'g1', lastPrayedFor: daysAgoTimestamp(3) },
  { id: 'p3', name: 'Carol', groupId: 'g1', lastPrayedFor: daysAgoTimestamp(5) },
  { id: 'p4', name: 'Dave',  groupId: 'g1', lastPrayedFor: undefined },
]

const nameMap: Record<string, string> = { p1: 'Alice', p2: 'Bob', p3: 'Carol', p4: 'Dave' }
const groups = [group]

// ---------------------------------------------------------------------------
// Test 1: computeDayPreview — today picks the two least-recently prayed for
// ---------------------------------------------------------------------------
console.log('\nTest 1: computeDayPreview selects least-recently prayed today')
{
  const ids = computeDayPreview(groups, people, new Date())
  check(ids.has('p4'), 'Dave (never prayed) is selected')
  check(ids.has('p3'), 'Carol (5 days ago) is selected')
  check(!ids.has('p2'), 'Bob (3 days ago) is NOT selected')
  check(!ids.has('p1'), 'Alice (1 day ago) is NOT selected')
  check(ids.size === 2, `Exactly 2 selected (got ${ids.size})`)
}

// ---------------------------------------------------------------------------
// Test 2: Tomorrow preview — loop doesn't run (cursor === target), so it
// computes directly from current Firestore state = same as today (Dave+Carol).
// This is correct: today's lastPrayedFor is already in Firestore, the
// simulation only needs to chain from tomorrow onward.
// ---------------------------------------------------------------------------
console.log(`\nTest 2: Tomorrow (${dayName(localDateKey(1))}) — no chain needed, reads current state`)
{
  const ids = simulateFutureDays(groups, people, localDateKey(1))
  check(ids.has('p4'), 'Dave selected tomorrow (loop doesn\'t run, same as today)')
  check(ids.has('p3'), 'Carol selected tomorrow')
  check(!ids.has('p2'), 'Bob NOT selected tomorrow')
  check(!ids.has('p1'), 'Alice NOT selected tomorrow')
  check(ids.size === 2, `Exactly 2 selected (got ${ids.size})`)
}

// ---------------------------------------------------------------------------
// Test 3: +2 days — simulates tomorrow (Dave+Carol rotate), then computes
// Bob+Alice as the next pair
// ---------------------------------------------------------------------------
console.log(`\nTest 3: +2 days (${dayName(localDateKey(2))}) — chains through tomorrow`)
{
  const ids = simulateFutureDays(groups, people, localDateKey(2))
  check(ids.has('p2'), 'Bob selected in 2 days (Dave+Carol rotated out)')
  check(ids.has('p1'), 'Alice selected in 2 days')
  check(!ids.has('p4'), 'Dave NOT selected in 2 days (just simulated)')
  check(!ids.has('p3'), 'Carol NOT selected in 2 days (just simulated)')
  check(ids.size === 2, `Exactly 2 selected (got ${ids.size})`)
}

// ---------------------------------------------------------------------------
// Test 4: +3 days — chains tomorrow + day after, wraps back to Dave+Carol
// ---------------------------------------------------------------------------
console.log(`\nTest 4: +3 days (${dayName(localDateKey(3))}) — full 2-day chain, wraps around`)
{
  const ids = simulateFutureDays(groups, people, localDateKey(3))
  check(ids.has('p4'), 'Dave selected again in 3 days (full rotation)')
  check(ids.has('p3'), 'Carol selected again in 3 days')
  check(!ids.has('p2'), 'Bob NOT selected in 3 days')
  check(!ids.has('p1'), 'Alice NOT selected in 3 days')
  check(ids.size === 2, `Exactly 2 selected (got ${ids.size})`)
}

// ---------------------------------------------------------------------------
// Test 5: Group not active on target day — returns empty set
// ---------------------------------------------------------------------------
console.log(`\nTest 5: Group not scheduled on target day returns empty`)
{
  const twoDaysOut = new Date()
  twoDaysOut.setDate(twoDaysOut.getDate() + 2)
  const twoDaysDayIndex = twoDaysOut.getDay()

  const limitedGroup: Group = {
    ...group,
    id: 'g2',
    // Active every day EXCEPT the target day (+2 days)
    prayerDays: ALL_DAYS.filter(d => d !== twoDaysDayIndex),
  }
  const ids = simulateFutureDays(
    [limitedGroup],
    people.map(p => ({ ...p, groupId: 'g2' })),
    localDateKey(2)
  )
  check(ids.size === 0, `Returns empty when group not active on ${dayName(localDateKey(2))}`)
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + (process.exitCode === 1 ? 'Some tests FAILED.' : 'All tests passed.') + '\n')
