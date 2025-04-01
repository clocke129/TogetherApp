'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Redirect authenticated users away from signup page
    if (!authLoading && user) {
      console.log("User already logged in, redirecting from /signup");
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);

    // Check if auth is initialized
    if (!auth) {
        setError("Authentication service is not available. Please try again later.");
        console.error("Signup attempt failed: Firebase Auth not initialized.")
        setLoading(false);
        return;
    }

    console.log("Attempting signup for:", email);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("Signup successful, redirecting...");
      router.push('/');
    } catch (err: any) {
      console.error("Firebase Signup Error:", err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email address is already registered.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak (must be at least 6 characters).");
      } else {
        setError("Failed to create account. Please try again.");
      }
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
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Create your account below.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="grid gap-4">
            {/* Email Input */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            {/* Password Input */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            {/* Confirm Password Input */}
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} />
            </div>
            {/* Error Display */}
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating Account...' : 'Create Account'}</Button>
            {/* Link to Login */}
            <div className="text-sm w-full text-center">Already have an account? <Link href="/login" className="underline">Log in</Link></div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 