'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { getToken } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useStore } from '@/store/useStore';
import { apiFetch } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getToken();
    if (!token && pathname !== '/login') {
      router.replace('/login');
      return;
    }
    if (!token) return;

    connectSocket();

    // Initial data hydration
    apiFetch('/api/devices')
      .then((r) => useStore.getState().setDevices(r.devices))
      .catch(() => {});
    apiFetch('/api/analytics/stats')
      .then((r) => useStore.getState().setStats(r.stats))
      .catch(() => {});
    apiFetch('/api/notifications')
      .then((r) => useStore.getState().setNotifications(r.notifications))
      .catch(() => {});
  }, [pathname, router]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
