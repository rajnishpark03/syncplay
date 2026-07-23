# REST API

Full interactive OpenAPI docs are served by the running API at **`/docs`**
(Swagger UI) — this file is a quick map, the source of truth is the
`@ApiOperation`/DTO decorators in `apps/api/src/**` and the generated spec.

Base URL (local dev): `http://localhost:4000`

## Auth (`/auth`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/otp/request` | — | `{ email }` | Sends a 6-digit OTP. In `OTP_DEV_MODE=true` (default), the code is returned as `devCode` in the response instead of emailed. |
| POST | `/auth/otp/verify` | — | `{ email, code, device: { deviceId, name, platform, appVersion? } }` | Verifies the code, upserts the user + device, returns `{ accessToken, refreshToken, expiresIn, userId }`. Same email on a second device links it to the same account automatically. |
| POST | `/auth/token/refresh` | — | `{ refreshToken }` | Rotates the token pair. Old refresh token is revoked. |
| POST | `/auth/logout` | Bearer | — | Revokes all refresh tokens for the current device. |
| GET | `/auth/me` | Bearer | — | Current account profile. |

## Rooms (`/rooms`)

The unit of syncing. Anyone can create one; anyone with the code can join —
joining does not require the same email as the host.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/rooms` | Bearer | `{ name? }` | Creates a room, returns `{ code, hostUserId, hostName, name, createdAt }`. `code` is a 6-character shareable code. |
| GET | `/rooms/:code` | Bearer | — | Looks up a room (used to validate a code before joining / show the host's name). 404 if it doesn't exist. |

Joining for real (i.e. actually entering the session) happens over the
socket — see `docs/SOCKET_EVENTS.md` § `room:join`. This REST endpoint only
confirms the code is valid.

## Devices (`/devices`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/devices` | Bearer | Every device linked to the account, with live presence (`isOnline`, `pingMs`, `batteryLevel`, `networkQuality`, `lastSeenAt`). |

## Activity (`/activity`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/activity?limit=20` | Bearer | Account-level activity feed (device connect/disconnect etc). |
| GET | `/activity/room/:code?limit=20` | Bearer | Activity feed for a specific room's session. |

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness probe for the Docker/CI setup. |

## Realtime

Everything playback- and voice-related is **not** REST — it's the
Socket.IO contract documented in `docs/SOCKET_EVENTS.md`. REST only handles
account/session bootstrapping; once a device has a token, it connects a
socket and the rest of the app's behavior is event-driven.
