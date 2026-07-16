'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Film, Image, FileText, Globe, Cloud, Music, Tv, Rss, CloudRain, Clock, Camera, Code } from 'lucide-react';
import { apiFetch, API_URL, getToken } from '@/lib/api';
import { Media } from '@/lib/types';

const TYPE_ICON: Record<string, any> = {
  image: Image, video: Film, audio: Music, pdf: FileText, pptx: FileText, html: Code,
  youtube: Tv, iptv: Tv, rss: Rss, weather: CloudRain, clock: Clock, camera: Camera, webpage: Globe,
};

const WEB_TYPES = [
  { type: 'youtube', label: 'YouTube', icon: Tv },
  { type: 'iptv', label: 'IPTV', icon: Tv },
  { type: 'rss', label: 'RSS Feed', icon: Rss },
  { type: 'weather', label: 'Weather', icon: CloudRain },
  { type: 'clock', label: 'Clock', icon: Clock },
  { type: 'camera', label: 'Camera', icon: Camera },
  { type: 'webpage', label: 'Web Page', icon: Globe },
  { type: 'html', label: 'HTML', icon: Code },
];

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [web, setWeb] = useState({ name: '', type: 'youtube', url: '' });

  async function load() {
    try {
      const r = await apiFetch('/api/media');
      setMedia(r.media);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function uploadFiles(files: FileList) {
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('name', f.name);
      await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      }).catch(() => {});
    }
    setUploading(false);
    load();
  }

  async function addWeb() {
    if (!web.name || !web.url) return;
    await apiFetch('/api/media/web', { method: 'POST', body: JSON.stringify(web) });
    setWeb({ name: '', type: 'youtube', url: '' });
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/media/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      {/* Upload + Web */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`glass flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
            drag ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10'
          }`}
        >
          <Upload size={32} className="mb-2 text-neon-blue" />
          <p className="text-sm font-semibold text-white">Drag & drop media here</p>
          <p className="text-xs text-slate-500">Images, video, PDF, PPTX, audio — up to 2GB</p>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          {uploading && <span className="mt-2 text-xs text-neon-cyan">Uploading…</span>}
        </div>

        <div className="glass neon-border rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Globe size={16} className="text-neon-purple" /> Add Web Source</h3>
          <input value={web.name} onChange={(e) => setWeb({ ...web, name: e.target.value })} placeholder="Name" className="mb-2 w-full" />
          <div className="mb-2 flex flex-wrap gap-2">
            {WEB_TYPES.map((w) => {
              const Icon = w.icon;
              return (
                <button
                  key={w.type}
                  onClick={() => setWeb({ ...web, type: w.type })}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${web.type === w.type ? 'bg-neon-blue/20 text-neon-cyan' : 'bg-white/5 text-slate-400'}`}
                >
                  <Icon size={12} /> {w.label}
                </button>
              );
            })}
          </div>
          <input value={web.url} onChange={(e) => setWeb({ ...web, url: e.target.value })} placeholder="URL (YouTube / RSS / IPTV / webpage)" className="mb-2 w-full" />
          <button onClick={addWeb} className="btn btn-primary w-full"><Cloud size={14} /> Add Source</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {media.map((m) => {
          const Icon = TYPE_ICON[m.type] || FileText;
          const src = m.thumbnail ? `${API_URL}/api/media/${m.id}/thumbnail` : null;
          return (
            <div key={m.id} className="glass group relative overflow-hidden rounded-2xl p-3 shadow-card">
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-black/40">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <Icon size={32} className="text-neon-blue/70" />
                )}
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-white">{m.name}</div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{m.type}</span>
                <button onClick={() => remove(m.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {media.length === 0 && <p className="text-center text-sm text-slate-500">No media yet. Upload or add a web source.</p>}
    </div>
  );
}
