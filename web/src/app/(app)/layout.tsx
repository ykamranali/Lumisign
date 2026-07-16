'use client';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:48px_48px] opacity-[0.25]" />
        <TopBar />
        <main className="relative z-10 p-6">{children}</main>
      </div>
    </div>
  );
}
