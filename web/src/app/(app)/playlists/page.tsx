'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical, Save, ListVideo, Repeat, Shuffle, AlertTriangle, Eye } from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/api';
import { Media, Playlist } from '@/lib/types';

const TRANSITIONS = ['none', 'fade', 'slide', 'crossfade', 'zoom'];

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Playlist | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function load() {
    try { setPlaylists((await apiFetch('/api/playlists')).playlists); } catch {}
    try { setMedia((await apiFetch('/api/media')).media); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function select(id: string) {
    const p = await apiFetch(`/api/playlists/${id}`);
    setSelectedId(id);
    setDraft(p.playlist);
  }

  async function create() {
    const r = await apiFetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Playlist', items: [] }),
    });
    await load();
    select(r.playlist.id);
  }

  function addItem(m: Media) {
    if (!draft) return;
    setDraft({
      ...draft,
      items: [...draft.items, { mediaId: m.id, duration: 10, transition: 'fade' }],
    });
  }

  function removeItem(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  }

  function updateItem(idx: number, patch: any) {
    if (!draft) return;
    setDraft({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  }

  function reorder(from: number, to: number) {
    if (!draft) return;
    const arr = [...draft.items];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setDraft({ ...draft, items: arr });
  }

  async function save() {
    if (!draft) return;
    await apiFetch(`/api/playlists/${draft.id}`, { method: 'PATCH', body: JSON.stringify(draft) });
    await load();
  }

  function toggle(key: 'loop' | 'shuffle' | 'emergency' | 'interactive' | 'conditional') {
    if (!draft) return;
    setDraft({ ...draft, [key]: !draft[key] });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Playlist list */}
      <div className="glass neon-border rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Playlists</h2>
          <button onClick={create} className="btn btn-primary h-8 px-2 text-xs"><Plus size={14} /> New</button>
        </div>
        <div className="space-y-2">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${selectedId === p.id ? 'bg-neon-blue/15 text-neon-cyan' : 'bg-white/[0.02] text-slate-300'}`}
            >
              <span className="flex items-center gap-2"><ListVideo size={14} /> {p.name}</span>
              <span className="text-xs text-slate-500">{p.items.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="glass neon-border rounded-2xl p-4 lg:col-span-2">
        {!draft ? (
          <p className="py-12 text-center text-sm text-slate-500">Select or create a playlist to build it.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="flex-1 text-lg font-bold text-white"
              />
              <button onClick={save} className="btn btn-primary"><Save size={14} /> Save</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Toggle active={draft.loop} onClick={() => toggle('loop')} icon={Repeat} label="Loop" />
              <Toggle active={draft.shuffle} onClick={() => toggle('shuffle')} icon={Shuffle} label="Shuffle" />
              <Toggle active={draft.emergency} onClick={() => toggle('emergency')} icon={AlertTriangle} label="Emergency" danger />
              <Toggle active={draft.interactive} onClick={() => toggle('interactive')} icon={Eye} label="Interactive" />
              <label className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                Priority <input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} className="w-12" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Items */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Playlist Items ({draft.items.length})</h3>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {draft.items.map((it, idx) => {
                    const m = media.find((x) => x.id === it.mediaId);
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); }}
                        className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2"
                      >
                        <GripVertical size={14} className="cursor-grab text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{m?.name || it.mediaId}</div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <input type="number" value={it.duration} onChange={(e) => updateItem(idx, { duration: Number(e.target.value) })} className="w-14" />
                            s
                            <select value={it.transition} onChange={(e) => updateItem(idx, { transition: e.target.value })} className="text-xs">
                              {TRANSITIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <button onClick={() => removeItem(idx)} className="text-red-400"><Trash2 size={14} /></button>
                      </div>
                    );
                  })}
                  {draft.items.length === 0 && <p className="text-xs text-slate-500">Add media from the right →</p>}
                </div>
              </div>

              {/* Media library */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Media Library</h3>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {media.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addItem(m)}
                      className="flex w-full items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2 text-left text-sm text-slate-200 hover:bg-neon-blue/10"
                    >
                      <span className="truncate">{m.name}</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{m.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, icon: Icon, label, danger }: { active: boolean; onClick: () => void; icon: any; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
        active ? (danger ? 'bg-red-500/20 text-red-300' : 'bg-neon-blue/20 text-neon-cyan') : 'bg-white/5 text-slate-400'
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
