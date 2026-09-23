import * as THREE from "three";
import "./styles.css";
import { MatchEngine } from "./core/MatchEngine";
import { SceneRenderer } from "./render/SceneRenderer";
import { PlayerSystem } from "./player/PlayerSystem";
import { PlayerInput } from "./player/PlayerInput";
import { PlayerMesh } from "./player/PlayerMesh";
import { FullMatchSetup } from "./match/FullMatchSetup";
import { FootballAI } from "./ai/FootballAI";
import { TacticalBrain } from "./ai/TacticalBrain";
import { BallSystem } from "./ball/BallSystem";
import { InteractionSystem } from "./interaction/InteractionSystem";
import { GKSystem } from "./interaction/GKSystem";
import { GameplaySystem } from "./gameplay/GameplaySystem";
import { TransitionSystem } from "./gameplay/TransitionSystem";
import { AnimationSystem } from "./animation/PresentationSystems";
import { CameraDirector } from "./camera/CameraDirector";
import { FootballIK } from "./animation/FootballIK";
import { WorldSystem } from "./world/WorldSystem";
import { QualityManager } from "./performance/QualityManager";
import { AAAStadium } from "./render/AAAStadium";
import { AdvancedPitch } from "./render/AdvancedPitch";
import { CrowdSystem } from "./render/CrowdSystem";
import { GoalNetCloth } from "./world/GoalNetCloth";
import { AudioEngine } from "./audio/AudioEngine";
import { CommentarySystem } from "./audio/CommentarySystem";
import { WebSocketClient } from "./online/WebSocketClient";
import { firebaseReady, getFirebaseIdToken, loginWithGoogle, logoutFirebase, observeFirebaseUser } from "./online/FirebaseWebAuth";
import type { PlayerAction, PlayerIntent } from "./player/PlayerTypes";
import { SlayerUI, type SlayerSettings } from "./ui/SLAYERUI";
import { PerformanceMonitor } from "./performance/PerformanceMonitor";
import { GPUProfiler } from "./performance/GPUProfiler";
import { AdvancedBallControl } from "./gameplay/AdvancedBallControl";
import { MatchPresentation } from "./render/MatchPresentation";

const app=document.querySelector<HTMLDivElement>("#app");
if(!app) throw new Error("SLAYER root element not found");

const renderer=new SceneRenderer(app);
const camera=new CameraDirector();
const stadium=new AAAStadium();
const presentation=new MatchPresentation();
renderer.scene.add(presentation.group);
renderer.scene.add(stadium.group);
const productionAssetsEnabled=import.meta.env.VITE_SLAYER_PRODUCTION_ASSETS==="1";
if(productionAssetsEnabled){
  console.info("[SLAYER assets] Production GLB assets enabled.");
}

const pitch=new AdvancedPitch();
renderer.scene.add(pitch.group);
const crowd=new CrowdSystem(1200);
renderer.scene.add(crowd.group);

const heroAnchor=new THREE.Object3D();
heroAnchor.position.set(7,0,0);
renderer.scene.add(heroAnchor);

const nets=[new GoalNetCloth(),new GoalNetCloth()];
nets[0].mesh.position.z=-52.5;
nets[1].mesh.position.z=52.5;
renderer.scene.add(nets[0].mesh,nets[1].mesh);

const world=new WorldSystem();
const quality=new QualityManager();
const performanceMonitor=new PerformanceMonitor();
const gpuProfiler=new GPUProfiler();
const match=new MatchEngine({halfDurationSeconds:45*60,extraTimeEnabled:true,penaltiesEnabled:true});
const players=new PlayerSystem();
new FullMatchSetup().populate(players);
if(players.all().length!==22) throw new Error(`SLAYER match setup expected 22 players, got ${players.all().length}`);

