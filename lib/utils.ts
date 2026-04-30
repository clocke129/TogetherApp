import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { db } from "@/lib/firebaseConfig" // Import db instance
import { collection, query, where, getDocs, getDoc, doc, Timestamp, setDoc, addDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore' // Import Firestore types/functions
import type { Group, Person } from '@/lib/types' // Import Group and Person types

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date for display (e.g., "Mar 31")
export const formatDate = (date: Date | undefined): string => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Check if a Firestore Timestamp is on the same day as a JS Date
export const isSameDay = (timestamp: Timestamp | undefined, date: Date): boolean => {
  if (!timestamp) return false;
  const tsDate = timestamp.toDate();
  return (
    tsDate.getFullYear() === date.getFullYear() &&
    tsDate.getMonth() === date.getMonth() &&
    tsDate.getDate() === date.getDate()
  );
};

// You might want to keep formatDateWithTime in the page component
// if it's only used there, or move it here too if needed elsewhere.

/**
 * Sorts people by lastPrayedFor timestamp (oldest first).
 * People who have never been prayed for (null/undefined) are prioritized.
 * Tie-breaking uses personId for stable, deterministic ordering.
 * Note: lastPrayedFor is no longer written by the app, but this function
 * is still used by calculateAndSaveDailyPrayerList to pick today's people.
 */
function sortByLastPrayedFor(people: Person[]): Person[] {
  return people.slice().sort((a, b) => {
    const timeA = a.lastPrayedFor?.toMillis() ?? 0
    const timeB = b.lastPrayedFor?.toMillis() ?? 0
    if (timeA !== timeB) return timeA - timeB
    return a.id.localeCompare(b.id)
  })
}

/**
 * Calculates the daily prayer list for a user and date using "last prayed for" algorithm.
 * Selects people who haven't been prayed for in the longest time.
 * Saves the list to Firestore with settings snapshot validation.
 *
 * CRITICAL: Now checks if list already exists and validates settings before recalculating.
 * This prevents unnecessary recalculation on every page refresh.
 */
export async function calculateAndSaveDailyPrayerList(
    db: Firestore, // Pass Firestore instance
    userId: string,
    targetDate: Date
): Promise<Set<string>> {

    const currentDayIndex = targetDate.getDay();
    const dateKey = targetDate.toISOString().split('T')[0];
    const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey); // Declare once, reuse throughout
    console.log(`[Calculation Function] Starting for User: ${userId}, Date: ${dateKey}, DayIndex: ${currentDayIndex}`);

    try {
        // CRITICAL FIX: Check if daily list already exists in Firestore
        const existingListSnap = await getDoc(dailyListRef);

        if (existingListSnap.exists()) {
            console.log(`[Calculation Function] Found existing list for ${dateKey}. Validating settings...`);

            const existingData = existingListSnap.data();
            const storedPersonIds = new Set<string>(existingData.personIds || []);
            const storedSettingsSnapshot = existingData.settingsSnapshot || {};

            // Fetch current groups to validate settings
            const groupsQuery = query(collection(db, "users", userId, "groups"));
            const groupsSnapshot = await getDocs(groupsQuery);
            const fetchedGroups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));

            // Build current settings snapshot
            const currentSettingsSnapshot: Record<string, { numPerDay: number | null }> = {};
            const activeGroups = fetchedGroups.filter(group => group.prayerDays?.includes(currentDayIndex));

            // Fetch all people to handle Everyone group correctly
            const peopleQuery = query(collection(db, "users", userId, "persons"));
            const peopleSnapshot = await getDocs(peopleQuery);
            const allPeople = peopleSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Person));

            activeGroups.forEach(group => {
                let totalPeople: number;

                // Handle Everyone group specially (has empty personIds array)
                if (group.isSystemGroup && group.name === "Everyone") {
                    totalPeople = allPeople.filter(p => !p.groupId).length;
                } else {
                    const groupPersonIds = group.personIds ?? [];
                    totalPeople = groupPersonIds.length;
                }

                if (totalPeople > 0) {
                    const settings = group.prayerSettings;
                    const numPerDaySetting = settings?.numPerDay ?? null;
                    const actualNumToAssign = numPerDaySetting === null ? totalPeople : Math.min(numPerDaySetting, totalPeople);
                    currentSettingsSnapshot[group.id] = { numPerDay: actualNumToAssign };
                }
            });

            // Compare snapshots
            const storedSnapshotString = JSON.stringify(storedSettingsSnapshot, Object.keys(storedSettingsSnapshot).sort());
            const currentSnapshotString = JSON.stringify(currentSettingsSnapshot, Object.keys(currentSettingsSnapshot).sort());

            if (storedSnapshotString === currentSnapshotString) {
                console.log(`[Calculation Function] Settings unchanged. Returning cached list (${storedPersonIds.size} people).`);
                return storedPersonIds; // Return cached list WITHOUT recalculating
            } else {
                console.log(`[Calculation Function] Settings changed. Recalculating...`);
                console.log(`[Calculation Function] Stored: ${storedSnapshotString}`);
                console.log(`[Calculation Function] Current: ${currentSnapshotString}`);
            }
        } else {
            console.log(`[Calculation Function] No existing list found. Proceeding with calculation...`);
        }

        // If we reach here, we need to calculate (either no list exists or settings changed)
        console.log(`[Calculation Function] Fetching groups for calculation...`);
        const groupsQuery = query(collection(db, "users", userId, "groups"));
        const groupsSnapshot = await getDocs(groupsQuery);
        const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        console.log(`[Calculation Function] Fetched ${fetchedGroups.length} groups.`);

        // Fetch all people for this user (needed for lastPrayedFor sorting)
        console.log(`[Calculation Function] Fetching people for calculation...`);
        const peopleQuery = query(collection(db, "users", userId, "persons"));
        const peopleSnapshot = await getDocs(peopleQuery);
        const allPeople = peopleSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Person));
        console.log(`[Calculation Function] Fetched ${allPeople.length} people.`);

        const personIdsToPrayFor = new Set<string>();
        const settingsSnapshot: Record<string, { numPerDay: number | null }> = {};

        // 2. Filter for active groups
        const activeGroups = fetchedGroups.filter(group =>
            group.prayerDays?.includes(currentDayIndex)
        );
        console.log(`[Calculation Function] Found ${activeGroups.length} active groups for day index ${currentDayIndex}.`);

        // 3. Calculate assignments using lastPrayedFor algorithm
        activeGroups.forEach(group => {
            // Get people in group (handles Everyone group dynamically)
            let groupPeople: Person[]
            if (group.isSystemGroup && group.name === "Everyone") {
                groupPeople = allPeople.filter(p => !p.groupId)
                console.log(`[Calculation Function] Everyone group: ${groupPeople.length} people without groupId`)
            } else {
                groupPeople = allPeople.filter(p => p.groupId === group.id)
            }

            if (groupPeople.length === 0) {
                console.log(`[Calculation Function] Skipping group ${group.id} (${group.name}) - no members.`);
                return;
            }

            const settings = group.prayerSettings;
            const numPerDaySetting = settings?.numPerDay ?? null;
            const actualNumToAssign = numPerDaySetting === null
                ? groupPeople.length
                : Math.min(numPerDaySetting, groupPeople.length);

            // Record the setting for this group in the snapshot
            settingsSnapshot[group.id] = { numPerDay: actualNumToAssign };

            console.log(`[Calculation Function] Group: ${group.name} (ID: ${group.id}) - Settings: numPerDay=${numPerDaySetting ?? 'all'}(actual:${actualNumToAssign}), total=${groupPeople.length}`);

            // NEW ALGORITHM: Sort by lastPrayedFor and select top N
            const sortedPeople = sortByLastPrayedFor(groupPeople);
            const selectedPeople = sortedPeople.slice(0, actualNumToAssign);
            selectedPeople.forEach(p => {
                personIdsToPrayFor.add(p.id);
                const lastPrayed = p.lastPrayedFor ? new Date(p.lastPrayedFor.toMillis()).toLocaleDateString() : 'never';
                console.log(`[Calculation Function]   Selected: ${p.name} (last prayed: ${lastPrayed})`);
            });
        });

        console.log(`[Calculation Function] Final Person IDs determined:`, Array.from(personIdsToPrayFor));

        // 5. Save the calculated list AND settings snapshot to dailyPrayerLists,
        //    and mark each selected person as prayed for today so the rotation advances.
        const batch = writeBatch(db);

        batch.set(dailyListRef, {
            userId: userId,
            date: dateKey,
            personIds: Array.from(personIdsToPrayFor),
            settingsSnapshot: settingsSnapshot,
            createdAt: serverTimestamp()
        });

        const prayedAt = Timestamp.fromDate(targetDate);
        personIdsToPrayFor.forEach(personId => {
            batch.update(doc(db, "users", userId, "persons", personId), { lastPrayedFor: prayedAt });
        });

        await batch.commit();
        console.log(`[Calculation Function] Saved list and updated lastPrayedFor for ${personIdsToPrayFor.size} people.`);

        return personIdsToPrayFor;

    } catch (error) {
        console.error("[Calculation Function] Error during calculation/saving:", error);
        // Re-throw the error so the caller can handle it
        throw error;
    }
}

