import { PlayerController } from "./PlayerController";
import { PlayerData, PlayerIntent, PlayerRuntimeState, PlayerVisualData } from "./PlayerTypes";

export class Player {
  readonly controller = new PlayerController();
  readonly data: PlayerData;
  readonly visual: PlayerVisualData;
  readonly state: PlayerRuntimeState;

  constructor(data: PlayerData, visual: Partial<PlayerVisualData> = {}, position = { x: 0, y: 0, z: 0 }) {
    this.data = data;
    this.visual = {
      body: visual.body ?? "default",
      skin: visual.skin ?? "default",
      hair: visual.hair ?? "default",
      face: visual.face ?? "default",
      kit: visual.kit ?? "default",
      boots: visual.boots ?? "default",
      socks: visual.socks ?? "default",
      accessories: visual.accessories ?? []
    };
    this.state = this.controller.createState(data, position);
  }

  update(intent: PlayerIntent, delta: number): void {
    this.controller.update(this.data, this.state, intent, delta);
  }
}