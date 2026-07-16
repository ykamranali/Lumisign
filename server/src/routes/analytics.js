import { Router } from 'express';
import os from 'os';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser);

// Live dashboard statistics
router.get('/stats', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const devices = await query(`
    SELECT
      count(*) FILTER (WHERE approved = TRUE) AS total,
      count(*) FILTER (WHERE approved = TRUE AND status = 'online') AS online,
      count(*) FILTER (WHERE approved = TRUE AND status = 'offline') AS offline,
      count(*) FILTER (WHERE approved = TRUE AND status = 'downloading') AS downloading,
      count(*) FILTER (WHERE approved = TRUE AND status = 'playing') AS playing,
      count(*) FILTER (WHERE approved = TRUE AND status = 'idle') AS idle,
      avg(cpu) FILTER (WHERE approved = TRUE) AS avg_cpu,
      avg(ram) FILTER (WHERE approved = TRUE) AS avg_ram,
      avg(storage) FILTER (WHERE approved = TRUE) AS avg_storage
    FROM devices
  `);

  const media = await query('SELECT count(*) AS total, coalesce(sum(size),0) AS storage_used FROM media');
  const playlists = await query("SELECT count(*) AS total FROM playlists");
  const todayUploads = await query("SELECT count(*) AS c FROM media WHERE created_at > now() - interval '24 hours'");
  const todayPlaylists = await query("SELECT count(*) AS c FROM playlists WHERE created_at > now() - interval '24 hours'");
  const activeUsers = await query("SELECT count(*) AS c FROM sessions WHERE expires_at > now()");

  const d = devices.rows[0];
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const usedMem = process.memoryUsage().heapUsed;
  const serverCpu = Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100));
  const serverMem = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  const total = parseInt(d.total || 0, 10);
  const online = parseInt(d.online || 0, 10);
  const networkHealth = total === 0 ? 100 : Math.round((online / total) * 100);
  const serverHealth = Math.round((100 - ((serverCpu + serverMem) / 2)));

  const recent = await query(
    `SELECT created_at, level, category, source, message FROM logs ORDER BY created_at DESC LIMIT 8`
  );
  const notif = await query('SELECT count(*) AS c FROM notifications WHERE read=FALSE');

  res.json({
    stats: {
      totalTvs: total,
      onlineTvs: online,
      offlineTvs: parseInt(d.offline || 0, 10),
      downloading: parseInt(d.downloading || 0, 10),
      playing: parseInt(d.playing || 0, 10),
      idle: parseInt(d.idle || 0, 10),
      storageUsedBytes: parseInt(media.rows[0].storage_used || 0, 10),
      bandwidthUsageMbps: Math.round((parseFloat(d.avg_cpu) || 0) * 0.5 * 10) / 10,
      cpuUsage: Math.round(parseFloat(d.avg_cpu) || 0),
      memoryUsage: Math.round(parseFloat(d.avg_ram) || 0),
      serverHealth,
      networkHealth,
      activeUsers: parseInt(activeUsers.rows[0].c || 0, 10),
      todaysUploads: parseInt(todayUploads.rows[0].c || 0, 10),
      todaysPlaylists: parseInt(todayPlaylists.rows[0].c || 0, 10),
      unreadNotifications: parseInt(notif.rows[0].c || 0, 10),
      mediaCount: parseInt(media.rows[0].total || 0, 10),
      playlistCount: parseInt(playlists.rows[0].total || 0, 10),
    },
    recentActivity: recent.rows,
  });
}));

// Device metrics history (for charts)
router.get('/metrics', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const deviceId = req.query.deviceId;
  const hours = parseInt(req.query.hours || '24', 10);
  let rows;
  if (deviceId) {
    const r = await query(
      `SELECT cpu, ram, storage, temperature, network_speed, recorded_at FROM device_metrics
       WHERE device_id=$1 AND recorded_at > now() - ($2 || ' hours')::interval ORDER BY recorded_at ASC`,
      [deviceId, hours]
    );
    rows = r.rows;
  } else {
    const r = await query(
      `SELECT avg(cpu) as cpu, avg(ram) as ram, date_trunc('hour', recorded_at) as recorded_at
       FROM device_metrics WHERE recorded_at > now() - ($1 || ' hours')::interval
       GROUP BY date_trunc('hour', recorded_at) ORDER BY recorded_at ASC`,
      [hours]
    );
    rows = r.rows;
  }
  res.json({ metrics: rows });
}));

// Playback history (from device logs)
router.get('/playback-history', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT l.created_at, l.source, l.message, d.name FROM logs l
     LEFT JOIN devices d ON d.device_id = l.source
     WHERE l.category = 'playback' ORDER BY l.created_at DESC LIMIT 100`
  );
  res.json({ history: r.rows });
}));

// Content usage
router.get('/content-usage', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT current_media, count(*) as plays FROM devices WHERE current_media IS NOT NULL GROUP BY current_media ORDER BY plays DESC LIMIT 20`
  );
  res.json({ usage: r.rows });
}));

// Uptime report
router.get('/uptime', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT name, status, uptime, last_heartbeat FROM devices WHERE approved=TRUE ORDER BY uptime DESC NULLS LAST LIMIT 100`
  );
  res.json({ uptime: r.rows });
}));

// Health report per device
router.get('/health', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT id, name, status, cpu, ram, storage, temperature, update_status, error_logs FROM devices WHERE approved=TRUE`
  );
  res.json({ health: r.rows });
}));

// Export combined report as JSON
router.get('/export', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const devices = await query('SELECT * FROM devices WHERE approved=TRUE');
  const media = await query('SELECT id, name, type, size, created_at FROM media');
  const playlists = await query('SELECT id, name, priority, emergency FROM playlists');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="lumisign-report.json"');
  res.json({ generatedAt: new Date().toISOString(), devices: devices.rows, media: media.rows, playlists: playlists.rows });
}));

export default router;
