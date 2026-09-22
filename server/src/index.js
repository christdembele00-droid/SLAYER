import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import http from "node:http";
import { WebSocketServer } from "ws";
import admin from "firebase-admin";
import ServerPhysics from "./ServerPhysics.js";
import BinaryProtocol from "./BinaryProtocol.js";

const PORT = Number(process.env.PORT || 8080);
const TICK_RATE = Math.max(30, Math.min(60, Number(process.env.SLAYER_TICK_RATE || 60)));
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 22;

if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    if (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey
            })
        });
    }
}

const db = () => admin.apps.length ? admin.firestore() : null;
function requireFirebase() {
    if (!admin.apps.length) throw new Error("Firebase Admin is not configured");
}
async function auth(req) {
    requireFirebase();
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) throw new Error("Missing Firebase bearer token");
    return admin.auth().verifyIdToken(header.slice(7));
}

function sign(params, secret) {
    const canonical = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => k + "=" + v)
        .join("&");
    return crypto.createHash("sha1").update(canonical + secret).digest("hex");
}

function createRoom(id) {
    return {
        id,
        status: "LOBBY",
        players: new Map(),      // Firebase UID -> public player
        uidToNetId: new Map(),   // stable numeric network id
        nextNetId: 1,
        physics: new ServerPhysics(),
        clients: new Set()
    };
}

const rooms = new Map();

function getRoom(id) {
    let r = rooms.get(id);
    if (!r) {
        r = createRoom(id);
        rooms.set(id, r);
    }
    return r;
}

function allocateNetId(room) {
    for (let id = 1; id <= MAX_PLAYERS; id++) {
        if (![...room.uidToNetId.values()].includes(id)) return id;
    }
    return 0;
}

function addOrUpdatePlayer(room, user, team = "home", role = "ST") {
    if (room.players.has(user.uid)) {
        return room.players.get(user.uid);
    }
    if (room.players.size >= MAX_PLAYERS) throw new Error("Room is full");

    const home = [...room.players.values()].filter(p => p.team === "home").length;
    const away = [...room.players.values()].filter(p => p.team === "away").length;
    if (team === "home" && home >= 11) team = "away";
    if (team === "away" && away >= 11) team = "home";

    const netId = allocateNetId(room);
    if (!netId) throw new Error("No network id available");

    const player = {
        user_id: user.uid,
        netId,
        name: user.name || "Player",
        team,
        role,
        x: 0, y: 0, z: 0,
        connected: true
    };

    room.uidToNetId.set(user.uid, netId);
    room.players.set(user.uid, player);
    room.physics.addPlayer(netId, team, role);
    return player;
}

function publicState(room) {
    return {
        match_id: room.id,
        status: room.status,
        tick: room.physics.serverTick,
        players: [...room.players.values()],
        ball: room.physics.ball
    };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_, res) => res.json({
    ok: true,
    service: "slayer-realtime",
    tickRate: TICK_RATE,
    maxPlayers: MAX_PLAYERS,
    firebase: admin.apps.length > 0
}));