/**
 * Calculates a preview of the daily prayer list for a future date WITHOUT writing to Firestore.
 * Used for date navigation — does not affect lastPrayedFor or the rotation.
 */
export async function previewDailyPrayerList(
    db: Firestore,
    userId: string,
    targetDate: Date
): Promise<Set<string>> {
    const currentDayIndex = targetDate.getDay();

    const [groupsSnapshot, peopleSnapshot] = await Promise.all([
        getDocs(query(collection(db, "users", userId, "groups"))),
        getDocs(query(collection(db, "users", userId, "persons")))
    ]);

    const fetchedGroups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
    const allPeople = peopleSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Person));

    const personIdsToPrayFor = new Set<string>();
    const activeGroups = fetchedGroups.filter(g => g.prayerDays?.includes(currentDayIndex));

    activeGroups.forEach(group => {
        let groupPeople: Person[];
        if (group.isSystemGroup && group.name === "Everyone") {
            groupPeople = allPeople.filter(p => !p.groupId);
        } else {
            groupPeople = allPeople.filter(p => p.groupId === group.id);
        }
        if (groupPeople.length === 0) return;

        const numPerDaySetting = group.prayerSettings?.numPerDay ?? null;
        const actualNum = numPerDaySetting === null
            ? groupPeople.length
            : Math.min(numPerDaySetting, groupPeople.length);

        const sorted = sortByLastPrayedFor(groupPeople);
        sorted.slice(0, actualNum).forEach(p => personIdsToPrayFor.add(p.id));
    });

    return personIdsToPrayFor;
}

