'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();

  const isAuthPage = pathname.startsWith('/auth/');
  const isLoggedIn = status === 'authenticated';

  // Auth pages: no sidebar, full screen
  if (isAuthPage || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 text-zinc-900 dark:text-slate-100">
        {children}
      </div>
    );
  }

  // Logged in: sidebar + main content
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 text-zinc-900 dark:text-slate-100 flex">
      <Sidebar />
      <div className="lg:ml-64 flex flex-1 flex-col">
        <main className="px-4 py-4 pt-16 lg:pt-6 sm:px-6 lg:px-8 flex-1 page-transition">
          {children}
        </main>
      </div>
    </div>
  );
}
