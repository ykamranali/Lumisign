import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission, can, logAudit } from '../auth.js';
import { asyncHandler, paginate, clamp, uuid, cryptoRandom } from '../utils.js';
import { pushCommand, notify, isDeviceOnline, sendToDevice, broadcast } from '../realtime.js';
import { ensureDeviceCredentials, recordBeacon } from '../discovery.js';
import { config } from '../config.js';

const router = Router();

// ---- Public player self-registration (no auth; device not yet approved) ----
router.post('/register', asyncHandler(async (req, res) => {
  const { name, deviceId, mac, ip, vendor, deviceType, os, playerVersion } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const existing = await query('SELECT id, auth_token, approved FROM devices WHERE device_id=$1', [deviceId]);
  if (existing.rowCount) {
    return res.json({ deviceId, authToken: existing.rows[0].auth_token, approved: existing.rows[0].approved });
  }
  const authToken = cryptoRandom(48);
  const encKey = cryptoRandom(32);
  const r = await query(
    `INSERT INTO devices (device_id, name, mac, ip, vendor, device_type, os, player_version, auth_token, encryption_key, approved, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,'discovered') RETURNING auth_token`,
    [deviceId, name || deviceId, mac || null, ip || null, vendor || null, deviceType || 'tv', os || null, playerVersion || null, authToken, encKey]
  );
  notify('new_device', 'info', 'New device registered', `Device ${name || deviceId} (${ip}) registered for enrollment`);
  res.status(201).json({ deviceId, authToken, approved: false });
}));

// Public beacon (LAN discovery fallback)
router.post('/discovery/beacon', asyncHandler(async (req, res) => {
  const id = await recordBeacon(req.body);
  res.json({ ok: true, id });
}));

// All other routes require auth + load user
router.use(requireAuth, loadUser);

// ---- Discovery (LAN) ----
// GET discovered (approved=false) devices
router.get('/discovery', requirePermission('devices', 'read'), asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT id, device_id, name, mac, ip, hostname, os, vendor, device_type, player_version, approved, status, last_heartbeat, created_at
     FROM devices WHERE approved = FALSE ORDER BY created_at DESC`
  );
  res.json({ devices: r.rows });
}));

// POST beacon from player (HTTP fallback for UDP discovery)
router.post('/discovery/beacon', asyncHandler(async (req, res) => {
  const id = await recordBeacon(req.body);
  res.json({ ok: true, id });
}));

// Approve a discovered device
router.post('/discovery/:id/approve', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const r = await query(`UPDATE devices SET approved = TRUE, status='offline' WHERE id=$1 RETURNING *`, [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Device not found' });
  const creds = await ensureDeviceCredentials(r.rows[0].device_id);
  notify('device_approved', 'info', 'Device approved', `Device ${r.rows[0].name} was approved for enrollment`, r.rows[0].id);
  await logAudit('device', 'approve', { deviceId: r.rows[0].device_id }, req.user.email);
  res.json({ ok: true, device: r.rows[0], authToken: creds.auth_token });
}));

// Reject / delete a discovered device
router.delete('/discovery/:id', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM devices WHERE id=$1 AND approved=FALSE', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Device listing ----
router.get('/', requirePermission('devices', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const where = req.query.group ? 'WHERE group_id = $1' : '';
  const params = req.query.group ? [req.query.group] : [];
  const total = await query(`SELECT count(*) FROM devices ${where}`, params);
  const r = await query(
    `SELECT * FROM devices ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ devices: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

router.get('/:id', requirePermission('devices', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM devices WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Device not found' });
  const d = r.rows[0];
  d.online = isDeviceOnline(d.id);
  res.json({ device: d });
}));

// Create device manually (enrollment token generation)
router.post('/', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const { name, deviceId, mac, ip, groupId } = req.body;
  if (!name || !deviceId) return res.status(400).json({ error: 'name and deviceId required' });
  const authToken = cryptoRandom(48);
  const encKey = cryptoRandom(32);
  const r = await query(
    `INSERT INTO devices (device_id, name, mac, ip, group_id, auth_token, encryption_key, approved)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id, device_id, auth_token`,
    [deviceId, name, mac || null, ip || null, groupId || null, authToken, encKey]
  );
  await logAudit('device', 'create', { deviceId }, req.user.email);
  res.status(201).json({ device: r.rows[0] });
}));

