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
  prayerSettings: {
    type: "all" | "random" | "recent"; // Prayer selection method
    count?: number; // Optional: Number of people for 'random'
  };
  createdAt?: Timestamp; // Added creation timestamp
}

// Firestore Timestamp type for convenience if needed elsewhere
export { Timestamp };
