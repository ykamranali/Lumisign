import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { broadcast } from '../realtime.js';
import { asyncHandler } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser);

router.get('/', requirePermission('updates', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM player_updates ORDER BY created_at DESC LIMIT 50');
  res.json({ updates: r.rows });
}));

const updateSchema = z.object({
  version: z.string().min(1),
  url: z.string().min(1),
  mandatory: z.boolean().default(false),
  notes: z.string().optional(),
});

router.post('/', requirePermission('updates', 'write'), asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const r = await query(
    `INSERT INTO player_updates (version, url, mandatory, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
    [d.version, d.url, d.mandatory, d.notes || null]
  );
  broadcast('player_update_available', { version: d.version, mandatory: d.mandatory, url: d.url });
  res.status(201).json({ update: r.rows[0] });
}));

// Check for update (player polls this)
router.get('/check/:version', asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM player_updates ORDER BY created_at DESC LIMIT 1');
  if (r.rowCount === 0) return res.json({ update: null });
  const latest = r.rows[0];
  res.json({ update: latest, outdated: latest.version !== req.params.version });
}));

export default router;