/**
 * Pure function — computes who would be prayed for on a given date
 * given a snapshot of people (with their current lastPrayedFor values).
 * No Firestore reads or writes.
 */
export function computeDayPreview(groups: Group[], people: Person[], date: Date): Set<string> {
    const dayIndex = date.getDay()
    const activeGroups = groups.filter(g => g.prayerDays?.includes(dayIndex))
    const result = new Set<string>()

    activeGroups.forEach(group => {
        let groupPeople: Person[]
        if (group.isSystemGroup && group.name === "Everyone") {
            groupPeople = people.filter(p => !p.groupId)
        } else {
            groupPeople = people.filter(p => p.groupId === group.id)
        }
        if (groupPeople.length === 0) return

        const numPerDaySetting = group.prayerSettings?.numPerDay ?? null
        const actualNum = numPerDaySetting === null
            ? groupPeople.length
            : Math.min(numPerDaySetting, groupPeople.length)

        sortByLastPrayedFor(groupPeople).slice(0, actualNum).forEach(p => result.add(p.id))
    })

    return result
}

/**
 * Simulates prayer list rotation from tomorrow through a future target date.
 * Returns the predicted Set of person IDs for the target date.
 * Pure function — no Firestore access.
 */
export function simulateFutureDays(
    groups: Group[],
    people: Person[],
    targetDateKey: string  // 'YYYY-MM-DD' in local time
): Set<string> {
    const [y, m, d] = targetDateKey.split('-').map(Number)
    const target = new Date(y, m - 1, d)  // local midnight — avoids UTC parsing bug

    const cursor = new Date()
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)  // tomorrow, local midnight

    let simulatedPeople = [...people]

    // Simulate all intervening days, updating lastPrayedFor as we go
    while (cursor < target) {
        const ids = computeDayPreview(groups, simulatedPeople, cursor)
        const prayedAt = Timestamp.fromDate(new Date(cursor))  // snapshot cursor value before advancing
        simulatedPeople = simulatedPeople.map(p =>
            ids.has(p.id) ? { ...p, lastPrayedFor: prayedAt } : p
        )
        cursor.setDate(cursor.getDate() + 1)
    }

    // Compute the target date with the fully simulated state
    return computeDayPreview(groups, simulatedPeople, target)
}

