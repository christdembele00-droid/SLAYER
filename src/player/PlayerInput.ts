import { PlayerAction, PlayerIntent } from "./PlayerTypes";

export class PlayerInput {
  private intent: PlayerIntent = {
    moveDirection: { x: 0, y: 0, z: 0 },
    moveMagnitude: 0,
    sprintPressed: false,
    action: "None",
    targetDirection: { x: 0, y: 0, z: 1 },
    power: 0,
    timestamp: 0
  };

  setMovement(x: number, z: number, timestamp = performance.now()): void {
    const magnitude = Math.min(1, Math.hypot(x, z));
    this.intent.moveDirection = { x, y: 0, z };
    this.intent.moveMagnitude = magnitude;
    this.intent.timestamp = timestamp;
  }

  setSprint(pressed: boolean): void { this.intent.sprintPressed = pressed; }
  setAction(action: PlayerAction, power = 0): void {
    this.intent.action = action;
    this.intent.power = Math.min(1, Math.max(0, power));
  }

  snapshot(): PlayerIntent {
    return {
      ...this.intent,
      moveDirection: { ...this.intent.moveDirection },
      targetDirection: { ...this.intent.targetDirection }
    };
  }
}