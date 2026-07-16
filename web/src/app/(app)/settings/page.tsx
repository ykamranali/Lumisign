'use client';
import { useEffect, useState } from 'react';
import { Settings, Database, Shield, UploadCloud, Sparkles, KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useStore } from '@/store/useStore';

export default function SettingsPage() {
  const connected = useStore((s) => s.connected);
  const [roles, setRoles] = useState<any[]>([]);
  const [update, setUpdate] = useState({ version: '', url: '', mandatory: false, notes: '' });
  const [msg, setMsg] = useState('');

  async function loadRoles() {
    try { setRoles((await apiFetch('/api/auth/roles')).roles); } catch {}
  }
  useEffect(() => { loadRoles(); }, []);

  async function publishUpdate() {
    await apiFetch('/api/updates', { method: 'POST', body: JSON.stringify(update) });
    setMsg('Player update published. Devices will be notified.');
    setUpdate({ version: '', url: '', mandatory: false, notes: '' });
  }

  async function genSample() {
    const r = await apiFetch('/api/seed/sample', { method: 'POST' });
    setMsg(`Sample data created: ${r.media} media items, playlist ${r.playlistId}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="glass neon-border rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Database size={16} className="text-neon-blue" /> System</h3>
        <div className="space-y-2 text-sm">
          <Row label="Realtime Socket" value={connected ? 'Connected' : 'Disconnected'} ok={connected} />
          <Row label="API URL" value={process.env.NEXT_PUBLIC_API_URL || '—'} />
          <Row label="Storage Backend" value="Local / MinIO" />
          <Row label="Auth" value="JWT + RBAC" ok />
        </div>
      </div>

      <div className="glass neon-border rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><UploadCloud size={16} className="text-neon-cyan" /> Publish Player Update</h3>
        <input value={update.version} onChange={(e) => setUpdate({ ...update, version: e.target.value })} placeholder="Version (e.g. 2.1.0)" className="mb-2 w-full" />
        <input value={update.url} onChange={(e) => setUpdate({ ...update, url: e.target.value })} placeholder="Download URL" className="mb-2 w-full" />
        <input value={update.notes} onChange={(e) => setUpdate({ ...update, notes: e.target.value })} placeholder="Release notes" className="mb-2 w-full" />
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={update.mandatory} onChange={(e) => setUpdate({ ...update, mandatory: e.target.checked })} /> Mandatory</label>
        <button onClick={publishUpdate} className="btn btn-primary mt-3">Publish</button>
      </div>

      <div className="glass neon-border rounded-2xl p-4 lg:col-span-2">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Shield size={16} className="text-neon-purple" /> Role Permissions</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.name} className="rounded-xl bg-white/[0.02] p-3">
              <div className="text-sm font-semibold text-white">{r.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.keys(r.permissions).map((k) => (
                  <span key={k} className="rounded bg-neon-blue/10 px-1.5 py-0.5 text-[10px] text-neon-cyan">{k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass neon-border rounded-2xl p-4 lg:col-span-2">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={16} className="text-neon-pink" /> Testing Data</h3>
        <p className="mb-3 text-xs text-slate-500">Generate clearly-labelled SAMPLE data (clock, weather, RSS) for testing the player and dashboards.</p>
        <button onClick={genSample} className="btn btn-ghost">Generate Sample Data</button>
        {msg && <p className="mt-2 text-xs text-neon-cyan">{msg}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className={ok ? 'text-green-300' : 'text-slate-200'}>{value}</span>
    </div>
  );
}