/**
 * Ensures the "Everyone" system group exists for the user.
 * Creates it with default settings if it doesn't exist.
 * This group is special - it shows all uncategorized people (groupId === null).
 */
export async function ensureEveryoneGroup(
    db: Firestore,
    userId: string
): Promise<void> {
    try {
        console.log(`[ensureEveryoneGroup] Checking for Everyone group for user ${userId}...`);

        // Query for existing Everyone group for this user (check by name to be specific)
        const groupsQuery = query(
            collection(db, "users", userId, "groups"),
            where("name", "==", "Everyone")
        );
        const groupsSnapshot = await getDocs(groupsQuery);

        if (!groupsSnapshot.empty) {
            console.log(`[ensureEveryoneGroup] Everyone group already exists for user ${userId}. Found ${groupsSnapshot.size} matching groups.`);
            // If there are somehow duplicates, log a warning
            if (groupsSnapshot.size > 1) {
                console.warn(`[ensureEveryoneGroup] WARNING: Found ${groupsSnapshot.size} "Everyone" groups for user ${userId}. There should only be one!`);
            }
            return;
        }

        console.log(`[ensureEveryoneGroup] Creating Everyone group for user ${userId}...`);

        // Create with auto-generated ID
        await addDoc(collection(db, "users", userId, "groups"), {
            name: "Everyone",
            personIds: [], // Always empty - computed dynamically from people with no groupId
            prayerDays: [0, 1, 2, 3, 4, 5, 6], // All days (editable by user)
            prayerSettings: {
                strategy: "sequential" as const,
                numPerDay: 3, // Default to 3 people per day (editable by user)
                nextIndex: 0 // Start rotation at index 0
            },
            createdAt: serverTimestamp(),
            order: -1, // Always display first in group lists
            isSystemGroup: true // Prevent deletion
        });

        console.log(`[ensureEveryoneGroup] Everyone group created successfully.`);
    } catch (error) {
        console.error(`[ensureEveryoneGroup] Error ensuring Everyone group:`, error);
        throw error; // Re-throw so caller can handle
    }
}


// Helper function to stringify Map with Sets for session storage
export function stringifyMapWithSets(map: Map<string, Set<string>>): string {
  return JSON.stringify(Array.from(map.entries()).map(([key, value]) => [key, Array.from(value)]));
}

// Helper function to parse Map with Sets from session storage
export function parseMapWithSets(jsonString: string | null): Map<string, Set<string>> {
  if (!jsonString) return new Map();
  try {
    const parsedArray = JSON.parse(jsonString);
    // Ensure the parsed structure is correct before creating the map
    if (!Array.isArray(parsedArray)) return new Map();
    return new Map(parsedArray.map(([key, valueArray]: [string, string[]]) => [key, new Set(valueArray)]));
  } catch (e) {
    console.error("Error parsing cached data from sessionStorage:", e);
    return new Map(); // Return empty map on error
  }
}
