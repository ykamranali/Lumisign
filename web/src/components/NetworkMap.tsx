'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Server, Monitor } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Device } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  downloading: '#f59e0b',
  playing: '#22f5ff',
  idle: '#64748b',
};

export default function NetworkMap() {
  const devices = Object.values(useStore((s) => s.devices));
  const [hover, setHover] = useState<Device | null>(null);

  const W = 600;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2;

  const placed = devices.slice(0, 40).map((d, i) => {
    const ring = Math.floor(i / 10);
    const radius = 90 + ring * 70;
    const angle = (i % 10) * (Math.PI * 2) / 10 + ring * 0.4;
    return {
      d,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return (
    <div className="glass neon-border relative overflow-hidden rounded-2xl p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Live Network Topology</h2>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />Online</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Offline</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neon-cyan" />Playing</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[340px] w-full">
        {/* rings */}
        {[90, 160, 230].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth={1} />
        ))}
        {/* links */}
        {placed.map((p) => (
          <line
            key={'l' + p.d.id}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={STATUS_COLOR[p.d.status] || '#64748b'}
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        ))}
        {/* server */}
        <g>
          <circle cx={cx} cy={cy} r={26} fill="rgba(168,85,247,0.2)" stroke="#a855f7" />
          <foreignObject x={cx - 12} y={cy - 12} width={24} height={24}>
            <div className="flex h-6 w-6 items-center justify-center text-neon-purple">
              <Server size={18} />
            </div>
          </foreignObject>
        </g>
        {/* devices */}
        {placed.map((p) => {
          const color = STATUS_COLOR[p.d.status] || '#64748b';
          const downloading = p.d.status === 'downloading';
          return (
            <g
              key={p.d.id}
              onMouseEnter={() => setHover(p.d)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              {(p.d.status === 'online' || downloading) && (
                <circle cx={p.x} cy={p.y} r={12} fill={color} opacity={0.25}>
                  <animate attributeName="r" values="10;16;10" dur={downloading ? '1s' : '2.5s'} repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={9} fill={color} stroke="#0a0c1b" strokeWidth={2} />
              <foreignObject x={p.x - 8} y={p.y - 8} width={16} height={16}>
                <div className="flex h-4 w-4 items-center justify-center" style={{ color: '#04121a' }}>
                  <Monitor size={10} />
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {hover && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-strong absolute bottom-4 left-4 right-4 rounded-xl p-3 text-xs"
        >
          <div className="font-semibold text-white">{hover.name}</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-slate-400">
            <span>IP: {hover.ip || '—'}</span>
            <span>CPU: {hover.cpu ?? '—'}%</span>
            <span>Status: {hover.status}</span>
            <span>Media: {hover.currentMedia || '—'}</span>
            <span>Vol: {hover.volume ?? '—'}</span>
            <span>Up: {hover.uptime ? Math.floor(hover.uptime / 3600) + 'h' : '—'}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
