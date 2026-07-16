'use client';
import { useEffect, useState } from 'react';
import { Monitor, Wifi, WifiOff, HardDrive, Activity, Cpu, MemoryStick, Users, Upload, ListVideo, ShieldCheck, Server, Radio } from 'lucide-react';
import StatCard from '@/components/StatCard';
import NetworkMap from '@/components/NetworkMap';
import DeviceCard from '@/components/DeviceCard';
import ControlDrawer from '@/components/ControlDrawer';
import { useStore } from '@/store/useStore';
import { apiFetch } from '@/lib/api';
import { DashboardStats } from '@/lib/types';

export default function DashboardPage() {
  const stats = useStore((s) => s.stats);
  const devices = Object.values(useStore((s) => s.devices));
  const notifications = useStore((s) => s.notifications);
  const [selected, setSelected] = useState<string | null>(null);
  const [localStats, setLocalStats] = useState<DashboardStats | null>(stats);

  useEffect(() => {
    const load = () => apiFetch('/api/analytics/stats').then((r) => setLocalStats(r.stats)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const s = localStats;
  const online = devices.filter((d) => d.online).length;

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total TVs" value={s?.totalTvs ?? devices.length} icon={Monitor} accent="blue" />
        <StatCard label="Online" value={online} icon={Wifi} accent="green" />
        <StatCard label="Offline" value={s?.offlineTvs ?? 0} icon={WifiOff} accent="pink" />
        <StatCard label="Playing" value={s?.playing ?? 0} icon={Radio} accent="cyan" />
        <StatCard label="CPU" value={s?.cpuUsage ?? 0} unit="%" icon={Cpu} accent="purple" />
        <StatCard label="RAM" value={s?.memoryUsage ?? 0} unit="%" icon={MemoryStick} accent="blue" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Storage" value={s ? Math.round(s.storageUsedBytes / 1e9) : 0} unit="GB" icon={HardDrive} accent="cyan" />
        <StatCard label="Bandwidth" value={s?.bandwidthUsageMbps ?? 0} unit="Mbps" icon={Activity} accent="blue" />
        <StatCard label="Server Health" value={s?.serverHealth ?? 0} unit="%" icon={Server} accent="green" />
        <StatCard label="Network" value={s?.networkHealth ?? 0} unit="%" icon={ShieldCheck} accent="purple" />
        <StatCard label="Active Users" value={s?.activeUsers ?? 0} icon={Users} accent="blue" />
        <StatCard label="Uploads" value={s?.todaysUploads ?? 0} icon={Upload} accent="cyan" />
        <StatCard label="Playlists" value={s?.todaysPlaylists ?? 0} icon={ListVideo} accent="purple" />
        <StatCard label="Alerts" value={s?.unreadNotifications ?? 0} icon={ShieldCheck} accent="pink" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NetworkMap />
        </div>
        <div className="glass neon-border rounded-2xl p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {notifications.length === 0 && <p className="text-sm text-slate-500">No recent activity</p>}
            {notifications.slice(0, 12).map((n) => (
              <div key={n.id} className="flex gap-2 rounded-lg bg-white/[0.02] p-2 text-xs">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neon-cyan" />
                <div>
                  <div className="font-semibold text-slate-200">{n.title}</div>
                  <div className="text-slate-500">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live device grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Live Devices ({devices.length})</h2>
          <span className="text-xs text-slate-500">{online} online</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} onClick={() => setSelected(d.id)} />
          ))}
          {devices.length === 0 && (
            <div className="col-span-full glass rounded-2xl p-8 text-center text-sm text-slate-500">
              No devices connected. Start the TV Player to see live devices here.
            </div>
          )}
        </div>
      </div>

      {selected && <ControlDrawer deviceId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