const input=new PlayerInput();
const playerMeshes=players.all().map(player=>{
  const mesh=new PlayerMesh(player);
  renderer.scene.add(mesh.object);
  return mesh;
});
const ballSystem=new BallSystem();
const ball=ballSystem.ball;
ball.setPosition({x:0,y:.11,z:0});
const interactions=new InteractionSystem();
const goalkeepers=new GKSystem();
const gameplay=new GameplaySystem(interactions);
const advancedBallControl=new AdvancedBallControl();
const transitions=new TransitionSystem();
const ai=new FootballAI();
const tactical=new TacticalBrain();
const animation=new AnimationSystem();

const ik=new FootballIK();
const audio=new AudioEngine();
const commentary=new CommentarySystem(audio);
commentary.start(match.events);

function createBallTexture():THREE.CanvasTexture{
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=512;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas 2D unavailable");
  ctx.fillStyle="#f4f7f8";
  ctx.fillRect(0,0,512,512);
  ctx.fillStyle="#11181c";
  const points=[[256,86],[392,180],[342,350],[170,382],[118,206]];
  for(const [x,y] of points){
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a=-Math.PI/2+i*Math.PI*2/5;
      const px=x+Math.cos(a)*34,py=y+Math.sin(a)*34;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fill();
  }
  ctx.strokeStyle="rgba(30,38,42,.34)";ctx.lineWidth=5;
  for(const [a,b] of [[points[0],points[1]],[points[1],points[2]],[points[2],points[3]],[points[3],points[4]],[points[4],points[0]]]){
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  return texture;
}
const ballMaterial=new THREE.MeshStandardMaterial({map:createBallTexture(),roughness:.5,metalness:.01});
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.11,32,24),ballMaterial);
ballMesh.castShadow=true;
ballMesh.receiveShadow=true;
renderer.scene.add(ballMesh);

const controlledId="home-11";
const nextAIActionAt=new Map<string,number>();
function ensureControlledPlayerPossession(): void {
  const p=players.get(controlledId);
  if(!p || !["FirstHalf","SecondHalf","ExtraTimeFirstHalf","ExtraTimeSecondHalf"].includes(match.snapshot().phase) || ball.state.controlledByPlayerId) return;
  const d=Math.hypot(p.state.position.x-ball.state.position.x,p.state.position.z-ball.state.position.z);
  if(d<2.2) {
    p.state.ballMode="Control";
    ball.state.state="Controlled";
    ball.state.controlledByPlayerId=controlledId;
  }
}
const qualityTierMap={low:"Low",medium:"Medium",high:"High",ultra:"Ultra"} as const;
function applySlayerSettings(s:SlayerSettings):void{
  const duration=Number(s.duration)||10;
  match.rules.config.halfDurationSeconds=duration*60;
  match.rules.config.extraTimeEnabled=Boolean(s.extraTime);
  match.rules.config.penaltiesEnabled=Boolean(s.penalties);
  if(typeof s.quality==="string" && s.quality in qualityTierMap) quality.setTier(qualityTierMap[s.quality as keyof typeof qualityTierMap]);
  quality.setAdaptive(Boolean(s.dynamicResolution));
  const ratio=typeof s.dynamicResolution==="boolean" && s.dynamicResolution ? quality.pixelRatio() : ({low:.68,medium:.82,high:1,ultra:Math.min(window.devicePixelRatio||1,1.35)} as Record<string,number>)[String(s.quality)]??1;
  renderer.setQuality(ratio);
  if(typeof s.camera==="string" && ["broadcast","dynamic","overview","pro","custom"].includes(s.camera)) camera.setMode(s.camera as "broadcast"|"dynamic"|"overview"|"pro"|"custom");
  world.setWeather(String(s.weather??"clear")); world.setGrass(String(s.grass??"short-dry")); world.setTime(String(s.time??"day"));
  document.documentElement.dataset.slayerWeather=String(s.weather??"clear");
  document.documentElement.dataset.slayerGrass=String(s.grass??"short-dry");
  document.documentElement.dataset.slayerTime=String(s.time??"day");
  document.documentElement.dataset.slayerRadar=String(s.radar??true);
  document.documentElement.dataset.slayerControl=String(s.control??"virtual");
  document.documentElement.dataset.slayerPassAssist=String(s.passAssist??2);
  document.documentElement.dataset.slayerShotAssist=String(s.shotAssist??"manual");
  document.documentElement.dataset.slayerCursor=String(s.cursor??"semi");
  document.documentElement.dataset.slayerPress=String(s.press??"individual");
  document.documentElement.dataset.slayerAttack=String(s.attack??"balanced");
  audio.enabled=(Number(s.effects??90)+Number(s.crowd??80)+Number(s.commentaryVolume??85)+Number(s.music??55))>0;
  audio.setMixer(Number(s.music??55),Number(s.commentaryVolume??85),Number(s.crowd??80),Number(s.effects??90));
}

