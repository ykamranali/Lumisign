# LumiSign Enterprise — Real-Time Digital Signage Management System

A production-oriented, full-stack Digital Signage CMS for monitoring, managing, scheduling, and
controlling unlimited displays (TVs / players) in real time over LAN, with optional cloud sync.

> Built as a modular, scalable, secure monorepo: **Node.js backend** (Express + Socket.IO + PostgreSQL),
> **React/Next.js dashboard** (NOC-style UI), and a **lightweight TV Player** (web, modeling native
> Android TV / Windows / Linux players). Real-time is delivered over **Socket.IO** (WebSocket) with
> optional **MQTT-style** Redis pub/sub for multi-instance deployments.

---

## Features

| Area | Status | Notes |
|------|--------|-------|
| Real-time device monitoring (CPU/RAM/Storage/Temp/Net/Vol/Bright/…) | ✅ | Socket.IO heartbeat every 5s |
| Remote control (play, pause, stop, next, reboot, screenshot, volume, brightness, rotate, …) | ✅ | Instant command queue + ack |
| LAN auto-discovery (UDP beacon + HTTP beacon) | ✅ | Approve / reject before enrollment |
| Device registration (auth token + encryption key generation) | ✅ | Per-device JWT-style device token |
| Media library (images, video, PDF, PPTX, audio, YouTube, IPTV, RSS, Weather, Clock, Web/HTML) | ✅ | Drag-drop upload, thumbnails, web sources |
| Playlist builder (drag-reorder, loop, shuffle, emergency, priority, transitions) | ✅ | Drag & drop items |
| Scheduling (daily/weekly/monthly/date/holiday, multiple targets, priority, expiry) | ✅ | Per-device & per-group |
| Live network topology map (animated SVG, glow status) | ✅ | Replaces Three.js for zero-dep runnability |
| Dashboard stat cards (animated, glowing) | ✅ | Live via Socket.IO + polling fallback |
| Analytics (CPU/RAM trends, content usage, uptime, health, export) | ✅ | Custom animated SVG charts |
| User management + RBAC (Super Admin → Viewer, custom roles) | ✅ | Permission engine in `auth.js` |
| Notifications (offline, storage, playback failed, new device, security…) | ✅ | Glowing notification center |
| Security (JWT, RBAC, helmet, rate-limit, input validation, audit logs, sessions) | ✅ | |
| Logging (user/playback/device/download/error/api/auth/audit) + search/export | ✅ | |
| REST API + Swagger/OpenAPI docs (`/api-docs`) | ✅ | |
| Docker deployment (Postgres, Redis, MinIO, Nginx) | ✅ | `docker-compose.yml` |
| TV Player application | ✅ | Web player at `/player` (model for native players) |

### Implemented as functional equivalents (clearly noted)
- **Three.js network map** → animated SVG topology (no native WebGL dependency; easier to run).
- **Chart.js** → custom animated SVG line/bar charts (no extra dependency).
- **Native Android TV / Windows player** → a full **web player** (`server/player/`) that implements the
  complete protocol (register, heartbeat, assignment, commands). Native players would implement the same
  Socket.IO contract (`server/src/realtime.js`) in Kotlin/Java/C#.
- **MinIO / FFmpeg transcoding** → storage abstraction supports `local` and `minio` backends; transcoding
  hooks are left as a documented extension point (FFmpeg can be wired in `server/src/routes/media.js`).

---

## Architecture

```
┌────────────┐   Socket.IO / REST   ┌──────────────────┐   pg / redis    ┌──────────────┐
│  Dashboard │ ───────────────────▶ │   LumiSign API    │ ◀────────────▶ │  PostgreSQL   │
│  (Next.js) │                      │  (Express+Socket) │                 │  Redis        │
└────────────┘                      └──────────────────┘                 └──────────────┘
                                          ▲      │
                              UDP/HTTP     │      │ commands / heartbeats
                              beacon       │      ▼
┌────────────┐                      ┌──────────────────┐
│  TV Player │ ───────────────────▶ │  Device Registry  │
│  (/player) │ ◀──── commands ──────│  (in-memory + DB) │
└────────────┘                      └──────────────────┘
```

