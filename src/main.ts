import * as THREE from "three";
import "./styles.css";
import { MatchEngine } from "./core/MatchEngine";
import { SceneRenderer } from "./render/SceneRenderer";
import { PlayerFactory } from "./player/PlayerFactory";
import { PlayerSystem } from "./player/PlayerSystem";
import { PlayerInput } from "./player/PlayerInput";
import { PlayerMesh } from "./player/PlayerMesh";
import { FullMatchSetup } from "./match/FullMatchSetup";
import { MatchAI } from "./ai/MatchAI";
import { TacticalBrain } from "./ai/TacticalBrain";
import { BallSystem } from "./ball/BallSystem";
import { InteractionSystem } from "./interaction/InteractionSystem";
import { GameplaySystem } from "./gameplay/GameplaySystem";
import { AnimationSystem, CameraDirector } from "./animation/PresentationSystems";
import { FootballIK } from "./animation/FootballIK";
import { WorldSystem, QualityManager } from "./world/WorldSystems";
import { AAAStadium } from "./render/AAAStadium";
import { CrowdSystem } from "./render/CrowdSystem";
import { GoalNetCloth } from "./world/GoalNetCloth";
import { AudioEngine } from "./audio/AudioEngine";
import { CommentarySystem } from "./audio/CommentarySystem";
import { WebSocketClient } from "./online/WebSocketClient";

const app=document.querySelector<HTMLDivElement>("#app");
if(!app) throw new Error("SLAYER root element not found");

const renderer=new SceneRenderer(app);
const stadium=new AAAStadium(); renderer.scene.add(stadium.group);
const crowd=new CrowdSystem(); renderer.scene.add(crowd.group);
const nets=[new GoalNetCloth(),new GoalNetCloth()];
nets[0].mesh.position.z=-52; nets[1].mesh.position.z=52;
renderer.scene.add(nets[0].mesh,nets[1].mesh);

const world=new WorldSystem();
const quality=new QualityManager();
const match=new MatchEngine({halfDurationSeconds:45*60,extraTimeEnabled:true,penaltiesEnabled:true});
const players=new PlayerSystem();
new FullMatchSetup().populate(players);
const input=new PlayerInput();
const playerMeshes=players.all().map(player=>{const mesh=new PlayerMesh(player);renderer.scene.add(mesh.object);return mesh;});
const ballSystem=new BallSystem();
const ball=ballSystem.ball;
ball.setPosition({x:0,y:.11,z:0});
const interactions=new InteractionSystem();
const gameplay=new GameplaySystem(interactions);
const matchAI=new MatchAI();
const tactical=new TacticalBrain();
const animation=new AnimationSystem();
const camera=new CameraDirector();
const ik=new FootballIK();
const audio=new AudioEngine();
const commentary=new CommentarySystem(audio);
const unsubscribeCommentary=commentary.start(match.events);

const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55}));
renderer.scene.add(ballMesh);

const hud=document.createElement("div"); hud.className="hud";
hud.innerHTML='<div class="score">SLAYER <span class="home-score">0</span> — <span class="away-score">0</span></div><div class="status"></div><div class="commentary"></div>';
app.appendChild(hud);
const status=hud.querySelector(".status") as HTMLDivElement;
const homeScore=hud.querySelector(".home-score") as HTMLSpanElement;
const awayScore=hud.querySelector(".away-score") as HTMLSpanElement;
const commentaryEl=hud.querySelector(".commentary") as HTMLDivElement;

const controlledId="home-1";
const config=(window as unknown as {__SLAYER_CONFIG__?:{wsUrl?:string}}).__SLAYER_CONFIG__??{};
const online=config.wsUrl?new WebSocketClient():null;
if(online) online.connect(config.wsUrl!);

window.addEventListener("pointerdown",()=>void audio.resume(),{once:true});
window.addEventListener("keydown",event=>{
  if(event.key==="Shift")input.setSprint(true);
  const keys:Record<string,[number,number]>={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
  const move=keys[event.key.toLowerCase()]; if(move)input.setMovement(move[0],move[1]);
});
window.addEventListener("keyup",event=>{
  if(event.key==="Shift")input.setSprint(false);
  if("wasd".includes(event.key.toLowerCase()))input.setMovement(0,0);
});

match.start(); match.kickOff("home");
let last=performance.now();
function frame(now:number){
  const delta=Math.min((now-last)/1000,.05); last=now;
  const human=input.snapshot();
  matchAI.update(players,ball,delta);
  tactical.update(players,ball);
  const intents=new Map<string, import("./player/PlayerTypes").PlayerIntent>();
  for (const p of players.all()) { if (p.state.lastIntent) intents.set(p.data.playerId, p.state.lastIntent); }
  intents.set(controlledId,human);
  players.updateIntents(intents,delta);

  for(const p of players.all()){
    const action=p.state.lastIntent?.action??"None";
    if(p.data.playerId!==controlledId && action==="Control") gameplay.execute(players,ball,p.data.playerId,"Control",{x:0,y:0,z:0},0);
    if(p.data.playerId!==controlledId && (action==="Shoot"||action==="Pass")) {
      const dx=ball.state.position.x-p.state.position.x,dz=ball.state.position.z-p.state.position.z;
      gameplay.execute(players,ball,p.data.playerId,action,{x:dx,y:action==="Shoot"?.15:.03,z:dz},action==="Shoot"?.85:.55);
    }
  }
  if(input.snapshot().action!=="None"){
    const h=players.get(controlledId)!;
    const action=input.snapshot().action;
    if (action==="Pass" || action==="Shoot" || action==="ThroughBall" || action==="Cross" || action==="Clearance" || action==="Tackle" || action==="Header" || action==="Control") gameplay.execute(players,ball,controlledId,action,input.snapshot().targetDirection,input.snapshot().power);
  }
  interactions.update(players,ball);
  ballSystem.update(delta);
  match.update(delta);
  world.update(delta);
  quality.update(delta*1000);
  crowd.update(delta,Math.min(1,ball.state.velocity.x**2+ball.state.velocity.z**2)/100);
  nets.forEach(n=>n.update(delta));

  for(const mesh of playerMeshes){const p=players.get(mesh.object.userData.playerId as string);if(p){mesh.sync(p);animation.state(p);}}
  ballMesh.position.set(ball.state.position.x,ball.state.position.y,ball.state.position.z);
  camera.update(renderer.camera,ball.state.position);

  const snapshot=match.snapshot();
  homeScore.textContent=String(snapshot.score.homeGoals);
  awayScore.textContent=String(snapshot.score.awayGoals);
  status.textContent=`22 PLAYERS · AI ${matchAI?"ON":"OFF"} · ${world.weather.toUpperCase()} · ${quality.tier} · ${snapshot.phase.toUpperCase()} · ${match.clock.format()}`;
  commentaryEl.textContent=commentary.recent.at(-1)??"";
  if(online) online.send({type:"snapshot",ball:ball.state.position,time:snapshot.timeSeconds});
  renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio*quality.pixelRatio(),2));
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void unsubscribeCommentary;
void ik;