const ui=new SlayerUI(
  app,
  startMatch,
  action => input.setAction(action,.75),
  pressed => input.setSprint(pressed),
  move => input.setMovement(move.x, move.z),
  mode => camera.setMode(mode),
  applySlayerSettings
);
const slayerApiUrl=(import.meta.env.VITE_SLAYER_API_URL || "https://slayer-api-8myx.onrender.com").replace(/\/$/,"");
let online: WebSocketClient | null = null;

const authPanel=document.createElement("div");
authPanel.style.position="fixed";
authPanel.style.top="18px";
authPanel.style.right="18px";
authPanel.style.zIndex="9999";
authPanel.style.display="flex";
authPanel.style.alignItems="center";
authPanel.style.gap="10px";
authPanel.style.padding="10px 12px";
authPanel.style.border="1px solid rgba(255,255,255,.14)";
authPanel.style.borderRadius="14px";
authPanel.style.background="rgba(7,10,14,.86)";
authPanel.style.backdropFilter="blur(14px)";
authPanel.style.fontFamily="system-ui,sans-serif";
authPanel.style.color="#fff";

const authStatus=document.createElement("span");
authStatus.style.fontSize="12px";
authStatus.textContent=firebaseReady ? "Firebase prêt" : "Firebase non configuré";

const authButton=document.createElement("button");
authButton.type="button";
authButton.textContent=firebaseReady ? "Connexion Google" : "Firebase requis";
authButton.disabled=!firebaseReady;
authButton.style.border="0";
authButton.style.borderRadius="10px";
authButton.style.padding="8px 12px";
authButton.style.fontWeight="700";
authButton.style.cursor=firebaseReady ? "pointer" : "not-allowed";

authPanel.append(authStatus,authButton);
app.appendChild(authPanel);

async function verifyBackendSession(): Promise<void> {
  const token=await getFirebaseIdToken();
  if(!token) throw new Error("firebase_token_missing");
  const response=await fetch(slayerApiUrl+"/api/profile",{
    headers:{Authorization:"Bearer "+token}
  });
  if(!response.ok) throw new Error("backend_auth_failed_"+response.status);
}

authButton.addEventListener("click",async()=>{
  authButton.disabled=true;
  try{
    if(authButton.dataset.signedIn==="1"){
      await logoutFirebase();
      authButton.dataset.signedIn="";
      authButton.textContent="Connexion Google";
      authStatus.textContent="Déconnecté";
      online?.close();
      online=null;
      return;
    }
    authStatus.textContent="Connexion...";
    const user=await loginWithGoogle();
    await verifyBackendSession();
    const token=await user.getIdToken();
    const wsBase=slayerApiUrl.replace(/^https:/,"wss:").replace(/^http:/,"ws:");
    online=new WebSocketClient();
    online.connect(wsBase+"/ws/"+encodeURIComponent(user.uid),token);
    authButton.dataset.signedIn="1";
    authButton.textContent="Déconnexion";
    authStatus.textContent=(user.displayName || user.email || "Joueur")+" connecté";
  }catch(error){
    console.error("[SLAYER] Firebase authentication failed.",error);
    if(error && typeof error==="object" && "code" in error && (error as {code?:string}).code==="auth/unauthorized-domain"){ authStatus.textContent="Domaine Firebase non autorisé"; } else { authStatus.textContent=error instanceof Error ? error.message : "Échec de connexion"; }
  }finally{
    authButton.disabled=!firebaseReady;
  }
});

