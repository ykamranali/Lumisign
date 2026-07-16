'use client';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, Disc, Signal, Play } from 'lucide-react';
import { Device } from '@/lib/types';
import clsx from 'clsx';

const STATUS_STYLE: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  downloading: 'bg-amber-400 animate-pulse',
  playing: 'bg-neon-cyan',
  idle: 'bg-slate-500',
};

function Bar({ label, value, icon: Icon, color }: { label: string; value?: number; icon: any; color: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><Icon size={10} /> {label}</span>
        <span>{v.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export default function DeviceCard({ device, onClick }: { device: Device; onClick?: () => void }) {
  const online = device.online || device.status === 'online';
  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="glass relative cursor-pointer overflow-hidden rounded-2xl p-4 shadow-card"
    >
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <span className={clsx('h-2.5 w-2.5 rounded-full', STATUS_STYLE[device.status] || 'bg-slate-500')} />
        <span className="text-[10px] uppercase text-slate-400">{device.status}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 text-neon-cyan">
          <Signal size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{device.name}</div>
          <div className="truncate text-[11px] text-slate-500">{device.ip || device.deviceId}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Bar label="CPU" value={device.cpu} icon={Cpu} color="bg-neon-blue" />
        <Bar label="RAM" value={device.ram} icon={MemoryStick} color="bg-neon-purple" />
        <Bar label="Storage" value={device.storage} icon={Disc} color="bg-neon-cyan" />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Play size={11} className="text-neon-cyan" />
        <span className="truncate">{device.currentMedia || 'Idle'}</span>
      </div>
    </motion.div>
  );
}