app.get("/me", async (req, res) => {
    try {
        const u = await auth(req);
        res.json({
            uid: u.uid,
            name: u.name || "",
            email: u.email || "",
            picture: u.picture || ""
        });
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post("/rooms", async (req, res) => {
    try {
        const u = await auth(req);
        const id = "slayer_" + crypto.randomBytes(6).toString("hex");
        const room = createRoom(id);
        rooms.set(id, room);
        addOrUpdatePlayer(room, u, req.body.team === "away" ? "away" : "home", req.body.role || "ST");

        if (db()) {
            await db().collection("slayerRooms").doc(id).set({
                match_id: id,
                status: "LOBBY",
                created_by: u.uid,
                max_players: MAX_PLAYERS,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        res.status(201).json(publicState(room));
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post("/rooms/:id/join", async (req, res) => {
    try {
        const u = await auth(req);
        const room = getRoom(req.params.id);
        const player = addOrUpdatePlayer(
            room, u,
            req.body.team === "away" ? "away" : "home",
            req.body.role || "ST"
        );
        res.json({ player, state: publicState(room) });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get("/rooms/:id", async (req, res) => {
    try {
        await auth(req);
        res.json(publicState(getRoom(req.params.id)));
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post("/media/signature", async (req, res) => {
    try {
        const u = await auth(req);
        if (!process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET) {
            throw new Error("Cloudinary is not configured");
        }

        const allowedFolders = new Set([
            "slayer/profiles",
            "slayer/emblems",
            "slayer/kits"
        ]);
        const requested = String(req.body.folder || "slayer/profiles");
        if (!allowedFolders.has(requested)) {
            return res.status(400).json({ error: "Invalid upload folder" });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const params = { folder: requested, timestamp };
        res.json({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            timestamp,
            folder: requested,
            signature: sign(params, process.env.CLOUDINARY_API_SECRET),
            public_id_prefix: u.uid
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post("/chat/:roomId", async (req, res) => {
    try {
        const u = await auth(req);
        const text = String(req.body.text || "").trim().slice(0, 300);
        if (!text) return res.status(400).json({ error: "Empty message" });
        requireFirebase();
        await db().collection("slayerRooms").doc(req.params.roomId)
            .collection("messages").add({
                uid: u.uid,
                name: u.name || "Player",
                text,
                type: req.body.type === "quick" ? "quick" : "chat",
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        res.status(201).json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

const serverHttp = http.createServer(app);
const wss = new WebSocketServer({ server: serverHttp, path: "/match" });
const clients = new Map();

function sendSnapshot(room, ws = null) {
    if (ws && ws.readyState === 1) {
        const info = clients.get(ws);
        const p = info ? room.physics.players.get(info.netId) : null;
        const ack = p?.lastSequence || 0;
        ws.send(BinaryProtocol.serializeSnapshot(room.physics, ack), { binary: true });
        return;
    }

    for (const socket of room.clients) {
        if (socket.readyState !== 1) continue;
        const info = clients.get(socket);
        const p = info ? room.physics.players.get(info.netId) : null;
        socket.send(BinaryProtocol.serializeSnapshot(room.physics, p?.lastSequence || 0), {
            binary: true
        });
    }
}

wss.on("connection", ws => {
    let info = null;

    ws.on("message", async (raw, isBinary) => {
        try {
            if (isBinary) throw new Error("Binary client messages are not enabled yet");

            const message = JSON.parse(raw.toString());

            if (message.type === "join") {
                requireFirebase();
                const user = await admin.auth().verifyIdToken(String(message.token || ""));
                const room = getRoom(String(message.roomId || ""));
                const player = addOrUpdatePlayer(
                    room, user,
                    message.team === "away" ? "away" : "home",
                    message.role || "ST"
                );

                info = { uid: user.uid, roomId: room.id, netId: player.netId };
                clients.set(ws, info);
                room.clients.add(ws);

                ws.send(JSON.stringify({
                    type: "joined",
                    roomId: room.id,
                    networkId: player.netId,
                    team: player.team,
                    maxPlayers: MAX_PLAYERS
                }));
                sendSnapshot(room, ws);
                return;
            }

            if (!info) throw new Error("Join required");
            const room = getRoom(info.roomId);
            const player = room.physics.players.get(info.netId);
            if (!player) throw new Error("Player not found");

            if (message.type === "input") {
                room.physics.processInput(info.netId, {
                    sequence: message.sequence,
                    moveX: message.moveX,
                    moveZ: message.moveY ?? message.moveZ,
                    pass: message.pass,
                    shoot: message.shoot,
                    kick: message.kick,
                    sprint: message.sprint,
                    tackle: message.tackle,
                    kickPower: message.kickPower ?? message.power
                });
            } else if (message.type === "start") {
                if (room.physics.players.size >= 2) room.status = "IN_GAME";
            } else if (message.type === "reconnect") {
                sendSnapshot(room, ws);
            }
        } catch (e) {
            if (ws.readyState === 1) ws.send(JSON.stringify({
                type: "error",
                error: e.message
            }));
        }
    });

    ws.on("close", () => {
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;
        room.clients.delete(ws);
        clients.delete(ws);

        const player = room.physics.players.get(info.netId);
        if (player) player.connected = false;
        const publicPlayer = room.players.get(info.uid);
        if (publicPlayer) publicPlayer.connected = false;
    });
});

let accumulator = 0;
let lastTime = process.hrtime.bigint();

setInterval(() => {
    const now = process.hrtime.bigint();
    const elapsed = Number(now - lastTime) / 1e9;
    lastTime = now;
    accumulator += Math.min(elapsed, 0.25);

    while (accumulator >= DT) {
        for (const room of rooms.values()) {
            if (room.status === "IN_GAME") {
                room.physics.step(DT);
            }
        }
        accumulator -= DT;
    }

    for (const room of rooms.values()) {
        if (room.status === "IN_GAME") sendSnapshot(room);
    }
}, 1000 / TICK_RATE);

serverHttp.listen(PORT, () => {
    console.log("SLAYER realtime server on " + PORT + " @ " + TICK_RATE + "Hz");
});