if(firebaseReady){
  observeFirebaseUser(user=>{
    if(user){
      authButton.dataset.signedIn="1";
      authButton.textContent="Déconnexion";
      authStatus.textContent=(user.displayName || user.email || "Joueur")+" connecté";
    }
  });
}

window.addEventListener("pointerdown",()=>void audio.resume(),{once:true});

let matchStarted = false;
function startMatch(): void {
  if (matchStarted) return;
  camera.setMode("match");
  matchStarted = true;
  match.start();
  match.kickOff("home");
  const human=players.get(controlledId);
  if(human){
    human.state.position={x:0,y:0,z:-1.45};
    human.state.rotationY=0;
    human.state.ballMode="Control";
    human.state.action="Control";
    ball.setPosition({x:0,y:.11,z:0});
    ball.state.state="Controlled";
    ball.state.controlledByPlayerId=controlledId;
  }
}
const keyboard={w:false,a:false,s:false,d:false};
function updateKeyboardMovement():void{
  const x=(keyboard.d?1:0)-(keyboard.a?1:0);
  const z=(keyboard.s?1:0)-(keyboard.w?1:0);
  input.setMovement(x,z);
}
window.addEventListener("keydown",event=>{
  const key=event.key.toLowerCase();
  if(key in keyboard){keyboard[key as keyof typeof keyboard]=true;updateKeyboardMovement();event.preventDefault();}
  if(event.key==="Shift") input.setSprint(true);
  if(key==="1") input.setAction("Pass",.55);
  if(key==="2") input.setAction("Shoot",.85);
  if(key==="3") input.setAction("Control",.3);
});
window.addEventListener("keyup",event=>{
  const key=event.key.toLowerCase();
  if(key in keyboard){keyboard[key as keyof typeof keyboard]=false;updateKeyboardMovement();event.preventDefault();}
  if(event.key==="Shift") input.setSprint(false);
});

let last=window.performance.now();
let lastUiUpdate=0;
// Goal-net reaction: feed impacts from fast shots into the nearest net.
let previousBallZ=ball.state.position.z;


function detectGoal(): void {
  const p=ball.state.position;
  if(Math.abs(p.x)>3.66 || Math.abs(p.y)>2.44) return;
  if(p.z>=52.5) {
    match.goal("home",{ballPosition:{...p}});
    ball.setPosition({x:0,y:.11,z:0});
    ball.state.velocity={x:0,y:0,z:0};
    ball.state.state="Free";
    ball.state.controlledByPlayerId=undefined;
    match.restartAfterGoal("away");
    match.completeRestart();
    ensureControlledPlayerPossession();
    return;
  }
  if(p.z<=-52.5) {
    match.goal("away",{ballPosition:{...p}});
    ball.setPosition({x:0,y:.11,z:0});
    ball.state.velocity={x:0,y:0,z:0};
    ball.state.state="Free";
    ball.state.controlledByPlayerId=undefined;
    match.restartAfterGoal("home");
    match.completeRestart();
    ensureControlledPlayerPossession();
  }
}

function executeAction(playerId:string, action:PlayerAction, direction:{x:number;y:number;z:number}, power:number): void {
  const supported:PlayerAction[]=[
    "Control","Dribble","ProtectBall","Shoot","Pass","ThroughBall","Cross","Clearance",
    "Tackle","StandingTackle","SlideTackle","Intercept","Press","Contain"
  ];
  if(supported.includes(action)){
    gameplay.execute(players,ball,playerId,action,direction,power);
  }
}

