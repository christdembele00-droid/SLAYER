from fastapi import FastAPI,WebSocket,WebSocketDisconnect
from pydantic import BaseModel,Field
app=FastAPI(title="SLAYER Online Server")
class Intent(BaseModel):
 playerId:str; moveX:float=Field(ge=-1,le=1); moveZ:float=Field(ge=-1,le=1); action:str="None"; power:float=Field(ge=0,le=1)
clients={}
@app.get("/health")
def health(): return {"status":"ok","service":"slayer-online"}
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
