-- LumiSign Enterprise — Database Schema (PostgreSQL 16)
-- Run automatically on server boot by src/db.js

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users & Roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  role              VARCHAR(50)  NOT NULL DEFAULT 'viewer',
  permissions       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Device Groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Devices (TVs / Players)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id         VARCHAR(255) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  mac               VARCHAR(255),
  ip                VARCHAR(64),
  hostname          VARCHAR(255),
  os                VARCHAR(255),
  player_version    VARCHAR(64),
  firmware_version  VARCHAR(64),
  resolution        VARCHAR(32),
  vendor            VARCHAR(255),
  device_type       VARCHAR(64),
  group_id          UUID REFERENCES device_groups(id) ON DELETE SET NULL,

  auth_token        VARCHAR(512),
  encryption_key    VARCHAR(512),

  approved          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Live telemetry
  status            VARCHAR(32) NOT NULL DEFAULT 'offline',
  connection_status VARCHAR(32) NOT NULL DEFAULT 'disconnected',
  cpu               REAL,
  ram               REAL,
  storage           REAL,
  temperature       REAL,
  network_speed     REAL,
  volume            INT,
  brightness        INT,
  orientation       VARCHAR(16) DEFAULT 'landscape',
  current_playlist  VARCHAR(255),
  current_media     VARCHAR(255),
  playback_position REAL,
  last_screenshot   VARCHAR(512),
  update_status     VARCHAR(64),
  error_logs        JSONB NOT NULL DEFAULT '[]'::jsonb,
  location          VARCHAR(255),
  last_heartbeat    TIMESTAMPTZ,
  last_restart      TIMESTAMPTZ,
  uptime            BIGINT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_approved ON devices(approved);

-- ---------------------------------------------------------------------------
-- Device telemetry history (for analytics / trends)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_metrics (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id         UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  cpu               REAL,
  ram               REAL,
  storage           REAL,
  temperature       REAL,
  network_speed     REAL,
  connection_status VARCHAR(32),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_device_time ON device_metrics(device_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Media Library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(64) NOT NULL, -- image, video, pdf, html, youtube, iptv, rss, weather, clock, camera, audio, pptx, webpage
  mime        VARCHAR(255),
  path        VARCHAR(512),
  url         VARCHAR(1024),
  thumbnail   VARCHAR(512),
  size        BIGINT,
  duration    REAL,
  checksum    VARCHAR(128),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);

-- ---------------------------------------------------------------------------
-- Playlists
-- items JSONB: [ { "mediaId": uuid, "duration": 10, "transition": "fade" } ]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlists (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  loop         BOOLEAN NOT NULL DEFAULT TRUE,
  shuffle      BOOLEAN NOT NULL DEFAULT FALSE,
  priority     INT NOT NULL DEFAULT 0,
  emergency    BOOLEAN NOT NULL DEFAULT FALSE,
  conditional  BOOLEAN NOT NULL DEFAULT FALSE,
  interactive  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Schedules
-- type: daily | weekly | monthly | date | holiday
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  playlist_id  UUID REFERENCES playlists(id) ON DELETE CASCADE,
  device_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
  type         VARCHAR(32) NOT NULL DEFAULT 'daily',
  start_time   TIME,
  end_time     TIME,
  days         JSONB,        -- e.g. [1,2,3,4,5] for weekly (0=Sun)
  specific_dates JSONB,      -- e.g. ["2026-12-25"] for date/holiday
  timezone     VARCHAR(64) DEFAULT 'UTC',
  priority     INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Command queue (player control)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  type        VARCHAR(64) NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status);

-- ---------------------------------------------------------------------------
-- Logs & Audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level     VARCHAR(16) NOT NULL DEFAULT 'info',
  category  VARCHAR(64) NOT NULL, -- user, playback, device, download, error, api, auth, audit
  source    VARCHAR(255),
  message   TEXT NOT NULL,
  meta      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_category_time ON logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       VARCHAR(64) NOT NULL,
  severity   VARCHAR(16) NOT NULL DEFAULT 'info',
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  device_id  UUID REFERENCES devices(id) ON DELETE CASCADE,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read, created_at DESC);

-- ---------------------------------------------------------------------------
-- Player software updates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_updates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version    VARCHAR(64) NOT NULL,
  url        VARCHAR(1024) NOT NULL,
  mandatory  BOOLEAN NOT NULL DEFAULT FALSE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Secure sessions (revocable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Roles / permission defaults (reference table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  name        VARCHAR(50) PRIMARY KEY,
  permissions JSONB NOT NULL
);

INSERT INTO roles (name, permissions) VALUES
  ('super_admin', '{"*":true}'::jsonb),
  ('administrator', '{"devices":"*","media":"*","playlists":"*","schedules":"*","users":"read","reports":"*","logs":"*","notifications":"*","updates":"*"}'::jsonb),
  ('operator', '{"devices":"*","media":"read","playlists":"read","schedules":"read","reports":"read","logs":"read","notifications":"*"}'::jsonb),
  ('content_manager', '{"devices":"read","media":"*","playlists":"*","schedules":"*","reports":"read"}'::jsonb),
  ('viewer', '{"devices":"read","media":"read","playlists":"read","schedules":"read","reports":"read","logs":"read"}'::jsonb)
ON CONFLICT (name) DO NOTHING;
