import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';

import { config, isProd } from './config.js';
import logger from './logger.js';
import { initDatabase, closeDatabase } from './db.js';
import { initRedis } from './redis.js';
import { initRealtime } from './realtime.js';
import { initDiscovery } from './discovery.js';
import { seedAdmin } from './seed.js';
import { swaggerSpec } from './swagger.js';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/devices.js';
import mediaRoutes from './routes/media.js';
import playlistRoutes from './routes/playlists.js';
import scheduleRoutes from './routes/schedules.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import logRoutes from './routes/logs.js';
import notificationRoutes from './routes/notifications.js';
import updateRoutes from './routes/updates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()), credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Health — available immediately, reports DB status
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), db: dbReady ? 'ready' : 'connecting' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), db: dbReady ? 'ready' : 'connecting' }));

  // Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // TV Player (static web player, also models native player clients)
  app.use('/player', express.static(join(__dirname, '..', 'player')));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/updates', updateRoutes);

  // Sample data endpoint (clearly marked; for testing only)
  app.post('/api/seed/sample', async (req, res) => {
    const { seedSampleData } = await import('./seed.js');
    try {
      const result = await seedSampleData();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Dashboard (static export of the Next.js app, served by the API server in a single container)
  const webOut = resolve(__dirname, '..', '..', 'web', 'out');
  if (fs.existsSync(webOut)) {
    app.use(express.static(webOut, { extensions: ['html'] }));
  }

  // 404
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('Request error:', err.message);
    res.status(err.status || 500).json({ error: isProd ? 'Internal error' : err.message });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin.split(',').map((s) => s.trim()), methods: ['GET', 'POST'] },
    pingTimeout: 60000,
  });

  initRealtime(io);
  initDiscovery();

  server.listen(config.port, () => {
    logger.info(`LumiSign server listening on :${config.port} (${config.nodeEnv})`);
    logger.info(`Swagger docs at ${config.serverPublicUrl}/api-docs`);
  });

  // Background DB bootstrap with retry (keeps server available during DB outages)
  let dbReady = false;
  (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        await initDatabase();
        await seedAdmin();
        dbReady = true;
        logger.info('Database ready');
        break;
      } catch (e) {
        logger.error(`DB not ready (attempt ${attempt}), retrying in 5s:`, e.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    await initRedis();
    logger.info('Backend fully initialized');
  })();

  const shutdown = async () => {
    logger.info('Shutting down...');
    io.close();
    await closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
