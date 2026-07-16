'use client';
import { useEffect, useState } from 'react';
import { Check, X, Monitor, Radio, Server, Plus, Trash2 } from 'lucide-react';
import DeviceCard from '@/components/DeviceCard';
import ControlDrawer from '@/components/ControlDrawer';
import { apiFetch } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { Device } from '@/lib/types';

export default function DevicesPage() {
  const devices = Object.values(useStore((s) => s.devices));
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');

  async function load() {
    try {
      const d = await apiFetch('/api/devices/discovery');
      setDiscovered(d.devices);
    } catch {}
    try {
      const g = await apiFetch('/api/devices/groups/list');
      setGroups(g.groups);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: string) {
    await apiFetch(`/api/devices/discovery/${id}/approve`, { method: 'POST' });
    load();
  }
  async function reject(id: string) {
    await apiFetch(`/api/devices/discovery/${id}`, { method: 'DELETE' });
    load();
  }
  async function addGroup() {
    if (!groupName) return;
    await apiFetch('/api/devices/groups', { method: 'POST', body: JSON.stringify({ name: groupName }) });
    setGroupName('');
    load();
  }
  async function delGroup(id: string) {
    await apiFetch(`/api/devices/groups/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      {/* Discovery */}
      <section className="glass neon-border rounded-2xl p-4 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Radio size={16} className="text-neon-cyan" /> Network Discovery
          {discovered.length > 0 && <span className="rounded-full bg-neon-cyan/20 px-2 text-xs text-neon-cyan">{discovered.length} pending</span>}
        </h2>
        {discovered.length === 0 ? (
          <p className="text-sm text-slate-500">Scanning LAN… no unenrolled devices found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {discovered.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white/[0.02] p-3">
                <div>
                  <div className="text-sm font-semibold text-white">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.ip} · {d.mac} · {d.vendor || d.deviceType}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(d.id)} className="btn btn-primary h-9 w-9 p-0"><Check size={16} /></button>
                  <button onClick={() => reject(d.id)} className="btn btn-danger h-9 w-9 p-0"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Devices */}
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-white">Enrolled Devices ({devices.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} onClick={() => setSelected(d.id)} />
            ))}
            {devices.length === 0 && (
              <div className="col-span-full glass rounded-2xl p-8 text-center text-sm text-slate-500">
                No enrolled devices. Approve a discovered device above.
              </div>
            )}
          </div>
        </div>

        {/* Groups */}
        <div className="glass neon-border rounded-2xl p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Server size={16} className="text-neon-purple" /> Groups</h2>
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                <span className="text-slate-200">{g.name} <span className="text-xs text-slate-500">({g.device_count})</span></span>
                <button onClick={() => delGroup(g.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="New group" className="flex-1" />
            <button onClick={addGroup} className="btn btn-primary h-9 w-9 p-0"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {selected && <ControlDrawer deviceId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
