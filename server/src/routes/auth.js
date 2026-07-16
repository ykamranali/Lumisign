import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import {
  hashPassword, verifyPassword, signToken, createSession, destroySession,
  requireAuth, loadUser, requirePermission, can, logAudit,
} from '../auth.js';
import { asyncHandler } from '../utils.js';
import { config } from '../config.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const resdb = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (resdb.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const user = resdb.rows[0];
  if (!user.active) return res.status(403).json({ error: 'Account disabled' });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await logAudit('auth', 'failed_login', { email }, req.ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  await createSession(user.id, token);
  await query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);
  await logAudit('auth', 'login', { email }, req.ip);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions },
  });
}));

// POST /api/auth/logout
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) await destroySession(token);
  res.json({ ok: true });
}));

// GET /api/auth/me
router.get('/me', requireAuth, loadUser, asyncHandler(async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, permissions: req.user.permissions } });
}));

// GET /api/auth/roles  (available role permission templates)
router.get('/roles', requireAuth, loadUser, requirePermission('users', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT name, permissions FROM roles ORDER BY name');
  res.json({ roles: r.rows });
}));

export default router;
