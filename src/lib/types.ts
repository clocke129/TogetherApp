import { Timestamp } from "firebase/firestore"; // Ensure Timestamp is imported

export type Group = {
  id: string;
  createdBy: string;
  name: string;
  personIds: string[];
  prayerDays: number[]; // 0-6 for Sunday-Saturday
  prayerSettings?: { // Made optional as it might not always exist initially
    type: "random" | "recent" | "all";
    numPerDay?: number | null; // Allow null for "All"
  };
  order?: number; // Add optional order field
  // Add other fields as necessary, e.g., createdAt
  createdAt?: any; // Example, adjust type as needed (e.g., Timestamp)
}; 

// Add FollowUp type definition
export type FollowUp = {
  id: string;         // Unique ID of the follow-up item
  personId: string;   // ID of the person this follow-up relates to
  content: string;      // The text content of the follow-up task
  dueDate?: Timestamp; // Optional due date (Firestore Timestamp)
  completed: boolean;   // Whether the follow-up is marked as complete
  archived: boolean;    // Whether the follow-up is archived (soft delete)
  createdAt?: Timestamp; // Optional creation timestamp (Firestore Timestamp)
  createdBy?: string;    // Optional ID of the user who created it
  completedAt?: Timestamp; // Optional completion timestamp (Firestore Timestamp)
}; 