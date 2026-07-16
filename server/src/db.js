import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { config } from './config.js';
import logger from './logger.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Run migrations / schema on boot
export async function initDatabase() {
  const schema = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  // Split on statements that are safe to split (semicolons at end of line)
  const statements = schema
    .split(';\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let client;
  try {
    client = await pool.connect();
    for (const stmt of statements) {
      await client.query(stmt + ';');
    }
    logger.info('Database schema initialized');
  } catch (err) {
    logger.error('Database initialization failed:', err.message);
    throw err;
  } finally {
    if (client) client.release();
  }
}

// Simple query helper with timeout guards
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    logger.debug(`Query ${Date.now() - start}ms: ${text.slice(0, 80)}`);
    return res;
  } catch (err) {
    logger.error('Query error:', err.message, text.slice(0, 120));
    throw err;
  }
}

export async function getClient() {
  return pool.connect();
}

export async function closeDatabase() {
  await pool.end();
}

// Allow `node src/db.js` to run migrations directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase()
    .then(() => { logger.info('Migrations complete'); process.exit(0); })
    .catch(() => process.exit(1));
}

export { pool };
export default { initDatabase, query, getClient, closeDatabase, pool };
