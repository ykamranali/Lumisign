import Redis from 'ioredis';
import { config } from './config.js';
import logger from './logger.js';

let pubClient = null;
let subClient = null;
let enabled = false;

export async function initRedis() {
  if (!config.redis.enabled) {
    logger.warn('Redis disabled — running without cache/pub-sub (single-instance mode)');
    return false;
  }
  try {
    pubClient = new Redis(config.redis.url, { maxRetriesPerRequest: 2, lazyConnect: true });
    subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    enabled = true;
    logger.info('Redis connected');
    return true;
  } catch (err) {
    logger.warn('Redis unavailable, continuing without it:', err.message);
    enabled = false;
    return false;
  }
}

export function isRedisEnabled() {
  return enabled;
}

export async function publish(channel, message) {
  if (!enabled || !pubClient) return;
  try {
    await pubClient.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
  } catch (e) {
    logger.error('Redis publish error:', e.message);
  }
}

export function subscribe(channel, handler) {
  if (!enabled || !subClient) return;
  subClient.subscribe(channel);
  subClient.on('message', (ch, msg) => {
    if (ch === channel) {
      try {
        handler(JSON.parse(msg));
      } catch {
        handler(msg);
      }
    }
  });
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  if (!enabled || !pubClient) return;
  try {
    await pubClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (e) { /* ignore */ }
}

export async function cacheGet(key) {
  if (!enabled || !pubClient) return null;
  try {
    const v = await pubClient.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export { pubClient, subClient };
