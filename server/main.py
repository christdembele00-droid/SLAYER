from fastapi import FastAPI,WebSocket,WebSocketDisconnect
from pydantic import BaseModel,Field
from .routes import router
from .matchmaking import Matchmaking,Ticket
from time import time
app=FastAPI(title="SLAYER Online Server");app.include_router(router);mm=Matchmaking()
class Intent(BaseModel):
 playerId:str;moveX:float=Field(ge=-1,le=1);moveZ:float=Field(ge=-1,le=1);action:str="None";power:float=Field(ge=0,le=1)
class QueueRequest(BaseModel):
 playerId:str;region:str="auto";mode:str="Friendly";version:str="0.1.0";skill:float=1000
@app.get("/health")
def health(): return {"status":"ok","service":"slayer-online"}
@app.post("/api/matchmaking/join")
def join(r:QueueRequest):
 pair=mm.match() if False else None
 t=Ticket(r.playerId,r.region,r.mode,r.version,r.skill,time());mm.queue.append(t)
 pair=mm.match()
 return {"status":"matched" if pair else "queued","players":[pair[0].player_id,pair[1].player_id] if pair else []}
clients={}
@app.websocket("/ws/{player_id}")
async def ws(ws:WebSocket,player_id:str):
 await ws.accept();clients[player_id]=ws
 try:
  while True:
   intent=Intent(**(await ws.receive_json()))
   for client in list(clients.values()):
    try: await client.send_json({"type":"intent","data":intent.model_dump()})
    except Exception: pass
 except WebSocketDisconnect: clients.pop(player_id,None)
