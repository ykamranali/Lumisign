import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  serverPublicUrl: process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,

  // Prefer DATABASE_URL (provided by Railway / many PaaS managed Postgres plugins)
  db: (() => {
    const fallback = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'lumisign',
      user: process.env.DB_USER || 'lumisign',
      password: process.env.DB_PASSWORD || 'change_me_strong_password',
    };
    if (!process.env.DATABASE_URL) return fallback;
    try {
      const u = new URL(process.env.DATABASE_URL);
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 5432,
        name: u.pathname.replace(/^\//, '') || 'lumisign',
        user: decodeURIComponent(u.username) || 'lumisign',
        password: decodeURIComponent(u.password) || '',
      };
    } catch {
      return fallback;
    }
  })(),

  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev_session_secret',

  storage: {
    backend: process.env.STORAGE_BACKEND || 'local',
    mediaRoot: process.env.MEDIA_ROOT || join(__dirname, '..', 'storage', 'media'),
    thumbsRoot: process.env.THUMBS_ROOT || join(__dirname, '..', 'storage', 'thumbs'),
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      bucket: process.env.MINIO_BUCKET || 'lumisign',
      useSSL: false,
    },
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  cloudSync: {
    enabled: process.env.CLOUD_SYNC_ENABLED === 'true',
    url: process.env.CLOUD_SYNC_URL || '',
    token: process.env.CLOUD_SYNC_TOKEN || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@lumisign.io',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    adminName: process.env.SEED_ADMIN_NAME || 'Super Admin',
  },
};

export const isProd = config.nodeEnv === 'production';
