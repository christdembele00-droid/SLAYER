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
import { AnimationSystem, CameraDirector } from "./animation/PresentationSystems";
import { FootballIK } from "./animation/FootballIK";
import { WorldSystem, QualityManager } from "./world/WorldSystems";
import { AAAStadium } from "./render/AAAStadium";
import { AdvancedPitch } from "./render/AdvancedPitch";
import { CrowdSystem } from "./render/CrowdSystem";
import { GoalNetCloth } from "./world/GoalNetCloth";
import { AudioEngine } from "./audio/AudioEngine";
import { CommentarySystem } from "./audio/CommentarySystem";
import { WebSocketClient } from "./online/WebSocketClient";
import type { PlayerAction, PlayerIntent } from "./player/PlayerTypes";
import { SlayerUI } from "./ui/SLAYERUI";
import { PerformanceMonitor } from "./performance/PerformanceMonitor";
import { GPUProfiler } from "./performance/GPUProfiler";

const app=document.querySelector<HTMLDivElement>("#app");
if(!app) throw new Error("SLAYER root element not found");

const renderer=new SceneRenderer(app);
const stadium=new AAAStadium();
renderer.scene.add(stadium.group);
const pitch=new AdvancedPitch();
renderer.scene.add(pitch.group);
const crowd=new CrowdSystem();
renderer.scene.add(crowd.group);
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
const transitions=new TransitionSystem();
const ai=new FootballAI();
const tactical=new TacticalBrain();
const animation=new AnimationSystem();
const camera=new CameraDirector();
const ik=new FootballIK();
const audio=new AudioEngine();
const commentary=new CommentarySystem(audio);
commentary.start(match.events);

const ballMesh=new THREE.Mesh(
  new THREE.SphereGeometry(.11,24,16),
  new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55})
);
renderer.scene.add(ballMesh);

const controlledId="home-1";
function ensureControlledPlayerPossession(): void {
  const p=players.get(controlledId);
  if(!p || match.snapshot().phase!=="FirstHalf" || ball.state.controlledByPlayerId) return;
  const d=Math.hypot(p.state.position.x-ball.state.position.x,p.state.position.z-ball.state.position.z);
  if(d<2.2) {
    p.state.ballMode="Control";
    ball.state.state="Controlled";
    ball.state.controlledByPlayerId=controlledId;
  }
}
const ui=new SlayerUI(
  app,
  startMatch,
  action => input.setAction(action,.75),
  pressed => input.setSprint(pressed),
  move => input.setMovement(move.x, move.z)
);
const config=(window as unknown as {__SLAYER_CONFIG__?:{wsUrl?:string}}).__SLAYER_CONFIG__??{};
const online=config.wsUrl?new WebSocketClient():null;
if(online) online.connect(config.wsUrl!);

window.addEventListener("pointerdown",()=>void audio.resume(),{once:true});

let matchStarted = false;
function startMatch(): void {
  if (matchStarted) return;
  matchStarted = true;
  match.start();
  match.kickOff("home");
}
window.addEventListener("keydown",event=>{
  if(event.key==="Shift") input.setSprint(true);
  const key=event.key.toLowerCase();
  const keys:Record<string,[number,number]>={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
  const move=keys[key];
  if(move) input.setMovement(move[0],move[1]);
  if(key==="1") input.setAction("Pass",.55);
  if(key==="2") input.setAction("Shoot",.85);
  if(key==="3") input.setAction("Control",.3);
});
window.addEventListener("keyup",event=>{
  if(event.key==="Shift") input.setSprint(false);
  if("wasd".includes(event.key.toLowerCase())) input.setMovement(0,0);
});

let last=window.performance.now();
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
  if(action==="Control") {
    gameplay.execute(players,ball,playerId,"Control",direction,power);
    return;
  }
  if(action==="Shoot"||action==="Pass"||action==="ThroughBall"||action==="Cross"||action==="Clearance") {
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
    if(!intent) continue;
    executeAction(p.data.playerId,intent.action,intent.targetDirection,intent.power);
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
  const ballSpeed=Math.hypot(ball.state.velocity.x,ball.state.velocity.y,ball.state.velocity.z);
  const crossedGoalLine=(previousBallZ > -52.0 && ball.state.position.z <= -52.0) || (previousBallZ < 52.0 && ball.state.position.z >= 52.0);
  if(ballSpeed>10 && crossedGoalLine) nets[ball.state.position.z<0?0:1].impact(new THREE.Vector3(ball.state.position.x,ball.state.position.y,0),Math.min(2,ballSpeed/15));
  previousBallZ=ball.state.position.z;
  detectGoal();
  match.update(delta);
  world.update(delta);
  ball.setSurface(world.weather==="Rain" ? "GrassWet" : "GrassDry",world.wetness);
  pitch.setWetness(world.wetness);
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
  camera.update(renderer.camera,ball.state.position);

  const snapshot=match.snapshot();
  ui.updateMatch(snapshot.score.homeGoals,snapshot.score.awayGoals,match.clock.format(),snapshot.phase.toUpperCase());
  if(online) online.send({type:"snapshot",ball:{...ball.state.position},time:snapshot.timeSeconds});

  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);