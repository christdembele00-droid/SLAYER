import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import http from "node:http";
import { WebSocketServer } from "ws";
import admin from "firebase-admin";

const PORT=Number(process.env.PORT||8080);
const TICK_RATE=Math.max(10,Math.min(30,Number(process.env.SLAYER_TICK_RATE||20)));
if(!admin.apps.length){const privateKey=(process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n");if(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&privateKey)admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey})});}
const db=()=>admin.apps.length?admin.firestore():null;
const rooms=new Map();
function requireFirebase(){if(!admin.apps.length)throw new Error("Firebase Admin is not configured");}
async function auth(req){requireFirebase();const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))throw new Error("Missing Firebase bearer token");return admin.auth().verifyIdToken(h.slice(7));}
function sign(params,secret){const s=Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=="").sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("&");return crypto.createHash("sha1").update(s+secret).digest("hex");}
function room(id){let r=rooms.get(id);if(!r){r={id,status:"LOBBY",players:new Map(),inputs:new Map(),ball:{x:0,y:0,z:0,vx:0,vy:0,vz:0},tick:0};rooms.set(id,r);}return r;}
function state(r){return{match_id:r.id,status:r.status,tick:r.tick,players:[...r.players.values()],ball:r.ball};}
const app=express();app.use(cors());app.use(express.json({limit:"256kb"}));
app.get("/health",(_,res)=>res.json({ok:true,service:"slayer-realtime",tickRate:TICK_RATE,firebase:admin.apps.length>0}));
app.get("/me",async(req,res)=>{try{const u=await auth(req);res.json({uid:u.uid,name:u.name||"",email:u.email||"",picture:u.picture||""});}catch(e){res.status(401).json({error:e.message});}});
app.post("/rooms",async(req,res)=>{try{const u=await auth(req);const id="slayer_"+crypto.randomBytes(6).toString("hex");const r=room(id);r.players.set(u.uid,{user_id:u.uid,name:u.name||"Player",team:req.body.team==="away"?"away":"home",role:req.body.role||"ST",x:0,y:0,z:0});if(db())await db().collection("slayerRooms").doc(id).set({match_id:id,status:"LOBBY",created_by:u.uid,created_at:admin.firestore.FieldValue.serverTimestamp()});res.status(201).json(state(r));}catch(e){res.status(401).json({error:e.message});}});
app.post("/rooms/:id/join",async(req,res)=>{try{const u=await auth(req);const r=room(req.params.id);if(r.players.size>=22&&!r.players.has(u.uid))return res.status(409).json({error:"Room is full"});r.players.set(u.uid,{user_id:u.uid,name:u.name||"Player",team:req.body.team==="away"?"away":"home",role:req.body.role||"ST",x:0,y:0,z:0});res.json(state(r));}catch(e){res.status(401).json({error:e.message});}});
app.get("/rooms/:id",async(req,res)=>{try{await auth(req);res.json(state(room(req.params.id)));}catch(e){res.status(401).json({error:e.message});}});
app.post("/media/signature",async(req,res)=>{try{const u=await auth(req);if(!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)throw new Error("Cloudinary is not configured");const timestamp=Math.floor(Date.now()/1000);const folder=String(req.body.folder||"slayer/profiles").replace(/[^a-zA-Z0-9_\/-]/g,"");const params={folder,timestamp};res.json({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,timestamp,folder,signature:sign(params,process.env.CLOUDINARY_API_SECRET),public_id_prefix:u.uid});}catch(e){res.status(400).json({error:e.message});}});
app.post("/chat/:roomId",async(req,res)=>{try{const u=await auth(req);const text=String(req.body.text||"").trim().slice(0,300);if(!text)return res.status(400).json({error:"Empty message"});requireFirebase();await db().collection("slayerRooms").doc(req.params.roomId).collection("messages").add({uid:u.uid,name:u.name||"Player",text,type:req.body.type==="quick"?"quick":"chat",created_at:admin.firestore.FieldValue.serverTimestamp()});res.status(201).json({ok:true});}catch(e){res.status(401).json({error:e.message});}});
const serverHttp=http.createServer(app);const wss=new WebSocketServer({server:serverHttp,path:"/match"});const clients=new Map();
function broadcast(r,p){const s=JSON.stringify(p);for(const [ws,i] of clients)if(i.roomId===r.id&&ws.readyState===1)ws.send(s);}
wss.on("connection",ws=>{let info=null;ws.on("message",async raw=>{try{const m=JSON.parse(raw.toString());if(m.type==="join"){requireFirebase();const u=await admin.auth().verifyIdToken(String(m.token||""));const r=room(String(m.roomId||""));if(r.players.size>=22&&!r.players.has(u.uid))throw new Error("Room is full");if(!r.players.has(u.uid))r.players.set(u.uid,{user_id:u.uid,name:u.name||"Player",team:m.team==="away"?"away":"home",role:m.role||"ST",x:0,y:0,z:0});info={uid:u.uid,roomId:r.id};clients.set(ws,info);ws.send(JSON.stringify({type:"snapshot",state:state(r)}));return;}if(!info)throw new Error("Join required");const r=room(info.roomId);if(m.type==="input")r.inputs.set(info.uid,{moveX:Number(m.moveX)||0,moveY:Number(m.moveY)||0,pass:!!m.pass,shoot:!!m.shoot,sprint:!!m.sprint,tackle:!!m.tackle});if(m.type==="start"&&r.players.size>=2)r.status="IN_GAME";}catch(e){ws.send(JSON.stringify({type:"error",error:e.message}));}});ws.on("close",()=>clients.delete(ws));});
setInterval(()=>{const dt=1/TICK_RATE;for(const r of rooms.values()){if(r.status!=="IN_GAME")continue;r.tick++;for(const [uid,i] of r.inputs){const p=r.players.get(uid);if(!p)continue;const speed=i.sprint?7:4.5;p.x=Math.max(-52,Math.min(52,p.x+i.moveX*speed*dt));p.z=Math.max(-34,Math.min(34,p.z+i.moveY*speed*dt));}broadcast(r,{type:"snapshot",state:state(r)});}},1000/TICK_RATE);
serverHttp.listen(PORT,()=>console.log("SLAYER realtime server on "+PORT+" @ "+TICK_RATE+"Hz"));
