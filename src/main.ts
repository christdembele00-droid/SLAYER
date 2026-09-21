import * as THREE from "three";
import "./styles.css";
import { MatchEngine } from "./core/MatchEngine";
import { SceneRenderer } from "./render/SceneRenderer";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("SLAYER root element not found");

const renderer = new SceneRenderer(app);
const match = new MatchEngine();
match.start();
match.kickOff();

const hud = document.createElement("div");
hud.className = "hud";
hud.innerHTML = '<div class="score">SLAYER &nbsp; 0 — 0</div><div class="status">PHASE 1 · CORE MATCH</div>';
app.appendChild(hud);

const clockLabel = hud.querySelector(".status") as HTMLDivElement;

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
  clockLabel.textContent = `PHASE 1 · CORE MATCH · ${match.clock.format()}`;

  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);