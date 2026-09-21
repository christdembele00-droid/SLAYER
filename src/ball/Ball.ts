import { Vector3Like } from "../core/MatchTypes";
import { BallPhysics } from "./BallPhysics";
import { BallContactType, BallRuntimeState, BallSurface, Foot } from "./BallTypes";

export class Ball {
  readonly physics = new BallPhysics();
  readonly state: BallRuntimeState = {
    state: "Free",
    surface: "GrassDry",
    wetness: 0,
    position: { x: 0, y: 0.11, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    lastContactTime: 0
  };

  update(delta: number): void { this.physics.update(this.state, delta); }

  kick(direction: Vector3Like, power: number, contact: BallContactType = "Shot", foot: Foot = "right", playerVelocity = { x: 0, y: 0, z: 0 }): void {
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const p = Math.min(1, Math.max(0, power));
    const impulseMagnitude = 8 + 20 * p;
    const vertical = Math.max(0, direction.y / length) * impulseMagnitude;
    const impulse = {
      x: (direction.x / length) * impulseMagnitude + playerVelocity.x * this.physics.data.mass,
      y: vertical + 1.2 * p,
      z: (direction.z / length) * impulseMagnitude + playerVelocity.z * this.physics.data.mass
    };
    const spinSign = foot === "right" ? 1 : -1;
    this.physics.applyImpulse(this.state, impulse, { x: 0, y: spinSign * p * 4, z: 0 }, { type: contact, time: performance.now() / 1000 });
  }

  setPosition(position: Vector3Like): void { this.state.position = { ...position }; }
  setSurface(surface: BallSurface, wetness?: number): void { this.physics.setSurface(this.state, surface, wetness); }
}