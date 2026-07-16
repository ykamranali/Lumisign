import { query } from './db.js';
import { config } from './config.js';
import logger from './logger.js';
import { verifyToken } from './auth.js';
import { publish, subscribe, isRedisEnabled } from './redis.js';
import { cryptoRandom } from './utils.js';

// In-memory device registry: deviceId (uuid) -> { socketId, telemetry, lastSeen, lastMetricsAt }
const deviceRegistry = new Map();
// socketId -> deviceId (reverse lookup)
const socketToDevice = new Map();
// Authenticated dashboard clients
const dashboardClients = new Set();

const HEARTBEAT_TIMEOUT_MS = 30000; // mark offline if no heartbeat for 30s
const METRICS_INTERVAL_MS = 15000;  // persist metrics at most every 15s per device

let ioRef = null;

export function initRealtime(io) {
  ioRef = io;

  // Socket authentication middleware
  io.use(async (socket, nextFn) => {
    const token = socket.handshake.auth?.token;
    const type = socket.handshake.auth?.type; // 'player' | 'dashboard'
    if (!token) return nextFn(new Error('missing token'));
    try {
      if (type === 'player') {
        const res = await query('SELECT id, device_id, approved, auth_token, name FROM devices WHERE auth_token = $1', [token]);
        if (res.rowCount === 0) return nextFn(new Error('invalid device token'));
        const d = res.rows[0];
        if (!d.approved) return nextFn(new Error('device not approved'));
        socket.data.kind = 'player';
        socket.data.device = d;
        return nextFn();
      } else {
        const decoded = verifyToken(token);
        socket.data.kind = 'dashboard';
        socket.data.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
        return nextFn();
      }
    } catch (e) {
      return nextFn(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.kind === 'player') {
      handlePlayer(socket);
    } else {
      handleDashboard(socket);
    }
  });

  // Cross-instance realtime via Redis pub/sub
  if (isRedisEnabled()) {
    subscribe('lumisign:broadcast', (payload) => {
      if (ioRef) ioRef.emit(payload.event, payload.data);
    });
    subscribe('lumisign:device', (payload) => {
      const entry = deviceRegistry.get(payload.deviceId);
      if (entry) ioRef.to(entry.socketId).emit(payload.event, payload.data);
    });
  }

  // Sweep for dead devices
  setInterval(sweepOfflineDevices, HEARTBEAT_TIMEOUT_MS);
}

function handleDashboard(socket) {
  dashboardClients.add(socket.id);
  socket.emit('ready', { ok: true });
  socket.on('disconnect', () => dashboardClients.delete(socket.id));
}

function handlePlayer(socket) {
  const device = socket.data.device;
  deviceRegistry.set(device.id, {
    socketId: socket.id,
    telemetry: {},
    lastSeen: Date.now(),
    lastMetricsAt: 0,
  });
  socketToDevice.set(socket.id, device.id);

  logger.info(`Player connected: ${device.name} (${device.device_id})`);

  // Mark online
  query(
    `UPDATE devices SET status='online', connection_status='connected', last_heartbeat=now(), updated_at=now() WHERE id=$1`,
    [device.id]
  );
  broadcast('device:online', { id: device.id, deviceId: device.device_id, name: device.name });

  socket.on('player:register', async (data) => {
    await applyTelemetry(device.id, data || {});
    // Send pending commands immediately
    await flushCommands(device.id, socket);
    // Send assigned playlist + schedule snapshot
    const snapshot = await buildAssignment(device.id);
    socket.emit('assignment', snapshot);
  });

  socket.on('player:heartbeat', async (data) => {
    const entry = deviceRegistry.get(device.id);
    if (entry) entry.lastSeen = Date.now();
    await applyTelemetry(device.id, data || {});
    const pending = await flushCommands(device.id, socket);
    socket.emit('player:ack', { ok: true, pending: pending.length });
  });

  socket.on('player:command:ack', async (data) => {
    try {
      await query(
        `UPDATE commands SET status=$1, executed_at=now() WHERE id=$2`,
        [data.status || 'done', data.commandId]
      );
    } catch (e) { logger.error(e.message); }
  });

  socket.on('player:metrics', async (data) => {
    await applyTelemetry(device.id, data || {});
  });

  socket.on('player:screenshot', async (data) => {
    await query(`UPDATE devices SET last_screenshot=$1, updated_at=now() WHERE id=$2`, [data.url, device.id]);
    broadcast('device:update', { id: device.id, lastScreenshot: data.url });
  });

  socket.on('player:log', async (data) => {
    await query(
      'INSERT INTO logs (level, category, source, message, meta) VALUES ($1,$2,$3,$4,$5)',
      [data.level || 'info', 'device', device.device_id, data.message || '', JSON.stringify(data.meta || {})]
    );
  });

  socket.on('disconnect', () => {
    deviceRegistry.delete(device.id);
    socketToDevice.delete(socket.id);
    logger.warn(`Player disconnected: ${device.name}`);
    query(
      `UPDATE devices SET status='offline', connection_status='disconnected', updated_at=now() WHERE id=$1`,
      [device.id]
    );
    broadcast('device:offline', { id: device.id, deviceId: device.device_id, name: device.name });
  });
}

async function applyTelemetry(deviceId, data) {
  const entry = deviceRegistry.get(deviceId);
  if (entry) {
    entry.telemetry = { ...entry.telemetry, ...data };
    entry.lastSeen = Date.now();
  }

  const fields = [];
  const values = [];
  let i = 1;
  const map = {
    cpu: 'cpu', ram: 'ram', storage: 'storage', temperature: 'temperature',
    networkSpeed: 'network_speed', volume: 'volume', brightness: 'brightness',
    orientation: 'orientation', currentPlaylist: 'current_playlist',
    currentMedia: 'current_media', playbackPosition: 'playback_position',
    ip: 'ip', hostname: 'hostname', os: 'os', playerVersion: 'player_version',
    resolution: 'resolution', uptime: 'uptime',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${i}`); values.push(data[k]); i++; }
  }
  if (fields.length) {
    values.push(deviceId);
    await query(
      `UPDATE devices SET ${fields.join(', ')}, last_heartbeat=now(), status='online', connection_status='connected', updated_at=now() WHERE id=$${i}`,
      values
    );
  }

  // Persist metrics history (throttled)
  const now = Date.now();
  if (entry && now - entry.lastMetricsAt > METRICS_INTERVAL_MS) {
    entry.lastMetricsAt = now;
    try {
      await query(
        `INSERT INTO device_metrics (device_id, cpu, ram, storage, temperature, network_speed, connection_status, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,'connected',now())`,
        [deviceId, data.cpu ?? null, data.ram ?? null, data.storage ?? null, data.temperature ?? null, data.networkSpeed ?? null]
      );
    } catch (e) { /* non-fatal */ }
  }

  // Broadcast a lightweight update to dashboards
  broadcast('device:update', { id: deviceId, ...data, status: 'online', lastHeartbeat: new Date().toISOString() });
}

async function flushCommands(deviceId, socket) {
  const res = await query(
    `SELECT id, type, payload FROM commands WHERE device_id=$1 AND status='pending' ORDER BY created_at ASC`,
    [deviceId]
  );
  for (const cmd of res.rows) {
    socket.emit('command', { commandId: cmd.id, type: cmd.type, payload: cmd.payload });
    await query(`UPDATE commands SET status='sent', executed_at=now() WHERE id=$1`, [cmd.id]);
  }
  return res.rows;
}

async function buildAssignment(deviceId) {
  // Find schedules that apply to this device (direct or via group) and are active now
  const dev = await query('SELECT group_id FROM devices WHERE id=$1', [deviceId]);
  const groupId = dev.rows[0]?.group_id || null;
  const sched = await query(
    `SELECT s.id, s.playlist_id, s.priority, s.type, s.days, s.start_time, s.end_time, s.specific_dates
     FROM schedules s
     WHERE s.active = TRUE
       AND (s.device_ids::jsonb ? $1 OR s.group_ids::jsonb ? $2)
     ORDER BY s.priority DESC, s.created_at ASC
     LIMIT 20`,
    [deviceId, groupId ? groupId.toString() : '']
  );
  const playlists = [];
  for (const s of sched.rows) {
    const p = await query('SELECT id, name, items, loop, shuffle FROM playlists WHERE id=$1', [s.playlist_id]);
    if (p.rowCount) playlists.push({ scheduleId: s.id, playlist: p.rows[0] });
  }
  return { playlists };
}

// ---- Outbound helpers ----
export function broadcast(event, data) {
  if (!ioRef) return;
  if (isRedisEnabled()) {
    publish('lumisign:broadcast', { event, data });
  }
  ioRef.emit(event, data);
}

export function sendToDevice(deviceId, event, data) {
  const entry = deviceRegistry.get(deviceId);
  if (entry && ioRef) {
    if (isRedisEnabled()) {
      publish('lumisign:device', { deviceId, event, data });
    }
    ioRef.to(entry.socketId).emit(event, data);
    return true;
  }
  return false;
}

export function isDeviceOnline(deviceId) {
  return deviceRegistry.has(deviceId);
}

export function onlineDeviceCount() {
  return deviceRegistry.size;
}

export async function pushCommand(deviceId, type, payload, createdBy = null) {
  const res = await query(
    `INSERT INTO commands (device_id, type, payload, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [deviceId, type, JSON.stringify(payload || {}), createdBy]
  );
  const commandId = res.rows[0].id;
  // Try to deliver immediately
  sendToDevice(deviceId, 'command', { commandId, type, payload: payload || {} });
  return commandId;
}

export async function notify(type, severity, title, message, deviceId = null) {
  try {
    await query(
      `INSERT INTO notifications (type, severity, title, message, device_id) VALUES ($1,$2,$3,$4,$5)`,
      [type, severity, title, message, deviceId]
    );
  } catch (e) { logger.error('notify insert failed', e.message); }
  broadcast('notification', { type, severity, title, message, deviceId, createdAt: new Date().toISOString(), read: false });
  // Security / offline alerts may also need attention
  if (severity === 'critical' || type === 'offline' || type === 'security_alert') {
    // could trigger external webhook here
  }
}

async function sweepOfflineDevices() {
  const now = Date.now();
  for (const [deviceId, entry] of deviceRegistry.entries()) {
    if (now - entry.lastSeen > HEARTBEAT_TIMEOUT_MS) {
      deviceRegistry.delete(deviceId);
      const sd = socketToDevice.get(entry.socketId);
      if (sd) socketToDevice.delete(entry.socketId);
      await query(`UPDATE devices SET status='offline', connection_status='disconnected', updated_at=now() WHERE id=$1`, [deviceId]);
      broadcast('device:offline', { id: deviceId });
    }
  }
}
