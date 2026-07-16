import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './config.js';
import { query } from './db.js';
import logger from './logger.js';

// ---- Password hashing ----
export async function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ---- JWT ----
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

// ---- Secure sessions (revocable) ----
export async function createSession(userId, token, expiresInSeconds = 12 * 3600) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3) ON CONFLICT (token_hash) DO UPDATE SET expires_at = $3',
    [userId, tokenHash, expiresAt]
  );
  return tokenHash;
}

export async function destroySession(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

export async function isSessionValid(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const res = await query('SELECT 1 FROM sessions WHERE token_hash = $1 AND expires_at > now()', [tokenHash]);
  return res.rowCount > 0;
}

// ---- Permission logic ----
// permissions shape (from roles table or users.permissions):
//   { "*": true }  OR  { devices: "*", media: ["read","write"], ... }
export function can(user, resource, action = 'read') {
  if (!user) return false;
  const perms = user.permissions || {};
  if (perms['*'] === true) return true;
  const r = perms[resource];
  if (r === undefined) return false;
  if (r === '*' || r === true) return true;
  if (Array.isArray(r)) return r.includes(action) || r.includes('*');
  return false;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// requireAuth plus load full user (with permissions) from DB
export async function loadUser(req, res, next) {
  try {
    const res2 = await query(
      'SELECT id, email, name, role, permissions, active FROM users WHERE id = $1',
      [req.user.id]
    );
    if (res2.rowCount === 0) return res.status(401).json({ error: 'User not found' });
    const u = res2.rows[0];
    if (!u.active) return res.status(403).json({ error: 'Account disabled' });
    req.user = u;
    next();
  } catch (e) {
    logger.error('loadUser error', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
}

export function requirePermission(resource, action = 'read') {
  return (req, res, next) => {
    if (!can(req.user, resource, action)) {
      return res.status(403).json({ error: `Insufficient permissions for ${resource}:${action}` });
    }
    next();
  };
}

export async function logAudit(category, message, meta = {}, source = null) {
  try {
    await query(
      'INSERT INTO logs (level, category, source, message, meta) VALUES ($1,$2,$3,$4,$5)',
      ['info', category, source, message, JSON.stringify(meta)]
    );
  } catch (e) {
    logger.error('Audit log failed', e.message);
  }
}
