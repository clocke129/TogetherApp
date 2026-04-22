import { Timestamp } from "firebase/firestore";

export interface Person {
  id: string; // Firestore document ID
  name: string;
  groupId?: string; // Optional: ID of the group the person belongs to
  createdAt?: Timestamp; // Added creation timestamp
  lastPrayedFor?: Timestamp; // Optional: For sorting by least recent
}

export interface Group {
  id: string; // Firestore document ID
  name: string;
  personIds: string[]; // Array of Person document IDs in this group
  prayerDays: number[]; // 0-6 representing Sun-Sat
  prayerSettings?: {
    strategy: "sequential"; // DEPRECATED: Algorithm changed to lastPrayedFor sorting
    numPerDay: number | null; // How many people to pray for each time (null means 'all')
    nextIndex: number; // DEPRECATED: No longer used, kept for backward compatibility
  };
  createdAt?: Timestamp; // Added creation timestamp
  order?: number; // Optional: For manual ordering/drag-and-drop
  isSystemGroup?: boolean; // True for system groups like "Everyone" that cannot be deleted
}

// Firestore Timestamp type for convenience if needed elsewhere
export { Timestamp };

export interface EmailPreferences {
  enabled: boolean
  sendTime: string              // "07:00" 24h format
  timezone: string              // IANA timezone, e.g. "America/New_York"
  frequency: "daily" | "weekdays" | "weekly"
  weeklyDay?: number            // 0–6 (Sun–Sat), only for "weekly"
  lastSentDate?: string         // "YYYY-MM-DD" — prevents duplicate sends
}

// Prayer Request Type (Subcollection of Person)
export interface PrayerRequest {
  id: string; // Firestore document ID
  // personId: string; // Not needed if fetched via subcollection path
  content: string;
  createdAt: Timestamp; // Firestore server timestamp
  updatedAt?: Timestamp; // Firestore server timestamp (optional)
  prayedForDates?: Timestamp[]; // Array of Firestore server timestamps (optional)
}

// Follow-up Type (Subcollection of Person)
export interface FollowUp {
  id: string; // Firestore document ID
  personId: string; // ID of the person this follow-up belongs to
  content: string;
  dueDate?: Timestamp; // Optional due date
  completed: boolean; // Status of the follow-up
  createdAt?: Timestamp; // Firestore server timestamp (optional)
  completedAt?: Timestamp; // Firestore server timestamp (optional)
  archived?: boolean; // Added flag for soft delete/archiving
  recurring?: boolean; // If true, resets annually on completion instead of marking done
  recurrenceType?: "annual"; // Only "annual" supported for now
}
