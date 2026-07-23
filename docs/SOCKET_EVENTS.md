# Realtime event contract

One Socket.IO connection per device, authenticated via JWT passed as
`{ auth: { token } }` in the handshake. Connecting only authenticates the
device — it does **not** put it in any playback/voice room. A device must
explicitly send `room:join` with a room code (from `POST /rooms` or a code
someone shared with it) before it sends/receives any sync or voice traffic.
That's the whole mechanism behind "share a code, not an email" — the
Socket.IO room is keyed by the room code (`room:<CODE>`), not by account id.

On `room:join`, the server:

1. Looks up the room by code; emits `error` (`ROOM_NOT_FOUND`) and does
   nothing else if it doesn't exist.
2. Joins the socket to `room:<CODE>` and registers the device in that room's
   presence set (Redis).
3. Emits `room:joined` (room info + current member list) and `media:state`
   back to the joining socket, and `room:member-joined` to everyone else
   already in the room.

All payload types live in `packages/shared/src/socket-events.ts` — this doc
describes the *protocol*, the source of truth for exact shapes is that file.

## Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `room:join` | `{ deviceId, roomCode }` | Join a room by its shareable code — required before any media/voice event |
| `room:leave` | — | Leave the current room |
| `device:heartbeat` | `{ deviceId, batteryLevel?, networkQuality?, pingMs? }` | Periodic account-level presence/telemetry update |
| `media:play` | `{ deviceId, positionMs, clientTimestamp }` | Start/resume playback at `positionMs` |
| `media:pause` | `{ deviceId, positionMs, clientTimestamp }` | Pause at `positionMs` |
| `media:seek` | `{ deviceId, positionMs, clientTimestamp }` | Jump to `positionMs` without changing play state |
| `media:changeTrack` | `{ deviceId, track, positionMs, autoplay, clientTimestamp }` | Switch the active track/video |
| `media:speedChange` | `{ deviceId, rate, clientTimestamp }` | Change playback rate (0.5x–2x) |
| `media:volumeChange` | `{ deviceId, volume }` | Change volume (0–1); local-only convenience, not usually broadcast-critical |
| `sync:ping` | `{ deviceId, clientTimestamp }` | RTT / clock-offset measurement (see below) |
| `sync:requestState` | — | Ask for a fresh `media:state` snapshot |
| `voice:join` | `{ deviceId }` | Join the current room's voice channel |
| `voice:leave` | `{ deviceId }` | Leave the voice room |
| `voice:signal` | `{ deviceId, targetDeviceId, signal }` | Relay a WebRTC offer/answer/ICE candidate |
| `voice:muteChange` | `{ deviceId, muted }` | Broadcast local mute state to peers (UI indicator only) |

## Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `room:joined` | `{ room: RoomInfo, members: RoomMember[] }` | Confirms a successful `room:join`, with the full current member list |
| `room:member-joined` / `room:member-left` | `RoomMember` / `{ deviceId }` | Room membership deltas |
| `media:state` | `MediaSyncState` | Authoritative playback state — see below |
| `sync:pong` | `{ clientTimestamp, serverTimestamp }` | Reply to `sync:ping` |
| `activity:new` | `ActivityEntry` | Feed item for the Home screen's Recent Activity card |
| `voice:peer-joined` / `voice:peer-left` | `{ deviceId, deviceName }` / `{ deviceId }` | Voice room membership changes |
| `voice:participants` | `string[]` | Sent to a device right after `voice:join`: the peer deviceIds already in the voice channel, so it knows who to send WebRTC offers to |
| `voice:signal` | `{ fromDeviceId, signal, targetDeviceId }` | Relayed WebRTC signaling |
| `voice:peer-muteChange` | `{ deviceId, muted }` | Peer mute indicator |
| `error` | `{ code, message }` | `UNAUTHENTICATED`, `ROOM_NOT_FOUND`, `NOT_IN_ROOM` (tried to control playback before joining a room), etc. |

## The sync algorithm

### 1. Server-anchored position, not a shared clock

`MediaSyncState` never carries a raw "current time." It carries an anchor:

```ts
{
  anchorPositionMs: number;     // position at the anchor moment
  anchorServerTimeMs: number;   // server Date.now() when that was true
  playbackRate: number;
  state: 'idle' | 'playing' | 'paused' | 'buffering';
}
```

Every device computes the *live* position the same way:

```
if state == 'playing':
  positionMs = anchorPositionMs + (nowMs - anchorServerTimeMs) * playbackRate
else:
  positionMs = anchorPositionMs
```

This is what makes two devices agree on "where we are" even if one of them
received the last update 200ms later than the other — both converge to the
same formula, not to "whatever the last message said."

### 2. Clock offset (NTP-style)

`nowMs` above has to be in the *server's* clock frame, not the device's
local clock (phones/laptops can be seconds off from real time). Each client
pings every 4s:

```
client:  emit sync:ping { clientTimestamp: T0 }
server:  emit sync:pong { clientTimestamp: T0, serverTimestamp: Ts }
client:  T1 = now()
         rtt = T1 - T0
         offset = Ts - (T0 + rtt / 2)      // server time − local time
         latencyMs = rtt / 2
```

`offset` is then added to `Date.now()` locally before plugging into the
position formula. This is the standard two-timestamp NTP approximation —
accurate to roughly half the RTT, which is why the target of <100ms sync
assumes normal home-network RTTs (well under 200ms).

### 3. Drift correction loop

Every ~800ms, each client compares its actual `<video>/<audio>.currentTime`
against the expected position from step 1. If the difference exceeds
**150ms**, it silently seeks the element back in sync — no pause, no
buffering indicator, just a snap that's imperceptible at that magnitude.
Smaller drift is left alone to avoid visible micro-stutter from
over-correcting.

### 4. Why Redis, not just Postgres, for the hot path

`SyncService` keeps the current `MediaSyncState` in Redis
(`sync:state:<userId>`) and mutates it directly on every play/pause/seek —
sub-millisecond, and shared across API instances via the same Redis
instance if you ever scale horizontally. Postgres (`MediaSession` table) is
updated asynchronously right after, purely so a restart doesn't lose "what
was playing" — it is never awaited before broadcasting to clients.

## Voice signaling

`voice:signal` is a dumb relay — the server never parses the SDP/ICE
payload, it just forwards `{ fromDeviceId, signal, targetDeviceId }` to
everyone else in the room except the sender. The 2-participant mesh means
in practice only the intended target receives it, but `targetDeviceId` is
included so the protocol scales to >2 participants later without a breaking
change.
