import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth'; // Import Auth as well

// Your web app's Firebase configuration read from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  // Check if all required config keys are present
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId
     // Add checks for other essential keys if needed (storageBucket, appId, etc.)
  ) {
    console.error("Firebase config keys missing in environment variables!");
    // Optionally throw an error or handle this case appropriately
  } else {
      console.log("Initializing Firebase App with config:", {
           apiKey: firebaseConfig.apiKey ? '***' : undefined, // Don't log the actual key
           authDomain: firebaseConfig.authDomain,
           projectId: firebaseConfig.projectId,
           // ...log other config keys safely if needed
       });
      app = initializeApp(firebaseConfig);
  }
} else {
  app = getApps()[0]; // Use the existing app if already initialized
  console.log("Using existing Firebase App instance.");
}

// Initialize Firestore and Auth
// Add checks to ensure 'app' is initialized before calling getFirestore/getAuth
const db: Firestore = app! ? getFirestore(app) : null!;
const auth: Auth = app! ? getAuth(app) : null!;

if (!db || !auth) {
    console.error("Failed to initialize Firestore or Auth - Firebase App not available.")
}

export { db, auth }; // Export Firestore and Auth 