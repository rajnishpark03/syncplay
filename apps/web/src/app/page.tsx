'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function RootPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/home');
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
    </div>
  );
}
