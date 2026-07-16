'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiFetch, setToken, setUser } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { MonitorPlay } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      connectSocket();
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <ParticleField />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-strong neon-border relative z-10 w-full max-w-md rounded-2xl p-8 shadow-card"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple shadow-glow">
            <MonitorPlay size={34} className="text-dark-900" />
          </div>
          <h1 className="gradient-text text-2xl font-extrabold tracking-tight">LumiSign Enterprise</h1>
          <p className="mt-1 text-sm text-slate-400">Network Operations Center</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lumisign.io"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full"
              required
            />
          </div>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Authenticating…' : 'Enter NOC'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Default admin: admin@lumisign.io / Admin@12345
        </p>
      </motion.div>
    </div>
  );
}

function ParticleField() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-grid-faint [background-size:40px_40px] opacity-40" />
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-neon-blue"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.8, 1] }}
          transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}
