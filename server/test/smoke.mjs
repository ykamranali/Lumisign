// Import-graph + logic smoke test (run with: node test/smoke.mjs)
import assert from 'node:assert';

const modules = [
  '../src/config.js',
  '../src/logger.js',
  '../src/utils.js',
  '../src/db.js',
  '../src/redis.js',
  '../src/auth.js',
  '../src/realtime.js',
  '../src/discovery.js',
  '../src/seed.js',
  '../src/swagger.js',
  '../src/routes/auth.js',
  '../src/routes/devices.js',
  '../src/routes/media.js',
  '../src/routes/playlists.js',
  '../src/routes/schedules.js',
  '../src/routes/users.js',
  '../src/routes/analytics.js',
  '../src/routes/logs.js',
  '../src/routes/notifications.js',
  '../src/routes/updates.js',
];

let failures = 0;
for (const m of modules) {
  try {
    await import(m);
    console.log('OK  ', m);
  } catch (e) {
    failures++;
    console.error('FAIL', m, '->', e.message);
  }
}

// Pure logic tests
import { can } from '../src/auth.js';
import { clamp, uuid, paginate } from '../src/utils.js';

assert.strictEqual(can({ role: 'super_admin', permissions: { '*': true } }, 'devices', 'write'), true, 'super admin all');
assert.strictEqual(can({ role: 'viewer', permissions: { devices: 'read' } }, 'devices', 'write'), false, 'viewer no write');
assert.strictEqual(can({ role: 'administrator', permissions: { devices: '*' } }, 'devices', 'write'), true, 'admin wildcard');
assert.strictEqual(can({ role: 'content_manager', permissions: { media: ['read', 'write'] } }, 'media', 'write'), true, 'cm media write');
assert.strictEqual(clamp(150, 0, 100), 100, 'clamp high');
assert.strictEqual(clamp(-5, 0, 100), 0, 'clamp low');
assert.ok(uuid().match(/^[0-9a-f-]{36}$/), 'uuid format');

console.log(failures === 0 ? '\nALL MODULES LOADED' : `\n${failures} MODULE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
