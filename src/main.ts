import * as THREE from "three";
import "./styles.css";
import { MatchEngine } from "./core/MatchEngine";
import { SceneRenderer } from "./render/SceneRenderer";
import { MatchField } from "./render/MatchField";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("SLAYER root element not found");

const renderer = new SceneRenderer(app);
const field = new MatchField();
renderer.scene.add(field.group);

const match = new MatchEngine({
  halfDurationSeconds: 45 * 60,
  extraTimeEnabled: true,
  penaltiesEnabled: true
});

match.start();
match.kickOff("home");

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

let last = performance.now();

function frame(now: number) {
  const delta = Math.min((now - last) / 1000, 0.05);
  last = now;

  match.update(delta);
  ball.rotation.x += delta * 2;
  ball.rotation.z += delta * 1.3;

  const snapshot = match.snapshot();
  homeScore.textContent = String(snapshot.score.homeGoals);
  awayScore.textContent = String(snapshot.score.awayGoals);
  status.textContent = `PHASE 1 · ${snapshot.phase.toUpperCase()} · ${match.clock.format()}`;

  renderer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
