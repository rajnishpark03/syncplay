# Deployment

## Local development (no cost)

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp .env.example .env               # only needed by docker-compose

npm install
npm run docker:up                  # postgres + redis + api + web + nginx
# or, without Docker:
#   run postgres/redis yourself, then:
npm run prisma:migrate
npm run dev
```

- API: http://localhost:4000 (Swagger at `/docs`)
- Web: http://localhost:3000
- Through nginx (mirrors the production topology): http://localhost:8080

OTP codes are never emailed in dev mode (`OTP_DEV_MODE=true`) — they come
back in the `/auth/otp/request` response and are logged, so login works
with zero external accounts.

## Free-tier production deployment (small scale — a couple of accounts)

You do **not** need AWS or a domain to run this for real. A fully free
setup:

| Piece | Service | Why |
|---|---|---|
| Frontend (Next.js) | **Vercel** free tier | Free `*.vercel.app` subdomain, first-class Next.js support |
| API + Socket.IO (needs a long-lived process — won't run on Vercel serverless) | **Render** or **Railway** free tier | Free `*.onrender.com` / `*.up.railway.app` subdomain, persistent WebSocket support |
| PostgreSQL | **Neon** or **Supabase** free tier | Free managed Postgres |
| Redis | **Upstash** free tier | Free managed Redis, works fine at this traffic level |
| Voice chat (WebRTC) | Google public STUN (already configured) | Free; sufficient unless both devices are behind restrictive/symmetric NAT |

Steps:

1. **Database**: create a free Neon/Supabase Postgres, copy its connection
   string into `DATABASE_URL` on the API host, run `npm run prisma:deploy`.
2. **Redis**: create a free Upstash Redis, copy its URL into `REDIS_URL`.
3. **API**: deploy `apps/api` (Dockerfile provided) to Render/Railway. Set
   `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `CORS_ORIGIN` (your Vercel URL) as env vars.
4. **Web**: deploy `apps/web` to Vercel. Set `NEXT_PUBLIC_API_URL` to your
   Render/Railway API URL.
5. Done — no domain purchase, no AWS bill.

Scale up later (custom domain, AWS/GCP, a TURN relay for restrictive
networks) only if/when you actually need it; nothing here is a dead end.

## Switching OTP from dev-mode to real email

`OTP_DEV_MODE=false` in `apps/api/.env` disables the `devCode` bypass. Wire
one of these into `AuthService.requestOtp` (see the TODO marker there):

- **Gmail SMTP** (free, simplest for personal use) — create a
  [Google App Password](https://myaccount.google.com/apppasswords) for your
  Gmail account and send via `nodemailer` with `smtp.gmail.com:587`.
- **Resend** (free tier: 100 emails/day, 3000/month) — better if you outgrow
  Gmail's sending limits.

Set `EMAIL_*` vars in `apps/api/.env` either way.

## Docker (self-hosted, e.g. a VPS)

```bash
docker compose -f infra/docker/docker-compose.yml up --build -d
```

Brings up Postgres, Redis, the API, the Next.js web app, and an nginx
reverse proxy on `:8080` that routes REST + Socket.IO to the API and
everything else to the web app (see `infra/docker/nginx/nginx.conf`).

## Mobile (Capacitor — iOS & Android)

Capacitor wraps a **static export** of the Next.js app, not the normal
server-rendered build:

```bash
cd apps/web
BUILD_EXPORT=true npm run build   # outputs ./out
npx cap sync
npx cap open ios       # requires Xcode
npx cap open android   # requires Android Studio
```

Set `NEXT_PUBLIC_API_URL` at build time to your deployed API's HTTPS URL —
a static mobile build can't talk to `localhost`. For on-device hot reload
during development, point `server.url` in `apps/web/capacitor.config.ts` at
your machine's LAN IP running `next dev`.

Native permissions needed:
- **Microphone** (voice chat / WebRTC) — Capacitor's WebView prompts for
  this automatically the first time `getUserMedia` is called; no extra
  plugin required for the base flow.
- Background audio playback (keep music playing while backgrounded) is a
  platform-level capability, not covered by the default WebView — add the
  `@capacitor-community/background-mode` (or equivalent) plugin when you're
  ready for that polish.

## Desktop (Tauri)

```bash
cd apps/desktop
npm run build:web-export   # builds apps/web with the static export config
npm run dev                 # or: npm run build   (requires Rust + cargo)
```

Requires the Rust toolchain (`rustup`) installed once, per
https://tauri.app/start/prerequisites/. `apps/desktop/src-tauri/tauri.conf.json`
points at `../../web/out`, the same static export Capacitor uses.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`: installs deps,
builds the shared package, runs Prisma migrations against a throwaway
Postgres/Redis service container, lints and builds both apps, runs the
backend unit + e2e test suite, then does a Docker build sanity-check for
both images. Add a deploy job (Vercel CLI / Render deploy hook) once you've
picked concrete hosting targets.
