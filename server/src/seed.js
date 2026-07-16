import { query } from './db.js';
import { hashPassword } from './auth.js';
import { config } from './config.js';
import logger from './logger.js';

export async function seedAdmin() {
  const res = await query('SELECT 1 FROM users WHERE email=$1', [config.seed.adminEmail.toLowerCase()]);
  if (res.rowCount === 0) {
    const hash = await hashPassword(config.seed.adminPassword);
    await query(
      `INSERT INTO users (email, name, password_hash, role, permissions, active)
       VALUES ($1,$2,$3,'super_admin','{"*":true}',TRUE)`,
      [config.seed.adminEmail.toLowerCase(), config.seed.adminName, hash]
    );
    logger.info(`Seeded super admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
  } else {
    logger.info('Admin user already exists, skipping seed');
  }

  // Ensure a default group exists
  const g = await query("SELECT 1 FROM device_groups WHERE name='Default'");
  if (g.rowCount === 0) {
    await query("INSERT INTO device_groups (name, description) VALUES ('Default','Default device group')");
  }
}

// Generate clearly-labelled SAMPLE data for testing/demo only
export async function seedSampleData() {
  const group = await query("SELECT id FROM device_groups WHERE name='Default' LIMIT 1");
  const gid = group.rows[0]?.id;

  const media = await query(
    `INSERT INTO media (name, type, url, duration, metadata) VALUES
       ('Sample Clock','clock','',10,'{"sample":true}'),
       ('Sample Weather','weather','',15,'{"sample":true,"location":"New York"}'),
       ('Sample RSS','rss','https://feeds.bbci.co.uk/news/rss.xml',20,'{"sample":true}')
     RETURNING id, type`
  );
  const ids = media.rows;
  const items = ids.map((m, idx) => ({ mediaId: m.id, duration: [10, 15, 20][idx], transition: 'fade' }));
  const pl = await query(
    `INSERT INTO playlists (name, description, items, loop, created_by, metadata) VALUES ($1,$2,$3,TRUE,NULL,'{"sample":true}') RETURNING id`,
    ['Sample Playlist', 'Auto-generated sample playlist for testing', JSON.stringify(items)]
  );
  logger.info('Sample data created (marked sample=true)');
  return { media: ids.length, playlistId: pl.rows[0].id, groupId: gid };
}
