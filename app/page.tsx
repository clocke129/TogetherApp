'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace('/prayer');
    }
  }, [loading, router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <p>Loading...</p>
    </div>
  );
}

