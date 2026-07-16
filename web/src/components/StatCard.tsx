'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = display;
    const end = value;
    const dur = 600;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setDisplay(start + (end - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = 'blue',
  decimals = 0,
}: {
  label: string;
  value: number;
  unit?: string;
  icon: any;
  accent?: 'blue' | 'cyan' | 'purple' | 'pink' | 'green';
  decimals?: number;
}) {
  const accents: Record<string, string> = {
    blue: 'from-neon-blue/20 text-neon-blue',
    cyan: 'from-neon-cyan/20 text-neon-cyan',
    purple: 'from-neon-purple/20 text-neon-purple',
    pink: 'from-neon-pink/20 text-neon-pink',
    green: 'from-green-400/20 text-green-300',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="glass neon-border relative overflow-hidden rounded-2xl p-4 shadow-card"
    >
      <div className={clsx('absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent opacity-40 blur-2xl', accents[accent])} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <Icon size={18} className={clsx('opacity-80', accents[accent].split(' ')[1])} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-white">
          <AnimatedNumber value={value} decimals={decimals} />
        </span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
    </motion.div>
  );
}
