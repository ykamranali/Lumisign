import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission, hashPassword, can, logAudit } from '../auth.js';
import { asyncHandler, paginate } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser, requirePermission('users', 'read'));

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['super_admin', 'administrator', 'operator', 'content_manager', 'viewer', 'custom']),
  permissions: z.record(z.any()).optional(),
  active: z.boolean().default(true),
});

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const total = await query('SELECT count(*) FROM users');
  const r = await query('SELECT id, email, name, role, permissions, active, last_login, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  res.json({ users: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const r = await query('SELECT id, email, name, role, permissions, active, last_login, created_at FROM users WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ user: r.rows[0] });
}));

router.post('/', requirePermission('users', 'write'), asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const exists = await query('SELECT 1 FROM users WHERE email=$1', [d.email.toLowerCase()]);
  if (exists.rowCount) return res.status(409).json({ error: 'Email already registered' });
  const hash = await hashPassword(d.password);
  const r = await query(
    `INSERT INTO users (email, name, password_hash, role, permissions, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, name, role`,
    [d.email.toLowerCase(), d.name, hash, d.role, JSON.stringify(d.permissions || {}), d.active]
  );
  await logAudit('user', 'create', { email: d.email, role: d.role }, req.user.email);
  res.status(201).json({ user: r.rows[0] });
}));

router.patch('/:id', requirePermission('users', 'write'), asyncHandler(async (req, res) => {
  const fields = [];
  const vals = [];
  let i = 1;
  if (req.body.name) { fields.push(`name=$${i}`); vals.push(req.body.name); i++; }
  if (req.body.role) { fields.push(`role=$${i}`); vals.push(req.body.role); i++; }
  if (req.body.permissions) { fields.push(`permissions=$${i}`); vals.push(JSON.stringify(req.body.permissions)); i++; }
  if (req.body.active !== undefined) { fields.push(`active=$${i}`); vals.push(req.body.active); i++; }
  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password too short' });
    fields.push(`password_hash=$${i}`); vals.push(await hashPassword(req.body.password)); i++;
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields' });
  vals.push(req.params.id);
  const r = await query(`UPDATE users SET ${fields.join(', ')}, updated_at=now() WHERE id=$${i} RETURNING id, email, name, role, active`, vals);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  await logAudit('user', 'update', { id: req.params.id }, req.user.email);
  res.json({ user: r.rows[0] });
}));

router.delete('/:id', requirePermission('users', 'write'), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await query('DELETE FROM users WHERE id=$1', [req.params.id]);
  await logAudit('user', 'delete', { id: req.params.id }, req.user.email);
  res.json({ ok: true });
}));

export default router;
