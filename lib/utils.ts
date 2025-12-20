import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { db } from "@/lib/firebaseConfig" // Import db instance
import { collection, query, where, getDocs, getDoc, doc, Timestamp, writeBatch, setDoc, addDoc, serverTimestamp, type Firestore } from 'firebase/firestore' // Import Firestore types/functions
import type { Group } from '@/lib/types' // Import Group type

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date for display (e.g., "Mar 31")
export const formatDate = (date: Date | undefined): string => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// You might want to keep formatDateWithTime in the page component
// if it's only used there, or move it here too if needed elsewhere.

/**
 * Calculates the daily prayer list for a user and date, updates group nextIndex,
 * saves the list to Firestore, and returns the set of person IDs.
 *
 * CRITICAL FIX: Now checks if list already exists and validates settings before recalculating.
 * This prevents the rotation bug where nextIndex gets updated on every page refresh.
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
            const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId));
            const groupsSnapshot = await getDocs(groupsQuery);
            const fetchedGroups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));

            // Build current settings snapshot
            const currentSettingsSnapshot: Record<string, { numPerDay: number | null }> = {};
            const activeGroups = fetchedGroups.filter(group => group.prayerDays?.includes(currentDayIndex));

            activeGroups.forEach(group => {
                const groupPersonIds = group.personIds ?? [];
                if (groupPersonIds.length > 0) {
                    const settings = group.prayerSettings;
                    const numPerDaySetting = settings?.numPerDay ?? null;
                    const totalPeople = groupPersonIds.length;
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
        const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId));
        const groupsSnapshot = await getDocs(groupsQuery);
        const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        console.log(`[Calculation Function] Fetched ${fetchedGroups.length} groups.`);

        const personIdsToPrayFor = new Set<string>();
        const batch = writeBatch(db);
        const settingsSnapshot: Record<string, { numPerDay: number | null }> = {};

        // 2. Filter for active groups
        const activeGroups = fetchedGroups.filter(group =>
            group.prayerDays?.includes(currentDayIndex)
        );
        console.log(`[Calculation Function] Found ${activeGroups.length} active groups for day index ${currentDayIndex}.`);

        // 3. Calculate assignments and stage nextIndex updates
        activeGroups.forEach(group => {
            const groupPersonIds = group.personIds ?? [];
            if (groupPersonIds.length === 0) {
                console.log(`[Calculation Function] Skipping group ${group.id} (${group.name}) - no members.`);
                return;
            }
            const settings = group.prayerSettings;
            const numPerDaySetting = settings?.numPerDay ?? null;
            const currentStartIndex = settings?.nextIndex ?? 0;
            const totalPeople = groupPersonIds.length;
            const actualNumToAssign = numPerDaySetting === null ? totalPeople : Math.min(numPerDaySetting, totalPeople);

            // NEW: Record the setting for this group in the snapshot
            settingsSnapshot[group.id] = { numPerDay: actualNumToAssign }; // Store the *actual* number assigned

            console.log(`[Calculation Function] Group: ${group.name} (ID: ${group.id}) - Settings: numPerDay=${numPerDaySetting ?? 'all'}(actual:${actualNumToAssign}), startIndex=${currentStartIndex}, total=${totalPeople}`);

            let assignedCount = 0;
            let newNextIndex = currentStartIndex;
            for (let i = 0; i < actualNumToAssign; i++) {
                const personIndex = (currentStartIndex + i) % totalPeople;
                const personId = groupPersonIds[personIndex];
                personIdsToPrayFor.add(personId);
                assignedCount++;
            }
            newNextIndex = (currentStartIndex + assignedCount) % totalPeople;

            // Stage update for nextIndex if it changed or wasn't set
            if (!settings || settings.nextIndex !== newNextIndex) {
                const groupRef = doc(db, "groups", group.id);
                batch.update(groupRef, {
                    "prayerSettings.nextIndex": newNextIndex,
                    "prayerSettings.strategy": settings?.strategy ?? "sequential",
                    "prayerSettings.numPerDay": numPerDaySetting === undefined ? null : numPerDaySetting
                });
                console.log(`[Calculation Function] Staging update for group ${group.id}: set prayerSettings.nextIndex to ${newNextIndex}`);
            }
        });

        console.log(`[Calculation Function] Final Person IDs determined:`, Array.from(personIdsToPrayFor));

        // 4. Commit nextIndex updates
        await batch.commit();
        console.log("[Calculation Function] Batch commit successful for nextIndex updates.");

        // 5. Save the calculated list AND settings snapshot to dailyPrayerLists
        await setDoc(dailyListRef, {
            userId: userId,
            date: dateKey,
            personIds: Array.from(personIdsToPrayFor),
            settingsSnapshot: settingsSnapshot, // NEW: Save the snapshot
            createdAt: serverTimestamp()
        });
        console.log(`[Calculation Function] Saved calculated list AND settings snapshot to Firestore path: ${dailyListRef.path}`);

        return personIdsToPrayFor;

    } catch (error) {
        console.error("[Calculation Function] Error during calculation/saving:", error);
        // Re-throw the error so the caller can handle it
        throw error;
    }
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
            collection(db, "groups"),
            where("createdBy", "==", userId),
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
        await addDoc(collection(db, "groups"), {
            name: "Everyone",
            createdBy: userId,
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

/**
 * Calculates the user's current prayer streak.
 * A streak is the number of consecutive days (from today backward) where at least one person was prayed for.
 * Returns 0 if no streak exists or on error.
 */
export async function calculateStreak(
    db: Firestore,
    userId: string
): Promise<number> {
    try {
        console.log(`[calculateStreak] Calculating streak for user ${userId}...`);

        const listsRef = collection(db, "users", userId, "dailyPrayerLists");
        const listsQuery = query(listsRef); // Get all daily lists
        const listsSnapshot = await getDocs(listsQuery);

        if (listsSnapshot.empty) {
            console.log(`[calculateStreak] No daily prayer lists found. Streak = 0.`);
            return 0;
        }

        // Build a map of dates to whether they had completions
        const dateMap = new Map<string, boolean>();

        listsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const dateKey = data.date; // Format: "YYYY-MM-DD"
            const personIds = data.personIds || [];
            // We need to check if any of these people were actually prayed for
            // For now, we'll just check if the list exists (simplification)
            // In future, could query persons to check lastPrayedFor timestamps
            dateMap.set(dateKey, personIds.length > 0);
        });

        // Count consecutive days backward from today
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) { // Max 365 days backward
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateKey = checkDate.toISOString().split('T')[0];

            if (dateMap.has(dateKey) && dateMap.get(dateKey)) {
                streak++;
            } else {
                // Streak broken
                break;
            }
        }

        console.log(`[calculateStreak] Calculated streak: ${streak} days.`);
        return streak;

    } catch (error) {
        console.error(`[calculateStreak] Error calculating streak:`, error);
        return 0; // Return 0 on error
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
