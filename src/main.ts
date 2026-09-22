import * as THREE from "three";
import "./styles.css";
import { MatchEngine } from "./core/MatchEngine";
import { SceneRenderer } from "./render/SceneRenderer";
import { MatchField } from "./render/MatchField";
import { PlayerFactory } from "./player/PlayerFactory";
import { PlayerSystem } from "./player/PlayerSystem";
import { PlayerInput } from "./player/PlayerInput";
import { PlayerMesh } from "./player/PlayerMesh";
import { BallSystem } from "./ball/BallSystem";
import { InteractionSystem } from "./interaction/InteractionSystem";
import { GameplaySystem } from "./gameplay/GameSystems";
import { FootballAI } from "./ai/FootballAI";
import { AnimationSystem } from "./animation/PresentationSystems";
import { CameraDirector } from "./animation/PresentationSystems";
import { WorldSystem, QualityManager } from "./world/WorldSystems";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("SLAYER root element not found");

const renderer = new SceneRenderer(app);
const field = new MatchField();
renderer.scene.add(field.group);

const match = new MatchEngine({ halfDurationSeconds: 45 * 60, extraTimeEnabled: true, penaltiesEnabled: true });
match.start();
match.kickOff("home");

const players = new PlayerSystem();
const input = new PlayerInput();
const meshes: PlayerMesh[] = [];

const demo = [
  ["home-1", "SLAYER 10", "home", "ST", 0, -18],
  ["home-2", "SLAYER 8", "home", "CM", -8, -5],
  ["home-3", "SLAYER 4", "home", "CB", 8, -5],
  ["away-1", "SLAYER 9", "away", "ST", 0, 18],
  ["away-2", "SLAYER 6", "away", "CM", -8, 5],
  ["away-3", "SLAYER 5", "away", "CB", 8, 5]
] as const;

for (const [id, name, team, position, x, z] of demo) {
  const player = players.create(PlayerFactory.createPlayerData(id, name, team, position), { x, y: 0, z });
  const mesh = new PlayerMesh(player);
  renderer.scene.add(mesh.object);
  meshes.push(mesh);
}

const hud = document.createElement("div");
hud.className = "hud";
hud.innerHTML = '<div class="score">SLAYER <span class="home-score">0</span> — <span class="away-score">0</span></div><div class="status"></div>';
app.appendChild(hud);

const status = hud.querySelector(".status") as HTMLDivElement;
const homeScore = hud.querySelector(".home-score") as HTMLSpanElement;
const awayScore = hud.querySelector(".away-score") as HTMLSpanElement;

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })
);
ball.position.set(0, 0.11, 0);
renderer.scene.add(ball);

window.addEventListener("keydown", event => {
  if (event.key === "Shift") input.setSprint(true);
  const keys: Record<string, [number, number]> = {
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
  };
  const move = keys[event.key.toLowerCase()];
  if (move) input.setMovement(move[0], move[1]);
});
window.addEventListener("keyup", event => {
  if (event.key === "Shift") input.setSprint(false);
  if ("wasd".includes(event.key.toLowerCase())) input.setMovement(0, 0);
});

let last = performance.now();
function frame(now: number) {
  const delta = Math.min((now - last) / 1000, 0.05);
  last = now;

  players.updateIntents(new Map([["home-1", input.snapshot()]]), delta);
  match.update(delta);

  for (const mesh of meshes) mesh.sync(players.get(mesh.object.userData.playerId) ?? players.all()[meshes.indexOf(mesh)]);

  const snapshot = match.snapshot();
  homeScore.textContent = String(snapshot.score.homeGoals);
  awayScore.textContent = String(snapshot.score.awayGoals);
  status.textContent = `PHASE 5→15 · GAMEPLAY / AI / WORLD / PRESENTATION / ONLINE READY · ${snapshot.phase.toUpperCase()} · ${match.clock.format()}`;

  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);