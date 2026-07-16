'use client';
import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, UserX, Shield } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const ROLES = ['super_admin', 'administrator', 'operator', 'content_manager', 'viewer', 'custom'];

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try { setUsers((await apiFetch('/api/users')).users); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create() {
    await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) });
    setForm({ email: '', name: '', password: '', role: 'operator' });
    setShowForm(false);
    load();
  }
  async function remove(id: string) {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    load();
  }
  async function toggleActive(u: any) {
    await apiFetch(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary"><Plus size={14} /> Add User</button>
      </div>

      {showForm && (
        <div className="glass neon-border rounded-2xl p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@lumisign.io" />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 8)" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button onClick={create} className="btn btn-primary mt-3">Create User</button>
        </div>
      )}

      <div className="glass neon-border rounded-2xl p-4">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="py-2 font-semibold text-white">{u.name}</td>
                <td className="text-slate-400">{u.email}</td>
                <td><span className="rounded bg-neon-purple/15 px-2 py-0.5 text-xs text-neon-purple">{u.role}</span></td>
                <td className={u.active ? 'text-green-300' : 'text-red-300'}>{u.active ? 'Active' : 'Disabled'}</td>
                <td className="text-slate-500">{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                <td className="flex gap-2">
                  <button onClick={() => toggleActive(u)} className="text-slate-400 hover:text-neon-cyan"><UserX size={15} /></button>
                  <button onClick={() => remove(u.id)} className="text-red-400"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
