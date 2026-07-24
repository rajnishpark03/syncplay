# Orbit — Architecture

## Overview

Orbit syncs playback and voice across devices using a **shareable room
code** — a host creates a room (`POST /rooms`), gets a 6-character code, and
shares it with whoever they want to sync with. Anyone who joins that code
from any account (not necessarily the same email) is instantly in the same
session. One Socket.IO connection per device joins a Socket.IO room keyed by
the code (`room:<CODE>`) only after explicitly sending `room:join`; any
playback or voice event from one device then fans out to every other device
in that room.

Login (email OTP) still exists and still links every device signed into the
same account together for account-level features — the Profile screen's
"Connected Devices" list and presence (online/battery/ping) are per
*account*. But the actual watch/listen party — the thing with a timestamp
that has to match — is scoped to the room, not the account, so two different
people's accounts can sync with each other.

```
                         ┌────────────────────────┐
                         │        Clients          │
                         │  Web / iOS / Android /   │
                         │  Desktop (Capacitor +    │
                         │  Tauri wrap the Next.js  │
                         │  app; same React code)   │
                         └───────────┬──────────────┘
                     REST (auth)     │     Socket.IO (realtime)
                                     │     WebRTC (voice, peer-to-peer)
                         ┌───────────▼──────────────┐
                         │        NestJS API         │
                         │ ┌───────────────────────┐ │
                         │ │ AuthModule (OTP + JWT) │ │
                         │ │ DevicesModule          │ │
                         │ │ RoomsModule (code gen) │ │
                         │ │ ActivityModule         │ │
                         │ │ RealtimeGateway         │ │  <- Socket.IO
                         │ │  ├─ SyncService         │ │
                         │ │  └─ VoiceService (relay)│ │
                         │ └───────────────────────┘ │
                         └──────┬──────────────┬──────┘
                                │              │
                       ┌────────▼───┐   ┌──────▼──────┐
                       │ PostgreSQL │   │    Redis     │
                       │ (Prisma)   │   │ presence,    │
                       │ durable    │   │ hot sync     │
                       │ records    │   │ state,       │
                       │            │   │ Socket.IO    │
                       │            │   │ pub/sub      │
                       └────────────┘   └──────────────┘
```

## Why one client codebase covers four platforms

- **Web** — the Next.js app deployed directly (Vercel or the Docker image).
- **Desktop** — [Tauri](https://tauri.app) (`apps/desktop`) wraps the same
  app's static export in a native window (Rust shell, ~10MB, no Chromium
  bundle).
- **iOS / Android** — [Capacitor](https://capacitorjs.com) (configured in
  `apps/web/capacitor.config.ts`) wraps the same static export in a native
  WebView shell and exposes native device APIs (battery, background audio)
  the web platform can't reach directly.

No business logic is duplicated per platform — the sync engine, voice chat,
and every screen are plain React that runs identically everywhere. See
`docs/DEPLOYMENT.md` for the platform-specific build steps.

## Realtime sync engine

See `docs/SOCKET_EVENTS.md` for the full event contract and the
server-anchored position formula that keeps every device within the <100ms
target under good network conditions. In short:

1. The server is the single source of truth for "where is playback right
   now," stored as an anchor (`anchorPositionMs` @ `anchorServerTimeMs` +
   `playbackRate`), not a raw ticking clock.
2. Every device derives its own expected position from that anchor plus a
   clock-offset it measures against the server via a lightweight ping/pong
   (NTP-style), not from wall-clock trust between two arbitrary devices.
3. Each client compares its actual `<video>`/`<audio>` position against the
   expected position on a short interval and silently seeks back in sync
   once drift exceeds ~150ms — no visible pause, no re-buffering unless the
   network genuinely can't keep up.

State lives in Redis for hot reads/writes (sub-millisecond, and shared
across API instances behind a load balancer via the Socket.IO Redis
adapter), and is mirrored to Postgres asynchronously for durability
("resume where you left off" after a restart) — never on the broadcast path.

## Voice chat

Audio never touches the server. `RealtimeGateway` only relays WebRTC
signaling (SDP offers/answers, ICE candidates) between the two devices in an
account's room; the actual audio flows peer-to-peer once the WebRTC
connection is established, using Google's public STUN servers for NAT
traversal. `docs/DEPLOYMENT.md` covers when you'd add a TURN relay (blocked
by symmetric NAT/corporate firewalls) — not needed for typical home network
use.

## Officially-supported playback only

Orbit plays media through the standard HTML5 `<audio>`/`<video>` element
against a direct, self-hosted or licensed media URL you provide. It does
**not** attempt to control or bypass DRM on third-party apps like Spotify,
YouTube, or Netflix — those platforms don't expose a public API for remote
playback control, and reverse-engineering one would violate their terms of
service. If you want to sync a licensed streaming catalogue, the supported
path is to integrate that provider's official SDK/Web Playback API (e.g.
Spotify's Web Playback SDK) behind the same `TrackInfo`/`MediaSyncState`
contract — the sync engine itself is provider-agnostic.

## Folder structure

```
apps/
  api/            NestJS backend (Clean Architecture-ish: modules per domain)
  web/             Next.js frontend (App Router, feature-based components)
  desktop/         Tauri shell around apps/web's static export
packages/
  shared/          Types, zod schemas, and the Socket.IO event contract
                    shared verbatim between api and web
infra/
  docker/          Dockerfiles, docker-compose.yml, nginx.conf
docs/              This file, API.md, SOCKET_EVENTS.md, DEPLOYMENT.md
```
