import { PlayerSystem } from "../player/PlayerSystem";
import { Ball } from "../ball/Ball";
import { PlayerIntent } from "../player/PlayerTypes";
import { defaultTactic } from "./FootballAI";

export class TacticalBrain {
  readonly tactic = defaultTactic;

  update(ps: PlayerSystem, b: Ball): void {
    const bx = b.state.position.x;
    const bz = b.state.position.z;

    for (const p of ps.all()) {
      const dx = bx - p.state.position.x;
      const dz = bz - p.state.position.z;
      const distance = Math.hypot(dx, dz);
      const current: PlayerIntent = p.state.lastIntent ?? {
        moveDirection: { x: 0, y: 0, z: 0 },
        moveMagnitude: 0,
        sprintPressed: false,
        action: "None",
        targetDirection: { x: 0, y: 0, z: 0 },
        power: 0,
        timestamp: 0
      };

      if (distance <= 2) continue;

      const side = p.data.teamId === "home" ? 1 : -1;
      const direction = { x: dx * side, y: 0, z: dz * side };
      const magnitude = Math.min(1, distance / 10);

      p.state.lastIntent = {
        ...current,
        moveDirection: direction,
        moveMagnitude: magnitude,
        sprintPressed: current.sprintPressed || (distance > 8 && magnitude > 0.75)
      };
    }
  }
}