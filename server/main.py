import os
from time import time
from uuid import uuid4

from fastapi import Depends, FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import require_bearer
from .matchmaking import Matchmaking, Ticket
from .routes import router
from .db import init_schema


def _allowed_origins() -> list[str]:
    raw = os.getenv(
        "SLAYER_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:4173",
    )
    return [item.strip() for item in raw.split(",") if item.strip()]


ALLOWED_ORIGINS = _allowed_origins()

app = FastAPI(title="SLAYER Online Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
@app.on_event("startup")
def startup():
    init_schema()

app.include_router(router)

mm = Matchmaking()
match_players: dict[str, set[str]] = {}
clients: dict[str, dict[str, WebSocket]] = {}


class Intent(BaseModel):
    playerId: str
    moveX: float = Field(ge=-1, le=1)
    moveZ: float = Field(ge=-1, le=1)
    action: str = "None"
    power: float = Field(ge=0, le=1)


class QueueRequest(BaseModel):
    playerId: str
    region: str = "auto"
    mode: str = "Friendly"
    version: str = "0.1.0"
    skill: float = 1000


@app.get("/health")
def health():
    return {"status": "ok", "service": "slayer-online"}


@app.post("/api/matchmaking/join")
def join(r: QueueRequest, user=Depends(require_bearer)):
    uid = str(user.get("uid", ""))
    if not uid or r.playerId != uid:
        return {"status": "error", "reason": "player_id_must_match_auth"}

    pair = mm.enqueue(
        Ticket(uid, r.region, r.mode, r.version, r.skill, time())
    )
    if not pair:
        return {"status": "queued", "players": [], "matchId": None}

    match_id = uuid4().hex
    match_players[match_id] = {pair[0].player_id, pair[1].player_id}
    clients[match_id] = {}
    return {
        "status": "matched",
        "players": [pair[0].player_id, pair[1].player_id],
        "matchId": match_id,
    }


def _origin_allowed(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    return not origin or origin in ALLOWED_ORIGINS


async def _authenticate_websocket(ws: WebSocket) -> str | None:
    if not _origin_allowed(ws):
        await ws.close(code=4403, reason="origin_not_allowed")
        return None

    await ws.accept()

    try:
        first = await ws.receive_json()
    except Exception:
        await ws.close(code=4401, reason="auth_required")
        return None

    if first.get("type") != "auth" or not isinstance(first.get("token"), str):
        await ws.close(code=4401, reason="auth_required")
        return None

    if not __import__("firebase_admin")._apps:
        await ws.close(code=4503, reason="firebase_not_configured")
        return None

    try:
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(first["token"])
        uid = str(decoded.get("uid", ""))
    except Exception:
        await ws.close(code=4401, reason="invalid_firebase_token")
        return None

    return uid or None


@app.websocket("/ws/{player_id}")
async def ws(
    websocket: WebSocket,
    player_id: str,
    match_id: str | None = Query(default=None),
):
    uid = await _authenticate_websocket(websocket)
    if not uid:
        return

    if uid != player_id or not match_id or player_id not in match_players.get(match_id, set()):
        await websocket.close(code=4403, reason="match_access_denied")
        return

    room = clients.setdefault(match_id, {})
    room[player_id] = websocket

    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != "intent":
                continue

            intent = Intent(**payload.get("data", {}))
            if intent.playerId != player_id:
                await websocket.close(code=4403, reason="player_id_mismatch")
                return

            envelope = {
                "type": "intent",
                "data": intent.model_dump(),
            }
            stale: list[str] = []
            for other_id, client in room.items():
                try:
                    await client.send_json(envelope)
                except Exception:
                    stale.append(other_id)

            for stale_id in stale:
                room.pop(stale_id, None)

    except WebSocketDisconnect:
        room.pop(player_id, None)
        if not room:
            clients.pop(match_id, None)
