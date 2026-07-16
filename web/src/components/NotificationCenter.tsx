'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { apiFetch } from '@/lib/api';

const SEV_COLOR: Record<string, string> = {
  info: 'border-neon-blue/40 text-neon-blue',
  warning: 'border-yellow-400/40 text-yellow-300',
  critical: 'border-red-500/50 text-red-300',
  success: 'border-green-400/40 text-green-300',
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;

  async function markAll() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    useStore.setState((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:text-white"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            className="glass-strong absolute right-0 top-12 z-50 w-80 rounded-2xl p-3 shadow-card"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <button onClick={markAll} className="text-xs text-neon-blue hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">No notifications</div>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={`rounded-xl border bg-white/[0.02] p-3 ${SEV_COLOR[n.severity] || SEV_COLOR.info}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{n.title}</span>
                    {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neon-cyan" />}
                  </div>
                  {n.message && <p className="mt-1 text-xs text-slate-400">{n.message}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{n.type}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
