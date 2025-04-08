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