'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Redirect authenticated users away from login page
    if (!authLoading && user) {
      console.log("User already logged in, redirecting from /login");
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    // Check if auth is initialized
    if (!auth) {
        setError("Authentication service is not available. Please try again later.");
        console.error("Login attempt failed: Firebase Auth not initialized.")
        setLoading(false);
        return;
    }

    console.log("Attempting login for:", email);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful, determining redirect...");

      const currentUser = auth.currentUser;
      if (currentUser && currentUser.metadata.creationTime && currentUser.metadata.lastSignInTime) {
        const creationTime = new Date(currentUser.metadata.creationTime).getTime();
        const lastSignInTime = new Date(currentUser.metadata.lastSignInTime).getTime();

        // Check if the difference is less than 5 seconds (5000 milliseconds)
        if (Math.abs(lastSignInTime - creationTime) < 5000) {
          console.log("New user detected, redirecting to home (instructions)...");
          router.push('/');
        } else {
          console.log("Existing user detected, redirecting to prayer page...");
          router.push('/prayer');
        }
      } else {
         // Fallback if metadata is somehow unavailable
         console.log("User metadata not available, redirecting to prayer page (fallback)...");
         router.push('/prayer');
      }

    } catch (err: any) {
      console.error("Firebase Login Error:", err.code, err.message);
      // Simplified error message for security
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking auth status
  if (authLoading || user) { // Also check for user to prevent flash before redirect
     return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            {/* Email Input */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            {/* Password Input */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            {/* Error Display */}
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing In...' : 'Sign In'}</Button>
            {/* Link to Signup */}
            <div className="text-sm w-full text-center">Don't have an account? <Link href="/signup" className="underline">Sign up</Link></div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 