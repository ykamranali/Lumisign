'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Play, Pause, Square, SkipForward, SkipBack, RotateCw, Power, PowerOff, Download,
  Volume2, Sun, RotateCcw, RefreshCw, Trash2, Camera, Clock, Wrench,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { Device } from '@/lib/types';

const COMMANDS: { type: string; label: string; icon: any; danger?: boolean }[] = [
  { type: 'play', label: 'Play', icon: Play },
  { type: 'pause', label: 'Pause', icon: Pause },
  { type: 'stop', label: 'Stop', icon: Square },
  { type: 'next', label: 'Next', icon: SkipForward },
  { type: 'previous', label: 'Previous', icon: SkipBack },
  { type: 'restart_playback', label: 'Restart Playback', icon: RotateCw },
  { type: 'take_screenshot', label: 'Screenshot', icon: Camera },
  { type: 'restart_player', label: 'Restart Player', icon: RefreshCw },
  { type: 'reboot', label: 'Reboot', icon: Power, danger: true },
  { type: 'shutdown', label: 'Shutdown', icon: PowerOff, danger: true },
  { type: 'clear_cache', label: 'Clear Cache', icon: Trash2 },
  { type: 'sync_time', label: 'Sync Time', icon: Clock },
];

export default function ControlDrawer({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const device = useStore((s) => s.devices[deviceId]);
  const [detail, setDetail] = useState<Device | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (deviceId) {
      apiFetch(`/api/devices/${deviceId}`).then((r) => setDetail(r.device)).catch(() => {});
    }
  }, [deviceId]);

  const live = device || detail;

  async function send(type: string) {
    setBusy(type);
    try {
      await apiFetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        body: JSON.stringify({ type, payload: {} }),
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy('');
    }
  }

  async function patch(field: string, value: number) {
    try {
      await apiFetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 p-5 shadow-card"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{live?.name}</h2>
            <p className="text-xs text-slate-500">{live?.deviceId}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost h-9 w-9 p-0">
            <X size={18} />
          </button>
        </div>

        {live && (
          <div className="mt-4 space-y-4 overflow-y-auto pr-1">
            {/* Telemetry */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Telemetry label="Status" value={live.status} />
              <Telemetry label="CPU" value={`${live.cpu ?? '—'}%`} />
              <Telemetry label="RAM" value={`${live.ram ?? '—'}%`} />
              <Telemetry label="Storage" value={`${live.storage ?? '—'}%`} />
              <Telemetry label="Temp" value={`${live.temperature ?? '—'}°`} />
              <Telemetry label="Net" value={`${live.networkSpeed ?? '—'} Mbps`} />
              <Telemetry label="MAC" value={live.mac || '—'} />
              <Telemetry label="IP" value={live.ip || '—'} />
              <Telemetry label="OS" value={live.os || '—'} />
              <Telemetry label="Uptime" value={live.uptime ? `${Math.floor(live.uptime / 3600)}h` : '—'} />
            </div>

            {/* Sliders */}
            <div className="space-y-3 rounded-xl bg-white/[0.02] p-3">
              <Slider label="Volume" icon={Volume2} value={live.volume ?? 50} onChange={(v) => patch('volume', v)} />
              <Slider label="Brightness" icon={Sun} value={live.brightness ?? 80} onChange={(v) => patch('brightness', v)} />
            </div>

            {/* Commands */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Remote Control</div>
              <div className="grid grid-cols-3 gap-2">
                {COMMANDS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.type}
                      disabled={busy === c.type}
                      onClick={() => send(c.type)}
                      className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[11px] font-medium transition ${
                        c.danger
                          ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          : 'bg-white/5 text-slate-200 hover:bg-neon-blue/15 hover:text-neon-cyan'
                      }`}
                    >
                      <Icon size={18} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {live.currentMedia && (
              <div className="rounded-xl bg-white/[0.02] p-3 text-xs">
                <div className="text-slate-400">Now Playing</div>
                <div className="mt-1 font-semibold text-white">{live.currentMedia}</div>
                <div className="text-slate-500">Position: {live.playbackPosition ?? 0}s</div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="truncate font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function Slider({ label, icon: Icon, value, onChange }: { label: string; icon: any; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-1"><Icon size={12} /> {label}</span>
        <span>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-neon-blue" />
    </div>
  );
}
