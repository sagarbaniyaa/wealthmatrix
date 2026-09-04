# Deploying WealthMatrix Enterprise to Render

This gets the platform live on the public internet (`*.onrender.com` URLs
to start — a custom domain is a later, optional step). It uses
[Render](https://render.com) for all three pieces: the NestJS backend, the
Next.js frontend, and a managed Postgres database.

Some steps here can only be done by you (creating accounts, entering
billing details, authorizing GitHub) — those are marked **[YOU]**.
Everything else is already prepared in this repo.

## What's already done

- `.gitignore` — excludes `node_modules`, build output, and real `.env`
  files. Only `.env.example` files (placeholders) are tracked.
- A local git repo has been initialised and the first commit made.
- `render.yaml` — a Render "Blueprint" that defines all three services in
  one file, so Render can create them together instead of one at a time
  by hand.
- `backend/db/full_dump.sql` — a full `pg_dump` of the working local
  database (schema + the fictional demo data: 3 demo households, 15 demo
  funds, 34 providers, etc.). There's no standalone base `schema.sql` in
  this repo on its own — the incremental `migrations/002...005` files
  build on top of what this dump already contains — so restoring this
  dump is how a brand new, empty Postgres instance gets turned into a
  working copy of what you have locally.

## Part A — accounts **[YOU]**

1. **GitHub** — if you don't have an account, create one free at
   [github.com/signup](https://github.com/signup). Then create a new,
   empty repository (Settings you'll be asked for: a name like
   `wealthmatrix`, and **Private** is recommended since this is a real
   business platform, even with demo data in it). Don't initialise it
   with a README/.gitignore — this repo already has its own history.
2. **Render** — create a free account at
   [render.com](https://dashboard.render.com/register) — signing up
   "with GitHub" is the smoothest path since Render will need permission
   to read your repo anyway.
3. Come back here with the GitHub repository's URL (looks like
   `https://github.com/<you>/wealthmatrix.git`) and I'll push this code
   to it — or, if you'd rather do the push yourself, run this from
   `C:\Users\Asqui\Downloads\wealthmatrix-backend`:
   ```bash
   git remote add origin https://github.com/<you>/wealthmatrix.git
   git branch -M main
   git push -u origin main
   ```

## Part B — deploy the Blueprint

4. In the Render dashboard: **New +** → **Blueprint** → connect the
   `wealthmatrix` GitHub repo. Render reads `render.yaml` from the repo
   root and shows you three resources it's about to create:
   - `wealthmatrix-db` (Postgres, free tier)
   - `wealthmatrix-backend` (web service, root dir `backend`)
   - `wealthmatrix-frontend` (web service, root dir `frontend`)
5. Click **Apply**. Render provisions the database first, then builds and
   deploys both services. First build takes a few minutes — Render shows
   live logs.

## Part C — restore the database

The blueprint creates an *empty* Postgres — it has no tables yet.

6. Open the `wealthmatrix-db` resource in Render → **Connect** tab → copy
   the **External Database URL** (starts `postgresql://...`).
7. Restore the dump against it. From your own machine (with `psql`
   installed — Render's own docs also link a download), or ask me to run
   it for you if you paste me that URL in chat (it's fine to rotate/reset
   the password afterwards in Render's dashboard if you'd rather not
   leave it in the conversation):
   ```bash
   psql "<the External Database URL>" -f backend/db/full_dump.sql
   ```
   This creates every table, RLS policy, trigger, and the demo data
   (advisers, households, funds, providers) in one shot.

## Part D — the env vars only you can set

Render's free-tier security model won't let a blueprint commit a real
secret, and two more values genuinely can't be known until both services
have deployed once each (each one needs the OTHER's URL) — so these need
setting by hand in the dashboard:

8. **Backend** (`wealthmatrix-backend` → Environment):
   - `ANTHROPIC_API_KEY` — optional. Every AI feature (Wealth Analyst
     insights, Fund Analyst, Suitability Report narrative) degrades
     gracefully to a clear "unavailable" message without one — the
     platform is fully usable either way. Add a real key here later if
     you want the AI narratives to actually generate.
   - `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` — optional, same
     graceful-degradation story for the Provider Hub's "Send to
     Provider" button (it still builds the pack and logs the attempt
     without these; it just can't actually email it) AND for
     self-service password reset (`POST /auth/forgot-password` — without
     these, the reset token is still created, it just can't be emailed;
     see AuthService's own comment on why that's still correct rather
     than a rollback).
   - `FRONTEND_PUBLIC_URL` — **required for password reset to actually
     work** (not required for the platform to run). Once
     `wealthmatrix-frontend` has finished deploying, copy its URL (e.g.
     `https://wealthmatrix-frontend.onrender.com` — no trailing slash)
     and paste it in here. Save, then trigger **Manual Deploy → Deploy
     latest commit** on the backend service to pick it up.
9. **Frontend** (`wealthmatrix-frontend` → Environment):
   - `BACKEND_API_URL` — **required**. Once `wealthmatrix-backend` has
     finished deploying, copy its URL from the top of its Render page
     (e.g. `https://wealthmatrix-backend.onrender.com` — no trailing
     slash) and paste it in here. Save, then trigger **Manual Deploy →
     Deploy latest commit** on the frontend service to pick it up.

## Part E — verify

10. Open the frontend's Render URL. You should see the public marketing
    site. Log in with the same demo credentials as local:
    - Firm reference: `524e600b-d62d-469d-b697-22ced0fbcc07`
    - Adviser: `adviser@wealthmatrix.local` / `Demo1234!`
    - Client: `client@wealthmatrix.local` / `Demo1234!`

## Known limitations of the free tier

- **Cold starts**: a free Render web service spins down after ~15
  minutes of no traffic and takes 30-50s to wake up on the next request.
  Fine for a demo/review link; upgrade to a paid instance type to avoid
  this before showing it to anyone time-sensitive.
- **Free Postgres expires after 90 days** (Render deletes it, per their
  free-tier policy) unless you upgrade it to a paid plan before then.
- **CORS is currently wide-open** (`origin: true` in `main.ts`) — fine
  behind the fact that every real endpoint is still gated by the JWT +
  RLS + role checks, but worth tightening to the frontend's actual origin
  once you have a fixed URL/domain, rather than reflecting any origin.
- A **custom domain** (e.g. `app.yourfirm.com` instead of `*.onrender.com`)
  is a Render dashboard setting once you own a domain — ask if you want
  help with that step when you get there.
