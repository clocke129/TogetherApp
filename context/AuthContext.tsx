'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebaseConfig'; // Import initialized auth and db
import { ensureEveryoneGroup } from '@/lib/utils'; // Import ensureEveryoneGroup function

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// Default context value matches the type
const defaultAuthContextValue: AuthContextType = { user: null, loading: true };

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensure auth is initialized before subscribing
    if (!auth) {
        console.error("Firebase Auth is not initialized, cannot subscribe to state changes.");
        setLoading(false); // Set loading to false as we can't determine state
        return;
    }

    console.log("Setting up Firebase Auth listener...");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      console.log('Auth state changed, user:', currentUser?.uid || 'null');

      // Ensure "Everyone" group exists when user logs in
      if (currentUser) {
        try {
          await ensureEveryoneGroup(db, currentUser.uid);
        } catch (error) {
          console.error('Failed to ensure Everyone group:', error);
          // Don't block login if this fails - user can still use the app
        }
      }
    }, (error) => {
      // Add error handling for the listener itself
      console.error("Error in onAuthStateChanged listener:", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
        console.log("Cleaning up Firebase Auth listener.");
        unsubscribe();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const value = {
    user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 