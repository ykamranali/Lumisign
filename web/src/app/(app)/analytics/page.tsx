'use client';
import { useEffect, useState } from 'react';
import { BarChart3, Download, Activity, PieChart } from 'lucide-react';
import { LineChart, BarChart } from '@/components/Charts';
import { apiFetch } from '@/lib/api';

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [uptime, setUptime] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [hours, setHours] = useState(24);

  async function load() {
    try { setMetrics((await apiFetch(`/api/analytics/metrics?hours=${hours}`)).metrics); } catch {}
    try { setContent((await apiFetch('/api/analytics/content-usage')).usage); } catch {}
    try { setUptime((await apiFetch('/api/analytics/uptime')).uptime); } catch {}
    try { setHealth((await apiFetch('/api/analytics/health')).health); } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [hours]);

  const cpuSeries = metrics.map((m) => Number(m.cpu) || 0);
  const ramSeries = metrics.map((m) => Number(m.ram) || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[6, 24, 72].map((h) => (
            <button key={h} onClick={() => setHours(h)} className={`rounded-lg px-3 py-1 text-xs ${hours === h ? 'bg-neon-blue/20 text-neon-cyan' : 'bg-white/5 text-slate-400'}`}>{h}h</button>
          ))}
        </div>
        <button onClick={() => apiFetch('/api/analytics/export').then(() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/export`))} className="btn btn-ghost text-xs">
          <Download size={14} /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass neon-border rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Activity size={16} className="text-neon-blue" /> Avg CPU (%) — last {hours}h</h3>
          <LineChart data={cpuSeries} />
        </div>
        <div className="glass neon-border rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Activity size={16} className="text-neon-purple" /> Avg RAM (%) — last {hours}h</h3>
          <LineChart data={ramSeries} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass neon-border rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><PieChart size={16} className="text-neon-cyan" /> Most Viewed Content</h3>
          <BarChart data={content.slice(0, 10).map((c) => ({ label: c.current_media || 'Unknown', value: Number(c.plays) }))} color="#22f5ff" />
        </div>
        <div className="glass neon-border rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 size={16} className="text-neon-pink" /> Device Uptime</h3>
          <BarChart data={uptime.slice(0, 10).map((u) => ({ label: u.name, value: Math.floor((u.uptime || 0) / 3600) }))} color="#ec4899" />
        </div>
      </div>

      <div className="glass neon-border rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Device Health</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr><th className="py-2">Device</th><th>Status</th><th>CPU</th><th>RAM</th><th>Storage</th><th>Temp</th><th>Update</th></tr>
            </thead>
            <tbody>
              {health.map((d: any) => (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="py-2 font-semibold text-slate-200">{d.name}</td>
                  <td className="text-slate-400">{d.status}</td>
                  <td>{d.cpu ?? '—'}</td>
                  <td>{d.ram ?? '—'}</td>
                  <td>{d.storage ?? '—'}</td>
                  <td>{d.temperature ?? '—'}</td>
                  <td className="text-slate-400">{d.update_status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
