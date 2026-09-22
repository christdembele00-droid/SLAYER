# SLAYER realtime service

Run `npm install` then `npm start`.

Configure `server/.env` from `.env.example`. Firebase Admin credentials and the Cloudinary API secret remain server-side.

HTTP: `/health`, `/me`, `/rooms`, `/rooms/:id`, `/rooms/:id/join`, `/chat/:roomId`, `/media/signature`.
WebSocket: `/match`.
