'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Monitor, Film, ListVideo, CalendarClock, BarChart3, Users, ScrollText, Bell, Settings, Power,
} from 'lucide-react';
import { clearToken } from '@/lib/api';
import { disconnectSocket as dc } from '@/lib/socket';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/devices', label: 'Devices', icon: Monitor },
  { href: '/media', label: 'Media Library', icon: Film },
  { href: '/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    dc();
    router.replace('/login');
  }

  return (
    <aside className="glass relative z-20 flex h-screen w-64 flex-col border-r border-white/5 p-4">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple shadow-glow">
          <MonitorPlayIcon />
        </div>
        <div>
          <div className="text-sm font-bold text-white">LumiSign</div>
          <div className="text-[10px] uppercase tracking-widest text-neon-blue/70">Enterprise NOC</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-neon-blue/20 to-transparent text-white shadow-glow'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} className={active ? 'text-neon-cyan' : ''} />
              {item.label}
              {active && <span className="ml-auto h-2 w-2 rounded-full bg-neon-cyan animate-pulse-glow" />}
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className="btn btn-ghost mt-2 w-full justify-start text-red-300">
        <Power size={16} /> Disconnect
      </button>
    </aside>
  );
}

function MonitorPlayIcon() {
  return <span className="text-dark-900 font-black">L</span>;
}
