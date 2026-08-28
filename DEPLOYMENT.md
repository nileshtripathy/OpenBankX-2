# Deployment Guide

OpenBankX has three deployable pieces: the **backend** API (stateful process — DB
connections, Socket.IO, cron jobs), the **frontend** (a static Vite build), and the
**contracts** (deployed once to a chain, not redeployed alongside the app). This
doc covers the backend and frontend; contract deployment is covered in
`contracts/README` / `docs/HLD.md`.

## 1. Local / self-hosted: Docker Compose

The simplest path, and what `docker-compose.yml` at the repo root is built for:

```bash
cp backend/.env.example backend/.env   # fill in MONGO_URI, JWT secrets, contract addresses, etc.
docker compose up --build -d
docker compose logs -f backend         # watch startup, blockchain sync, cron jobs
```

This builds both Docker images, then starts Mongo, Redis, the API, and the
frontend (served by nginx) on a shared network. `backend`'s healthcheck hits
`GET /api/health`; `frontend`'s hits nginx's `/health`.

To stop: `docker compose down` (add `-v` to also drop the Mongo/Redis volumes).

### Rebuilding after code changes
```bash
docker compose up --build backend    # just the API
docker compose up --build frontend   # just the frontend (re-bakes VITE_API_URL)
```

## 2. Backend: standalone container on any PaaS

The backend `Dockerfile` builds a self-contained image with no build-time
dependency on the frontend or contracts. Any platform that runs a Docker
image and lets you set env vars works (Render, Railway, Fly.io, ECS, a bare
VM with `docker run`, etc.):

```bash
docker build -t openbankx-backend ./backend
docker run -p 5000:5000 --env-file backend/.env openbankx-backend
```

Required env vars are documented in `backend/.env.example`. At minimum for
production:

| Variable | Notes |
|---|---|
| `MONGO_URI` | Managed MongoDB (Atlas) strongly recommended over self-hosting Mongo in prod |
| `REDIS_URL` | Optional — app runs without it, just without caching. A managed Redis (Upstash, Redis Cloud) is a one-line env var swap |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — never reuse the dev values |
| `BANK_TOKEN_ENCRYPTION_KEY` | Same generation method; **required** in production, the app refuses to boot without it (see `config/env.ts`) |
| `CLIENT_URL` | Your deployed frontend origin — used for CORS and the cookie's implicit domain |
| `RPC_URL`, `VAULT_CONTRACT_ADDRESS`, `SWAP_CONTRACT_ADDRESS` | Point at a real network (testnet/mainnet) once contracts are deployed there |

Platform notes:
- The container exposes port `5000` and has a `HEALTHCHECK` baked in — platforms that do their own health probing (Render, Fly) can point at `/api/health` directly instead.
- Socket.IO needs **sticky sessions** if you run more than one backend replica behind a load balancer (or switch its adapter to the Redis adapter — `socket.io` supports this via `@socket.io/redis-adapter`, which the existing `redis` client here is compatible with, if you scale beyond one instance).
- The cron jobs (`jobs/scheduler.ts`) run in-process. If you deploy multiple backend replicas, only one should have `CRON_ENABLED=true` (or move the jobs to a dedicated worker), otherwise balance refreshes run once per replica.

## 3. Frontend: static hosting or the Docker/nginx image

Two equally valid options:

**A. Docker/nginx (what `docker-compose.yml` uses)** — good when you want the
frontend served from the same infra as the backend, or behind the same
reverse proxy:
```bash
docker build --build-arg VITE_API_URL=https://api.yourdomain.com/api -t openbankx-frontend ./frontend
docker run -p 80:80 openbankx-frontend
```
Remember: `VITE_API_URL` is baked in at **build** time (Vite inlines `import.meta.env.VITE_*` into the JS bundle), not read at container start. Rebuild the image to change it.

**B. Static host (Vercel/Netlify/S+CloudFront/etc.)** — build once, upload `dist/`:
```bash
cd frontend
VITE_API_URL=https://api.yourdomain.com/api npm run build
# deploy the frontend/dist folder
```
Configure your host's SPA fallback (all routes → `index.html`) the same way `nginx.conf` does here, so client-side routes like `/dashboard` don't 404 on refresh.

## 4. Post-deploy checklist

- [ ] `GET /api/health` returns `200` from the deployed backend URL
- [ ] Frontend loads and its network requests hit the correct `VITE_API_URL`, not `localhost`
- [ ] CORS: `CLIENT_URL` on the backend matches the frontend's real origin exactly (scheme + host, no trailing slash)
- [ ] Socket.IO connects (check browser devtools → Network → WS) — a failure here is almost always a CORS/origin mismatch
- [ ] Redis connected (`[redis] connected` in backend logs) — if absent, caching silently no-ops, which is safe but slower
- [ ] Cron jobs started (`[cron] scheduled jobs started ...` in logs)
- [ ] Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BANK_TOKEN_ENCRYPTION_KEY`, and the Mongo URI's credentials away from any values that were ever committed or shared — see the security note below.

## ⚠️ Security note on the uploaded project

The `backend/.env` in the project as provided contains **live-looking secrets**
(a MongoDB Atlas connection string with a username/password, JWT signing
secrets, and a bank-token encryption key). These were left in the zip you
uploaded. Treat them as compromised: rotate the Mongo user's password in
Atlas and regenerate the JWT/encryption secrets before deploying anywhere
public, and make sure `.env` stays out of version control going forward
(it's already in `.gitignore`, which is good — just don't `git add -f` it).
