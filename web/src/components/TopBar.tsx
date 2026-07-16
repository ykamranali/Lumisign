'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { Wifi, WifiOff } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

const TITLES: Record<string, string> = {
  '/dashboard': 'Network Operations Center',
  '/devices': 'Device Management',
  '/media': 'Media Library',
  '/playlists': 'Playlist Builder',
  '/schedules': 'Scheduling',
  '/analytics': 'Analytics & Reports',
  '/users': 'User Management',
  '/logs': 'System Logs',
  '/settings': 'Settings',
};

export default function TopBar() {
  const connected = useStore((s) => s.connected);
  const pathname = usePathname();
  const [time, setTime] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const title = TITLES[pathname] || 'LumiSign';

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-white/5 px-6 py-3">
      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-xs text-slate-500">{time || '—'} · Real-time</p>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            connected ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
          }`}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>
        <NotificationCenter />
      </div>
    </header>
  );
}