function frame(now:number){
  const rawFrameMs=now-last;
  const delta=Math.min(rawFrameMs/1000,.05);
  const perf=performanceMonitor.sample(rawFrameMs,delta);
  const gpu=gpuProfiler.sample(renderer.renderer,rawFrameMs,delta);
  last=now;

  const human=input.snapshot();
  ai.update(players,ball,match.clock.seconds);
  tactical.update(players,ball);

  const intents=new Map<string, PlayerIntent>();
  for(const p of players.all()) {
    if(p.data.playerId!==controlledId && p.state.lastIntent) intents.set(p.data.playerId,p.state.lastIntent);
  }
  intents.set(controlledId,human);
  players.updateIntents(intents,delta);

  for(const p of players.all()){
    if(p.data.playerId===controlledId) continue;
    const intent=p.state.lastIntent;
    if(!intent || intent.action==="None") continue;
    const nextAt=nextAIActionAt.get(p.data.playerId)??0;
    if(match.clock.seconds<nextAt) continue;
    executeAction(p.data.playerId,intent.action,intent.targetDirection,intent.power);
    nextAIActionAt.set(p.data.playerId,match.clock.seconds+0.28);
    p.state.lastIntent={...intent,action:"None",power:0};
  }

  if(human.action!=="None") {
    executeAction(controlledId,human.action,human.targetDirection,human.power);
    input.setAction("None",0);
  }

  interactions.update(players,ball);
  ballSystem.update(delta, players);
  transitions.update(players,ball,delta);
  goalkeepers.update(players,ball);
  ensureControlledPlayerPossession();
  const controlledPlayer=players.get(controlledId);
  if(controlledPlayer) advancedBallControl.update(controlledPlayer,ball,delta,controlledPlayer.state.action==="Dribble"?"Burst":"None");
  const ballSpeed=Math.hypot(ball.state.velocity.x,ball.state.velocity.y,ball.state.velocity.z);
  const crossedGoalLine=(previousBallZ > -52.0 && ball.state.position.z <= -52.0) || (previousBallZ < 52.0 && ball.state.position.z >= 52.0);
  if(ballSpeed>10 && crossedGoalLine) nets[ball.state.position.z<0?0:1].impact(new THREE.Vector3(ball.state.position.x,ball.state.position.y,0),Math.min(2,ballSpeed/15));
  previousBallZ=ball.state.position.z;
  detectGoal();
  match.update(delta);
  world.update(delta);
  ball.setSurface(world.weather==="Rain" ? "GrassWet" : "GrassDry",world.pitch.wetness);
  pitch.setWetness(world.pitch.wetness);
  presentation.update(delta,world.pitch.wetness);
  if(quality.update(rawFrameMs)) renderer.setQuality(quality.pixelRatio());
  crowd.update(delta,Math.min(1,ball.state.velocity.x**2+ball.state.velocity.z**2)/100);
  nets.forEach(n=>n.update(delta));

  for(const mesh of playerMeshes){
    const p=players.get(mesh.object.userData.playerId as string);
    if(!p) continue;
    mesh.sync(p);
    const motion=animation.update(p,delta,ball.state.position);
    mesh.applyAnimation(motion,delta);
    mesh.applyIK(ik,ball.state.position);
  }

  ballMesh.position.set(ball.state.position.x,ball.state.position.y,ball.state.position.z);
  const ballVelocity=ball.state.velocity;
  ballMesh.rotation.x+=ballVelocity.z*delta/.11;
  ballMesh.rotation.z-=ballVelocity.x*delta/.11;
  camera.update(renderer.camera,ball.state.position);

  if(now-lastUiUpdate>=120){
    const snapshot=match.snapshot();
    ui.updateMatch(snapshot.score.homeGoals,snapshot.score.awayGoals,match.clock.format(),snapshot.phase.toUpperCase());
    ui.updatePerformance(perf.fps || gpu.fps,perf.frameMs || gpu.frameMs,perf.p95Ms || gpu.p95Ms,gpu.drawCalls,gpu.triangles,quality.tier);
    lastUiUpdate=now;
  }
  if(online && human.action!=="None"){ online.send({type:"intent",data:{playerId:controlledId,moveX:human.moveDirection.x,moveZ:human.moveDirection.z,action:human.action,power:human.power,clientTime:Date.now()}}); }

  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);