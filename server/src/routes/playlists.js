import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler, paginate } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser);

const itemSchema = z.object({
  mediaId: z.string().uuid(),
  duration: z.number().min(1).default(10),
  transition: z.enum(['none', 'fade', 'slide', 'crossfade', 'zoom']).default('fade'),
});
const playlistSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  items: z.array(itemSchema).default([]),
  loop: z.boolean().default(true),
  shuffle: z.boolean().default(false),
  priority: z.number().int().default(0),
  emergency: z.boolean().default(false),
  conditional: z.boolean().default(false),
  interactive: z.boolean().default(false),
});

router.get('/', requirePermission('playlists', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const total = await query('SELECT count(*) FROM playlists');
  const r = await query('SELECT * FROM playlists ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  res.json({ playlists: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

router.get('/:id', requirePermission('playlists', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM playlists WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ playlist: r.rows[0] });
}));

router.post('/', requirePermission('playlists', 'write'), asyncHandler(async (req, res) => {
  const parsed = playlistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const r = await query(
    `INSERT INTO playlists (name, description, items, loop, shuffle, priority, emergency, conditional, interactive, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [d.name, d.description || null, JSON.stringify(d.items), d.loop, d.shuffle, d.priority, d.emergency, d.conditional, d.interactive, req.user.id]
  );
  res.status(201).json({ playlist: r.rows[0] });
}));

router.patch('/:id', requirePermission('playlists', 'write'), asyncHandler(async (req, res) => {
  const parsed = playlistSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const cur = await query('SELECT * FROM playlists WHERE id=$1', [req.params.id]);
  if (cur.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const vals = [];
  let i = 1;
  for (const k of ['name', 'description', 'loop', 'shuffle', 'priority', 'emergency', 'conditional', 'interactive']) {
    if (d[k] !== undefined) { fields.push(`${k}=$${i}`); vals.push(d[k]); i++; }
  }
  if (d.items !== undefined) { fields.push(`items=$${i}`); vals.push(JSON.stringify(d.items)); i++; }
  vals.push(req.params.id);
  const r = await query(`UPDATE playlists SET ${fields.join(', ')}, updated_at=now() WHERE id=$${i} RETURNING *`, vals);
  res.json({ playlist: r.rows[0] });
}));

router.delete('/:id', requirePermission('playlists', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM playlists WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// Duplicate
router.post('/:id/duplicate', requirePermission('playlists', 'write'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM playlists WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const p = r.rows[0];
  const nr = await query(
    `INSERT INTO playlists (name, description, items, loop, shuffle, priority, emergency, conditional, interactive, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [`${p.name} (copy)`, p.description, p.items, p.loop, p.shuffle, p.priority, p.emergency, p.conditional, p.interactive, req.user.id]
  );
  res.status(201).json({ playlist: nr.rows[0] });
}));

export default router;
