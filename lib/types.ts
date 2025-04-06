import { Timestamp } from "firebase/firestore";

export interface Person {
  id: string; // Firestore document ID
  name: string;
  createdBy: string; // Firebase Auth uid
  groupId?: string; // Optional: ID of the group the person belongs to
  createdAt?: Timestamp; // Added creation timestamp
  lastPrayedFor?: Timestamp; // Optional: For sorting by least recent
}

export interface Group {
  id: string; // Firestore document ID
  name: string;
  createdBy: string; // Firebase Auth uid
  personIds: string[]; // Array of Person document IDs in this group
  prayerDays: number[]; // 0-6 representing Sun-Sat
  prayerSettings?: {
    strategy: "sequential"; // Selection method (only sequential for now)
    numPerDay: number | null; // How many people to pray for each time (null means 'all')
    nextIndex: number; // Index to start selection from next time
  };
  createdAt?: Timestamp; // Added creation timestamp
}

// Firestore Timestamp type for convenience if needed elsewhere
export { Timestamp };

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
  content: string;
  dueDate?: Timestamp; // Optional due date
  completed: boolean; // Status of the follow-up
  createdAt?: Timestamp; // Firestore server timestamp (optional)
  completedAt?: Timestamp; // Firestore server timestamp (optional)
  archived?: boolean; // Added flag for soft delete/archiving
}
