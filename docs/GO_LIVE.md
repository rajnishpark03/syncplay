# Go Live — deploy Orbit for free

Four free services, no credit card needed for any of them. Do them in order.
Keep a note open to paste values between steps.

```
Neon (Postgres)  ─┐
Upstash (Redis)  ─┤→  Render (backend API)  →  Vercel (frontend)
Gmail App Pass   ─┘
```

Total time: ~20–30 min the first time.

---

## 1. Database — Neon (free Postgres)

1. Go to https://neon.tech → sign up (with Google / `spyrajnish@gmail.com`).
2. Create a project (any name, e.g. `orbit`). Pick the region nearest you.
3. On the project dashboard, find **Connection string** → copy the one that
   looks like `postgresql://user:pass@ep-xxxx.aws.neon.tech/neondb?sslmode=require`.
4. **Save it** — this is your `DATABASE_URL`.

## 2. Redis — Upstash (free)

1. Go to https://upstash.com → sign up.
2. **Create Database** → Redis → pick a region → Create.
3. On the database page, scroll to connect options and copy the
   **`redis://...`** URL (the one starting `rediss://` with TLS is best).
4. **Save it** — this is your `REDIS_URL`.

## 3. Gmail App Password (for real OTP emails)

1. The Google account you'll send from (`spyrajnish@gmail.com`) needs
   **2‑Step Verification ON**: https://myaccount.google.com/security
2. Then open https://myaccount.google.com/apppasswords
3. Create an app password (name it "Orbit"). Google shows a 16‑character
   password like `abcd efgh ijkl mnop`.
4. **Save it with the spaces removed** → `abcdefghijklmnop`. This is your
   `SMTP_PASS`.

## 4. Backend — Render

1. Go to https://render.com → sign up → connect your GitHub.
2. **New → Blueprint** → pick the `rajnishpark03/orbit` repo. Render reads
   `render.yaml` and proposes the `orbit-api` service → **Apply**.
3. When it asks for the env vars marked "not set", fill in:
   - `DATABASE_URL` → your Neon string (from step 1)
   - `REDIS_URL` → your Upstash string (from step 2)
   - `SMTP_USER` → `spyrajnish@gmail.com`
   - `SMTP_PASS` → your Gmail app password (from step 3)
   - `CORS_ORIGIN` → leave as `*` for now; you'll set it to the Vercel URL in step 6.
4. Deploy. When it's live, copy the service URL, e.g.
   `https://syncplay-api.onrender.com` → **save it** as your API URL.
5. Test it: open `https://syncplay-api.onrender.com/health` — should show
   `{"status":"ok",...}`. (First load may take ~50s — free services sleep when idle.)

## 5. Frontend — Vercel

1. Go to https://vercel.com → sign up → import the `rajnishpark03/orbit` repo.
2. Vercel reads `vercel.json`. **Important:** leave the Root Directory as the
   repo root (do NOT set it to `apps/web`).
3. Add one Environment Variable:
   - `NEXT_PUBLIC_API_URL` = your Render API URL (from step 4),
     e.g. `https://syncplay-api.onrender.com`
4. Deploy. You'll get a URL like `https://orbit-xxxx.vercel.app` →
   **save it**.

## 6. Connect the two (CORS)

1. Back in **Render** → your service → Environment → set
   `CORS_ORIGIN` = your Vercel URL (e.g. `https://orbit-xxxx.vercel.app`,
   no trailing slash) → save → it redeploys.
2. Done. Open the Vercel URL on both your and your partner's devices, sign in
   with the same flow, create a room, share the code. 🎉

---

## Notes & gotchas

- **HTTPS is required** for microphone (voice) and screen share. Both Vercel
  and Render give you HTTPS automatically, so this "just works" once deployed
  — unlike `localhost` testing across two devices.
- **Free backend sleeps** after ~15 min idle and cold-starts in ~50s. The
  first action after a break feels slow; after that it's instant.
- **Turn off dev OTP:** the blueprint already sets `OTP_DEV_MODE=false`, so
  codes are emailed (not shown on screen). If email ever fails, check the
  Render logs and your `SMTP_*` values.
- **Custom domain** (optional, later): add one in Vercel; then update
  `CORS_ORIGIN` on Render to match.
- **Netflix/DRM** still can't be embedded — use screen share (with its
  black-screen caveat) or a dedicated watch-party extension.