- **Backend**: `server/` — Express REST + Socket.IO realtime hub, PostgreSQL schema, Redis cache/pub-sub,
  LAN UDP discovery, JWT auth, RBAC, audit logging.
- **Frontend**: `web/` — Next.js App Router dashboard with glassmorphism / neon NOC theme, Framer Motion
  animations, React Query, Zustand realtime store.
- **Player**: `server/player/` — static web player served at `/player`. Talks the exact same protocol a
  native player would.

---

## Quick Start (Docker — recommended)

```bash
cp .env.example .env        # adjust secrets
docker compose up -d --build
```

- Dashboard:      http://localhost:3000
- API + Docs:     http://localhost:4000/api-docs
- TV Player:      http://localhost:4000/player   (or http://localhost/player via Nginx)
- Default admin:  `admin@lumisign.io` / `Admin@12345`  (configure via `SEED_ADMIN_*` in `.env`)

For cloud-only / remote management, set `CLOUD_SYNC_ENABLED=true` and point `CORS_ORIGIN` at your dashboard URL.

---

## Manual Development

### Backend (`server/`)
```bash
cd server
cp ../.env.example .env          # set DB_HOST=localhost, REDIS_ENABLED=false (optional)
npm install
# have PostgreSQL available, then:
npm run migrate                  # create schema
npm run seed                     # create admin user
npm start                        # http://localhost:4000
```
Health: `GET /health` · Swagger: `GET /api-docs`.

### Frontend (`web/`)
```bash
cd web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:4000" >> .env.local
npm run dev                      # http://localhost:3000
```

### TV Player
Open `http://localhost:4000/player` in a browser (or fullscreen on a TV/box). It will:
1. self-register (`POST /api/devices/register`),
2. send a LAN beacon,
3. connect via Socket.IO once **approved** in the dashboard,
4. receive its assigned playlist and play it, reporting heartbeat telemetry every 5s.

Approve the device from **Dashboard → Devices → Network Discovery**.

---

## Deployment (full stack on a PaaS)

Because the backend needs always-on WebSockets (Socket.IO) plus PostgreSQL/Redis, deploy the **whole
stack** on a server-friendly platform rather than a static host (Vercel can only run the dashboard).

### Option A — Render (recommended, managed Postgres + Redis)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect the repo. The included `render.yaml` creates:
   `lumisign-db` (Postgres 16), `lumisign-redis`, `lumisign-server` (API), `lumisign-web` (dashboard).
3. After deploy, set these env vars (Render can’t auto-resolve web-service URLs):
   - `lumisign-server` → `CORS_ORIGIN` = `https://<lumisign-web>.onrender.com`
   - `lumisign-web` → `NEXT_PUBLIC_API_URL` = `https://<lumisign-server>.onrender.com`
   - `lumisign-web` → `NEXT_PUBLIC_SOCKET_URL` = `https://<lumisign-server>.onrender.com`
4. Open the dashboard URL, log in with the seeded admin, and open the player at
   `https://<lumisign-server>.onrender.com/player`.

### Option B — Any VPS with Docker
```bash
cp .env.example .env      # set strong JWT_SECRET, DB/Redis creds
docker compose up -d --build
```
Dashboard: `http://<server-ip>:3000`, API: `http://<server-ip>:4000`, Player: `http://<server-ip>:4000/player`.
The bundled `nginx` service proxies everything on port 80 (optional; remove it if not needed).

### Notes
- The default admin is `admin@lumisign.io` / `Admin@12345` (change via `SEED_ADMIN_*`).
- Free-tier web services spin down when idle; the first request after idle may take a few seconds.
- For production, set `CORS_ORIGIN` to your real dashboard domain, use strong secrets, and consider
  upgrading the database/Redis plans.

---

## REST API

Full OpenAPI docs are served at `/api-docs`. Key groups:

