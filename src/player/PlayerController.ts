import { PlayerData, PlayerIntent, PlayerRuntimeState } from "./PlayerTypes";
import { PlayerMovement } from "./PlayerMovement";

export class PlayerController {
  readonly movement = new PlayerMovement();

  createState(data: PlayerData, position = { x: 0, y: 0, z: 0 }): PlayerRuntimeState {
    return {
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      locomotion: "Idle",
      ballMode: "NoBall",
      action: "None",
      stamina: data.physical.stamina,
      dribbleStyle: "Balanced",
      ballProtection: 0
    };
  }

  update(data: PlayerData, state: PlayerRuntimeState, intent: PlayerIntent, delta: number): void {
    this.movement.update(data, state, intent, delta);
    state.action = intent.action;
  }
}