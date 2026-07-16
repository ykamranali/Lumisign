import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler, paginate } from '../utils.js';
import { sendToDevice, broadcast } from '../realtime.js';

const router = Router();
router.use(requireAuth, loadUser);

const scheduleSchema = z.object({
  name: z.string().min(1),
  playlistId: z.string().uuid(),
  deviceIds: z.array(z.string().uuid()).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
  type: z.enum(['daily', 'weekly', 'monthly', 'date', 'holiday']).default('daily'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  days: z.array(z.number().int().min(0).max(6)).optional(),
  specificDates: z.array(z.string()).optional(),
  timezone: z.string().default('UTC'),
  priority: z.number().int().default(0),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

router.get('/', requirePermission('schedules', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const total = await query('SELECT count(*) FROM schedules');
  const r = await query('SELECT * FROM schedules ORDER BY priority DESC, created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  res.json({ schedules: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

router.get('/:id', requirePermission('schedules', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM schedules WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ schedule: r.rows[0] });
}));

router.post('/', requirePermission('schedules', 'write'), asyncHandler(async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const r = await query(
    `INSERT INTO schedules (name, playlist_id, device_ids, group_ids, type, start_time, end_time, days, specific_dates, timezone, priority, expires_at, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [d.name, d.playlistId, JSON.stringify(d.deviceIds), JSON.stringify(d.groupIds), d.type, d.startTime || null, d.endTime || null, JSON.stringify(d.days || null), JSON.stringify(d.specificDates || null), d.timezone, d.priority, d.expiresAt || null, d.active, req.user.id]
  );
  // Notify affected devices to re-pull assignment
  await notifyAffected(d.deviceIds, d.groupIds);
  res.status(201).json({ schedule: r.rows[0] });
}));

router.patch('/:id', requirePermission('schedules', 'write'), asyncHandler(async (req, res) => {
  const parsed = scheduleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const cur = await query('SELECT * FROM schedules WHERE id=$1', [req.params.id]);
  if (cur.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const vals = [];
  let i = 1;
  const colMap = {
    name: 'name', playlistId: 'playlist_id', deviceIds: 'device_ids', groupIds: 'group_ids',
    type: 'type', startTime: 'start_time', endTime: 'end_time', days: 'days',
    specificDates: 'specific_dates', timezone: 'timezone', priority: 'priority', expiresAt: 'expires_at', active: 'active',
  };
  for (const [k, col] of Object.entries(colMap)) {
    if (d[k] !== undefined) {
      fields.push(`${col}=$${i}`);
      vals.push(['deviceIds', 'groupIds', 'days', 'specificDates'].includes(k) ? JSON.stringify(d[k]) : d[k]);
      i++;
    }
  }
  vals.push(req.params.id);
  const r = await query(`UPDATE schedules SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, vals);
  res.json({ schedule: r.rows[0] });
}));

router.delete('/:id', requirePermission('schedules', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM schedules WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

async function notifyAffected(deviceIds, groupIds) {
  // Pull device rows for the schedule and push assignment refresh
  let devs = [];
  if (deviceIds && deviceIds.length) {
    const r = await query('SELECT id FROM devices WHERE id = ANY($1)', [deviceIds]);
    devs = r.rows;
  } else if (groupIds && groupIds.length) {
    const r = await query('SELECT id FROM devices WHERE group_id = ANY($1)', [groupIds]);
    devs = r.rows;
  }
  for (const d of devs) {
    sendToDevice(d.id, 'assignment:refresh', {});
  }
}

export default router;
