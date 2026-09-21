import { PlayerData, PlayerIntent, PlayerRuntimeState } from "./PlayerTypes";

const WALK_SPEED = 2;
const RUN_SPEED = 5.5;
const SPRINT_SPEED = 8.5;
const ACCELERATION = 8;
const DECELERATION = 10;
const MAX_ROTATION = 720 * Math.PI / 180;
const SPRINT_COST = 8;
const STAMINA_RECOVERY = 4;

export class PlayerMovement {
  update(data: PlayerData, state: PlayerRuntimeState, intent: PlayerIntent, delta: number): void {
    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    const input = Math.min(Math.max(intent.moveMagnitude, 0), 1);
    const hasDirection = Math.hypot(intent.moveDirection.x, intent.moveDirection.z) > 0.001;
    const sprinting = intent.sprintPressed && input >= 0.8 && hasDirection && state.stamina > 0;

    const fatigue = 1 - (1 - Math.max(0, Math.min(100, state.stamina)) / 100) * 0.35;
    const targetSpeed = sprinting ? SPRINT_SPEED : input >= 0.2 ? (input >= 0.5 ? RUN_SPEED : WALK_SPEED + (RUN_SPEED - WALK_SPEED) * ((input - 0.2) / 0.3)) : 0;
    const target = targetSpeed * fatigue;

    const dirLength = Math.hypot(intent.moveDirection.x, intent.moveDirection.z);
    const dx = dirLength > 0 ? intent.moveDirection.x / dirLength : 0;
    const dz = dirLength > 0 ? intent.moveDirection.z / dirLength : 0;

    const targetVX = dx * target;
    const targetVZ = dz * target;
    const rate = target > Math.hypot(state.velocity.x, state.velocity.z) ? data.physical.acceleration : DECELERATION;

    const blend = Math.min(1, rate * safeDelta / Math.max(target > 0 ? 1 : 0.001, target));
    state.velocity.x += (targetVX - state.velocity.x) * blend;
    state.velocity.z += (targetVZ - state.velocity.z) * blend;
    state.position.x += state.velocity.x * safeDelta;
    state.position.z += state.velocity.z * safeDelta;

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    if (speed < 0.1) state.locomotion = "Idle";
    else if (sprinting) state.locomotion = "Sprint";
    else if (speed < WALK_SPEED + 0.4) state.locomotion = "Walk";
    else if (speed < RUN_SPEED + 0.4) state.locomotion = "Run";
    else state.locomotion = "Sprint";

    if (speed > 0.15) {
      const targetRotation = Math.atan2(state.velocity.x, state.velocity.z);
      let diff = targetRotation - state.rotationY;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const maxTurn = MAX_ROTATION * safeDelta;
      state.rotationY += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }

    if (sprinting) state.stamina = Math.max(0, state.stamina - SPRINT_COST * safeDelta);
    else state.stamina = Math.min(data.physical.stamina, state.stamina + STAMINA_RECOVERY * safeDelta);

    state.lastIntent = intent;
  }
}