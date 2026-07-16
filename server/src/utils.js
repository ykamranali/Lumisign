// Shared utilities
import crypto from 'node:crypto';

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function uuid() {
  // RFC4122 v4 via crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function deviceToken() {
  return cryptoRandom(48);
}

export function cryptoRandom(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function snakeToCamel(obj) {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[ck] = snakeToCamel(obj[k]);
    }
    return out;
  }
  return obj;
}
