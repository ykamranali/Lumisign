'use client';

export function LineChart({ data, height = 200 }: { data: number[]; height?: number }) {
  if (data.length === 0) return <div className="text-xs text-slate-500">No data</div>;
  const w = 600;
  const h = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,212,255,0.4)" />
          <stop offset="100%" stopColor="rgba(0,212,255,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lc)" />
      <path d={line} fill="none" stroke="#00d4ff" strokeWidth={2} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2} fill="#22f5ff" />)}
    </svg>
  );
}

export function BarChart({ data, color = '#a855f7' }: { data: { label: string; value: number }[]; color?: string }) {
  if (data.length === 0) return <div className="text-xs text-slate-500">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 truncate text-slate-400">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-10 text-right text-slate-300">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
