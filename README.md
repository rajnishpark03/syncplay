# SyncPlay

Real-time **Listen Together** / **Watch Together** — create a room, share
the 6-character code with anyone, and every device that joins it stays
perfectly synchronized: play, pause, seek, track changes, and playback
speed mirror instantly across the room, plus a built-in low-latency voice
chat over WebRTC. Joining doesn't require the same account — the room code
is the link, not the login email.

## Monorepo layout

```
apps/
  api/        NestJS backend — REST auth, Socket.IO realtime gateway, Prisma/Postgres, Redis
  web/        Next.js frontend — Web, and the shared source wrapped for iOS/Android (Capacitor) and Desktop (Tauri)
  desktop/    Tauri desktop shell around apps/web's static export
packages/
  shared/     Types, zod schemas, and the Socket.IO event contract shared between api and web
infra/
  docker/     Dockerfiles, docker-compose.yml, nginx.conf
docs/         ARCHITECTURE.md, API.md, SOCKET_EVENTS.md, DEPLOYMENT.md
```

Start with **`docs/ARCHITECTURE.md`** for how the sync engine and voice
chat actually work, and **`docs/SOCKET_EVENTS.md`** for the full realtime
protocol and the sub-100ms drift-correction algorithm.

## Quick start

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

npm install
npm run docker:up          # Postgres + Redis + API + Web + nginx
npm run prisma:migrate     # first time only
```

- Web: http://localhost:3000
- API + Swagger docs: http://localhost:4000/docs

No external accounts are required to run this locally — OTP login runs in
dev mode by default (the code is returned in the API response instead of
emailed). See `docs/DEPLOYMENT.md` for free-tier hosting, Capacitor
(mobile), and Tauri (desktop) build steps.

## Tech stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Framer Motion, React Query, Zustand
- **Backend**: NestJS, Socket.IO, Prisma, PostgreSQL, Redis, WebRTC signaling
- **Auth**: Email OTP + JWT (access/refresh)
- **Cross-platform**: Capacitor (iOS/Android), Tauri (Desktop) — one React codebase
- **Infra**: Docker, nginx, GitHub Actions CI

## What's out of scope by design

SyncPlay plays media through the standard HTML5 `<video>`/`<audio>` element
against a direct, self-hosted or licensed URL. It does not attempt to
control or bypass DRM on third-party apps (Spotify, YouTube, Netflix, etc.)
— see `docs/ARCHITECTURE.md#officially-supported-playback-only` for the
supported path to integrate a licensed provider's official SDK instead.

## Testing

```bash
npm run test:api        # unit tests
npm run test:api:e2e     # e2e tests (needs Postgres + Redis running)
```
