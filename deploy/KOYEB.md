# SLAYER on Koyeb

SLAYER's online backend is the FastAPI service in `server/`. The native Android client talks to this API for authentication-backed matchmaking and WebSocket match traffic.

## Koyeb service

Create a **Web Service** from the GitHub repository:

- Repository: `christdembele00-droid/SLAYER`
- Branch: `graphics/full-fidelity-2026-09-23` during development, then `main` after merge.
- Builder: **Dockerfile**
- Build context: repository root
- Dockerfile: `server/Dockerfile`
- Exposed port: `8080`
- HTTP health check: `/health`
- Service name: `slayer-api`

The Dockerfile intentionally builds from the repository root because it copies `server/requirements.txt` and `server/` into the container.

## Runtime variables

Configure these in Koyeb; never commit their real values:

- `SLAYER_ENV=production`
- `DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT` or the three `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `SLAYER_ALLOWED_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Use PostgreSQL as the persistent database. SLAYER refuses SQLite when `SLAYER_ENV=production`.

## Endpoints

- `GET /` is not required for gameplay.
- `GET /health` reports API, PostgreSQL and Firebase readiness state.
- `POST /api/matchmaking/join` creates/joins the in-memory matchmaking queue.
- `GET /api/auth/me` verifies the Firebase bearer token.
- `WS /ws/{player_id}?match_id=...` carries authenticated live-match intents.

The native Android client uses the same HTTPS base URL for REST and converts it to `wss://` for the WebSocket endpoint.

## Important single-instance constraint

The current matchmaking room and WebSocket connection manager are process-local Python memory. Keep the Koyeb service at **one instance** with this architecture.

Do not horizontally scale the service yet. A future multi-instance version must move matchmaking, room membership and authoritative match state into shared infrastructure (for example Redis/Valkey plus a persistent authoritative match service).

## Koyeb Free Instance

Koyeb currently offers one Free Web Service per organization with 512 MB RAM, 0.1 vCPU and 2 GB SSD. Free Instances can be deployed only in Frankfurt or Washington, D.C., and automatically scale to zero after one hour without traffic. Koyeb states that the Free Instance is intended for testing/hobby usage rather than production. citeturn999671search0turn999671search3

That makes the Free Instance suitable for **development, testing and early online prototypes**, but it should not be treated as a permanent always-on production game server. Held WebSocket connections prevent scale-to-zero while connected, but an idle service can still need a cold start when the next player connects. citeturn999671search1

## Deployment sequence

1. Create the Koyeb Web Service from GitHub.
2. Set Dockerfile to `server/Dockerfile` and keep the build context at the repository root.
3. Configure port `8080` and health check `/health`.
4. Add the PostgreSQL, Firebase and Cloudinary variables.
5. Deploy.
6. Copy the generated HTTPS `.koyeb.app` URL.
7. Use that **real** URL as `SLAYER_API_URL` for the Android build.
8. Build the APK with the URL supplied as an environment variable.
9. Test Firebase authentication, matchmaking, WebSocket connection, reconnect and a complete online match on real Android devices.

Never hard-code a fake backend URL.

## Android build variable

The Android module already reads:

`SLAYER_API_URL`

Example for a local CI build:

`SLAYER_API_URL=https://YOUR-REAL-SLAYER-API.koyeb.app gradle -p engine/filament/android assembleDebug --no-daemon`

The URL is injected into `BuildConfig.SLAYER_API_URL`; no Firebase or server secret is embedded in the APK.