// Update device
router.patch('/:id', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const allowed = ['name', 'group_id', 'location', 'volume', 'brightness', 'orientation'];
  const fields = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=$${i}`); vals.push(req.body[k]); i++; }
  }
  if (!fields.length) return res.status(400).json({ error: 'No updatable fields' });
  vals.push(req.params.id);
  const r = await query(`UPDATE devices SET ${fields.join(', ')}, updated_at=now() WHERE id=$${i} RETURNING *`, vals);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Device not found' });
  // Push config if relevant
  if (['volume', 'brightness', 'orientation'].some((k) => k in req.body)) {
    sendToDevice(r.rows[0].id, 'config:push', {
      volume: req.body.volume, brightness: req.body.brightness, orientation: req.body.orientation,
    });
  }
  res.json({ device: r.rows[0] });
}));

// Delete device
router.delete('/:id', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM devices WHERE id=$1', [req.params.id]);
  await logAudit('device', 'delete', { id: req.params.id }, req.user.email);
  res.json({ ok: true });
}));

// ---- Control commands ----
const commandSchema = z.object({
  type: z.enum([
    'play', 'pause', 'stop', 'restart_playback', 'skip', 'next', 'previous',
    'restart_player', 'reboot', 'shutdown', 'update_player', 'take_screenshot',
    'adjust_volume', 'adjust_brightness', 'rotate_screen', 'sync_time',
    'push_config', 'clear_cache', 'restart_service', 'factory_reset',
  ]),
  payload: z.record(z.any()).optional(),
});

router.post('/:id/command', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid command', details: parsed.error.flatten() });
  const dev = await query('SELECT id FROM devices WHERE id=$1', [req.params.id]);
  if (dev.rowCount === 0) return res.status(404).json({ error: 'Device not found' });
  const commandId = await pushCommand(dev.rows[0].id, parsed.data.type, parsed.data.payload || {}, req.user.id);
  await logAudit('device', 'command', { deviceId: dev.rows[0].id, type: parsed.data.type }, req.user.email);
  res.json({ ok: true, commandId, delivered: isDeviceOnline(dev.rows[0].id) });
}));

// Bulk command to a group
router.post('/group/:groupId/command', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid command' });
  const devs = await query('SELECT id FROM devices WHERE group_id=$1 AND approved=TRUE', [req.params.groupId]);
  let delivered = 0;
  for (const d of devs.rows) {
    await pushCommand(d.id, parsed.data.type, parsed.data.payload || {}, req.user.id);
    if (isDeviceOnline(d.id)) delivered++;
  }
  res.json({ ok: true, targeted: devs.rows.length, delivered });
}));

// Assign playlist directly (instant override)
router.post('/:id/assign', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const { playlistId } = req.body;
  const dev = await query('SELECT id, device_id FROM devices WHERE id=$1', [req.params.id]);
  if (dev.rowCount === 0) return res.status(404).json({ error: 'Device not found' });
  const pl = await query('SELECT id, name, items, loop, shuffle FROM playlists WHERE id=$1', [playlistId]);
  if (pl.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });
  sendToDevice(dev.rows[0].id, 'assignment', { playlists: [{ playlist: pl.rows[0] }] });
  await query('UPDATE devices SET current_playlist=$1, updated_at=now() WHERE id=$2', [pl.rows[0].name, dev.rows[0].id]);
  await logAudit('device', 'assign', { deviceId: dev.rows[0].id, playlistId }, req.user.email);
  res.json({ ok: true });
}));

// Device groups
router.get('/groups/list', requirePermission('devices', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT g.*, count(d.id) as device_count FROM device_groups g LEFT JOIN devices d ON d.group_id=g.id GROUP BY g.id ORDER BY g.name');
  res.json({ groups: r.rows });
}));
router.post('/groups', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = await query('INSERT INTO device_groups (name, description) VALUES ($1,$2) RETURNING *', [name, description || null]);
  res.status(201).json({ group: r.rows[0] });
}));
router.delete('/groups/:id', requirePermission('devices', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM device_groups WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
