import dgram from 'dgram';
import { query } from './db.js';
import logger from './logger.js';
import { cryptoRandom } from './utils.js';
import { broadcast, notify } from './realtime.js';

const DISCOVERY_PORT = 5000;
const DISCOVERY_MAGIC = 'LUMISIGN_DISCOVERY_V1';

// In-memory cache of recently seen beacons (fallback if not yet in DB)
const beaconCache = new Map();

export async function ensureDeviceCredentials(deviceId) {
  const res = await query('SELECT auth_token, encryption_key FROM devices WHERE device_id = $1', [deviceId]);
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  let { auth_token, encryption_key } = row;
  if (!auth_token || !encryption_key) {
    auth_token = cryptoRandom(48);
    encryption_key = cryptoRandom(32);
    await query('UPDATE devices SET auth_token=$1, encryption_key=$2 WHERE device_id=$3', [auth_token, encryption_key, deviceId]);
  }
  return { auth_token, encryption_key };
}

// Called by player HTTP/Websocket beacon and UDP listener
export async function recordBeacon(data) {
  if (!data || !data.deviceId) return null;
  const now = Date.now();
  beaconCache.set(data.deviceId, { ...data, lastSeen: now });

  const existing = await query('SELECT id, approved, name FROM devices WHERE device_id = $1', [data.deviceId]);
  if (existing.rowCount === 0) {
    const authToken = cryptoRandom(48);
    const encKey = cryptoRandom(32);
    const ins = await query(
      `INSERT INTO devices (device_id, name, mac, ip, hostname, os, vendor, device_type, player_version, auth_token, encryption_key, approved, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, FALSE, 'discovered') RETURNING id`,
      [
        data.deviceId, data.name || data.deviceId, data.mac || null, data.ip || null,
        data.hostname || null, data.os || null, data.vendor || null, data.deviceType || 'tv',
        data.playerVersion || null, authToken, encKey,
      ]
    );
    broadcast('discovery:new', { deviceId: data.deviceId, name: data.name, ip: data.ip, mac: data.mac, vendor: data.vendor, deviceType: data.deviceType, status: 'discovered' });
    notify('new_device', 'info', 'New device discovered', `Device ${data.name || data.deviceId} (${data.ip}) joined the network`, ins.rows[0].id);
    return ins.rows[0].id;
  } else {
    // Update network info if changed
    await query(
      `UPDATE devices SET ip=$1, hostname=$2, os=$3, vendor=$4, device_type=$5, player_version=$6, updated_at=now()
       WHERE device_id=$7`,
      [data.ip || null, data.hostname || null, data.os || null, data.vendor || null, data.deviceType || 'tv', data.playerVersion || null, data.deviceId]
    );
    return existing.rows[0].id;
  }
}

export function getBeaconCache() {
  return Array.from(beaconCache.values());
}

export function initDiscovery() {
  let socket;
  try {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('error', (err) => logger.warn('Discovery UDP error:', err.message));
    socket.on('message', (msg, rinfo) => {
      try {
        const text = msg.toString();
        if (!text.startsWith(DISCOVERY_MAGIC)) return;
        const payload = JSON.parse(text.slice(DISCOVERY_MAGIC.length).trim());
        payload.ip = payload.ip || rinfo.address;
        recordBeacon(payload).catch((e) => logger.error('beacon record failed', e.message));
      } catch {
        /* ignore malformed */
      }
    });
    socket.bind(DISCOVERY_PORT, () => {
      logger.info(`LAN discovery UDP listener on port ${DISCOVERY_PORT}`);
    });
  } catch (e) {
    logger.warn('Could not start UDP discovery (non-fatal):', e.message);
  }
  return socket;
}

export { DISCOVERY_PORT, DISCOVERY_MAGIC };
