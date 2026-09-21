import { BallPhysicsData, BallRuntimeState, BallSurface } from "./BallTypes";

const G = 9.81;
const AIR_DENSITY = 1.225;

export class BallPhysics {
  readonly data: BallPhysicsData = {
    mass: 0.43,
    radius: 0.11,
    airDensity: AIR_DENSITY,
    drag: 0.018,
    friction: 0.35,
    restitution: 0.48,
    magnusCoefficient: 0.08
  };

  update(state: BallRuntimeState, delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 0.033);
    if (dt <= 0 || state.state === "Controlled" || state.state === "OutOfBounds") return;

    const speed = this.length(state.velocity);
    const dragFactor = 0.5 * this.data.airDensity * this.data.drag * speed;
    const drag = speed > 0 ? this.scale(state.velocity, dragFactor / this.data.mass) : { x: 0, y: 0, z: 0 };

    const spinCrossVelocity = {
      x: state.angularVelocity.y * state.velocity.z - state.angularVelocity.z * state.velocity.y,
      y: state.angularVelocity.z * state.velocity.x - state.angularVelocity.x * state.velocity.z,
      z: state.angularVelocity.x * state.velocity.y - state.angularVelocity.y * state.velocity.x
    };
    const magnus = this.scale(spinCrossVelocity, this.data.magnusCoefficient * (this.data.airDensity / AIR_DENSITY));

    state.velocity.x += (-drag.x + magnus.x) * dt;
    state.velocity.y += (-G - drag.y + magnus.y) * dt;
    state.velocity.z += (-drag.z + magnus.z) * dt;

    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;

    const ground = state.surface === "GrassWet" ? 0.5 : state.surface === "Mud" ? 0.7 : this.data.friction;
    if (state.position.y <= this.data.radius) {
      state.position.y = this.data.radius;
      if (state.velocity.y < -0.5) {
        state.velocity.y = -state.velocity.y * this.data.restitution;
        state.state = "Bouncing";
      } else {
        state.velocity.y = 0;
        state.state = "Free";
        const horizontal = Math.hypot(state.velocity.x, state.velocity.z);
        const damping = Math.max(0, 1 - ground * dt);
        state.velocity.x *= damping;
        state.velocity.z *= damping;
        if (horizontal < 0.05) {
          state.velocity.x = 0;
          state.velocity.z = 0;
        }
      }
    } else {
      state.state = "InFlight";
    }

    const spinDamping = Math.max(0, 1 - 0.12 * dt);
    state.angularVelocity.x *= spinDamping;
    state.angularVelocity.y *= spinDamping;
    state.angularVelocity.z *= spinDamping;
  }

  applyImpulse(state: BallRuntimeState, impulse: { x: number; y: number; z: number }, spin = { x: 0, y: 0, z: 0 }, contact?: { playerId?: string; teamId?: string; type?: BallRuntimeState["lastContactType"]; time?: number }): void {
    state.velocity.x += impulse.x / this.data.mass;
    state.velocity.y += impulse.y / this.data.mass;
    state.velocity.z += impulse.z / this.data.mass;
    state.angularVelocity.x += spin.x;
    state.angularVelocity.y += spin.y;
    state.angularVelocity.z += spin.z;
    state.state = "InFlight";
    state.lastContactPlayerId = contact?.playerId;
    state.lastContactTeamId = contact?.teamId;
    state.lastContactType = contact?.type;
    state.lastContactTime = contact?.time ?? 0;
  }

  setSurface(state: BallRuntimeState, surface: BallSurface, wetness = state.wetness): void {
    state.surface = surface;
    state.wetness = Math.min(1, Math.max(0, wetness));
  }

  private length(v: { x: number; y: number; z: number }): number {
    return Math.hypot(v.x, v.y, v.z);
  }

  private scale(v: { x: number; y: number; z: number }, s: number) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }
}