- **Auth**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/roles`
- **Devices**: `GET /api/devices`, `POST /api/devices`, `GET /api/devices/:id`,
  `POST /api/devices/:id/command`, `POST /api/devices/:id/assign`,
  `GET|POST|DELETE /api/devices/discovery`, `POST /api/devices/discovery/:id/approve`,
  groups under `/api/devices/groups`
- **Media**: `GET|POST /api/media`, `POST /api/media/upload`, `POST /api/media/web`, `GET /api/media/:id/file`
- **Playlists**: `GET|POST /api/playlists`, `GET|PATCH|DELETE /api/playlists/:id`, `POST /api/playlists/:id/duplicate`
- **Schedules**: `GET|POST /api/schedules`, `GET|PATCH|DELETE /api/schedules/:id`
- **Users**: `GET|POST /api/users`, `GET|PATCH|DELETE /api/users/:id`
- **Analytics**: `GET /api/analytics/stats`, `/metrics`, `/playback-history`, `/content-usage`, `/uptime`, `/health`, `/export`
- **Logs**: `GET /api/logs`, `GET /api/logs/export`, `DELETE /api/logs/purge`
- **Notifications**: `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- **Updates**: `GET|POST /api/updates`, `GET /api/updates/check/:version`
- **Sample data**: `POST /api/seed/sample` (clearly-labelled test data)

All routes (except device self-registration & LAN beacon) require a `Bearer` JWT.

## Realtime Protocol (Socket.IO)

**Player** connects with `auth: { token: <deviceToken>, type: 'player' }` and emits:
- `player:register` / `player:heartbeat` / `player:metrics` / `player:command:ack` /
  `player:screenshot` / `player:log`
- receives: `command`, `assignment`, `config:push`, `player_update_available`

**Dashboard** connects with `auth: { token: <jwt>, type: 'dashboard' }` and receives:
- `device:update`, `device:online`, `device:offline`, `discovery:new`, `notification`,
  `player_update_available`

---

## Security

- JWT auth with configurable expiry; revocable server-side sessions.
- Role-based access control with a granular `resource:action` permission engine.
- `helmet` headers, CORS allowlist, global rate limiting, Zod input validation on all routes.
- Passwords hashed with `bcrypt`; device tokens are random 48-byte hex; AES-ready encryption-key column.
- Audit log for auth, device, user, and playback actions; searchable/exportable.

---

## Scaling Notes

- The device registry is in-memory per instance; **Redis pub/sub** mirrors broadcasts across instances
  (enable `REDIS_ENABLED=true`). For >10k devices, run multiple API replicas behind a load balancer and
  shard PostgreSQL (read replicas + partitioning of `device_metrics`).
- `device_metrics` is throttled (one row per device per 15s) to bound write volume.
- Media delivery uses object storage (MinIO/S3) with token-auth URLs; browsers fetch via `?token=`.
- The web player is a reference client; native players implement the same Socket.IO contract and can run
  as a background service with auto-start, offline cache, and self-healing.

---

## Testing

```bash
cd server && npm run test        # node:test smoke (import graph + auth logic)
cd server && node test/smoke.mjs  # explicit import-graph + pure-logic checks
```

---

## Project Structure

```
.
├── docker-compose.yml
├── nginx/nginx.conf
├── .env.example
├── server/
│   ├── src/
│   │   ├── index.js            # bootstrap, HTTP + Socket.IO, resilience
│   │   ├── config.js db.js redis.js auth.js realtime.js discovery.js seed.js swagger.js logger.js utils.js
│   │   ├── routes/             # auth, devices, media, playlists, schedules, users, analytics, logs, notifications, updates
│   │   └── schema.sql          # PostgreSQL schema
│   ├── player/                 # static TV player (served at /player)
│   └── test/smoke.mjs
└── web/
    └── src/
        ├── app/                # (app) NOC pages + login
        ├── components/         # Sidebar, TopBar, StatCard, NetworkMap, DeviceCard, ControlDrawer, NotificationCenter, Charts
        ├── lib/                # api, socket, auth helpers
        └── store/              # zustand realtime store
```

---

## License

MIT — internal enterprise use.
