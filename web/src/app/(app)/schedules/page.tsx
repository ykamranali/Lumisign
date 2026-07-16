'use client';
import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Save, Clock, Calendar, Repeat } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Schedule } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [draft, setDraft] = useState<Schedule | null>(null);

  async function load() {
    try { setSchedules((await apiFetch('/api/schedules')).schedules); } catch {}
    try { setPlaylists((await apiFetch('/api/playlists')).playlists); } catch {}
    try { setDevices(Object.values((await import('@/store/useStore')).useStore.getState().devices)); } catch {}
    try { setGroups((await apiFetch('/api/devices/groups/list')).groups); } catch {}
  }
  useEffect(() => { load(); }, []);

  function newDraft() {
    setDraft({
      id: '', name: 'New Schedule', playlistId: playlists[0]?.id || '', deviceIds: [], groupIds: [],
      type: 'daily', startTime: '08:00', endTime: '20:00', days: [1, 2, 3, 4, 5], specificDates: [],
      timezone: 'UTC', priority: 0, active: true,
    });
  }

  function toggleDay(d: number) {
    if (!draft) return;
    const has = draft.days?.includes(d);
    setDraft({ ...draft, days: has ? draft.days!.filter((x) => x !== d) : [...(draft.days || []), d] });
  }
  function toggleDevice(id: string) {
    if (!draft) return;
    const has = draft.deviceIds.includes(id);
    setDraft({ ...draft, deviceIds: has ? draft.deviceIds.filter((x) => x !== id) : [...draft.deviceIds, id] });
  }
  function toggleGroup(id: string) {
    if (!draft) return;
    const has = draft.groupIds.includes(id);
    setDraft({ ...draft, groupIds: has ? draft.groupIds.filter((x) => x !== id) : [...draft.groupIds, id] });
  }

  async function save() {
    if (!draft) return;
    if (draft.id) {
      await apiFetch(`/api/schedules/${draft.id}`, { method: 'PATCH', body: JSON.stringify(draft) });
    } else {
      const r = await apiFetch('/api/schedules', { method: 'POST', body: JSON.stringify(draft) });
      setDraft({ ...draft, id: r.schedule.id });
    }
    await load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="glass neon-border rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Schedules</h2>
          <button onClick={newDraft} className="btn btn-primary h-8 px-2 text-xs"><Plus size={14} /> New</button>
        </div>
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
              <button onClick={() => setDraft(s)} className="flex-1 text-left text-sm text-slate-200">
                <span className="font-semibold">{s.name}</span>
                <span className="ml-2 text-xs text-slate-500">{s.type} · P{s.priority}</span>
              </button>
              <button onClick={() => remove(s.id)} className="text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass neon-border rounded-2xl p-4 lg:col-span-2">
        {!draft ? (
          <p className="py-12 text-center text-sm text-slate-500">Create or select a schedule.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="flex-1 text-lg font-bold text-white" />
              <button onClick={save} className="btn btn-primary"><Save size={14} /> Save</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Playlist
                <select value={draft.playlistId} onChange={(e) => setDraft({ ...draft, playlistId: e.target.value })} className="mt-1 w-full">
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Type
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="mt-1 w-full">
                  {['daily', 'weekly', 'monthly', 'date', 'holiday'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Start <Clock size={12} className="inline" />
                <input type="time" value={draft.startTime || ''} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} className="mt-1 w-full" />
              </label>
              <label className="text-sm text-slate-300">
                End
                <input type="time" value={draft.endTime || ''} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} className="mt-1 w-full" />
              </label>
              <label className="text-sm text-slate-300">
                Priority
                <input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} className="mt-1 w-full" />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active
              </label>
            </div>

            {draft.type === 'weekly' && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400"><Repeat size={12} /> Days</div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => (
                    <button key={d} onClick={() => toggleDay(i)} className={`rounded-lg px-3 py-1 text-xs ${draft.days?.includes(i) ? 'bg-neon-blue/20 text-neon-cyan' : 'bg-white/5 text-slate-400'}`}>{d}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Target Devices</div>
              <div className="flex flex-wrap gap-2">
                {devices.map((d: any) => (
                  <button key={d.id} onClick={() => toggleDevice(d.id)} className={`rounded-lg px-2 py-1 text-xs ${draft.deviceIds.includes(d.id) ? 'bg-neon-purple/20 text-neon-purple' : 'bg-white/5 text-slate-400'}`}>{d.name}</button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Target Groups</div>
              <div className="flex flex-wrap gap-2">
                {groups.map((g: any) => (
                  <button key={g.id} onClick={() => toggleGroup(g.id)} className={`rounded-lg px-2 py-1 text-xs ${draft.groupIds.includes(g.id) ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 text-slate-400'}`}>{g.name}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
