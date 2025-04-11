import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { db } from "@/lib/firebaseConfig" // Import db instance
import { collection, query, where, getDocs, doc, Timestamp, writeBatch, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore' // Import Firestore types/functions
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
 */
export async function calculateAndSaveDailyPrayerList(
    db: Firestore, // Pass Firestore instance
    userId: string,
    targetDate: Date
): Promise<Set<string>> {

    const currentDayIndex = targetDate.getDay();
    const dateKey = targetDate.toISOString().split('T')[0];
    console.log(`[Calculation Function] Calculating for User: ${userId}, Date: ${dateKey}, DayIndex: ${currentDayIndex}`);

    const personIdsToPrayFor = new Set<string>();
    const batch = writeBatch(db);

    try {
        // 1. Fetch all groups for the user
        const groupsQuery = query(collection(db, "groups"), where("createdBy", "==", userId));
        const groupsSnapshot = await getDocs(groupsQuery);
        const fetchedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        console.log(`[Calculation Function] Fetched ${fetchedGroups.length} groups.`);

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

        // 5. Save the calculated list to dailyPrayerLists using the NEW path
        const dailyListRef = doc(db, "users", userId, "dailyPrayerLists", dateKey);
        await setDoc(dailyListRef, {
            userId: userId,
            date: dateKey,
            personIds: Array.from(personIdsToPrayFor),
            createdAt: serverTimestamp()
        });
        console.log(`[Calculation Function] Saved calculated list to Firestore path: ${dailyListRef.path}`);

        return personIdsToPrayFor;

    } catch (error) {
        console.error("[Calculation Function] Error during calculation/saving:", error);
        // Re-throw the error so the caller can handle it
        throw error;
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
