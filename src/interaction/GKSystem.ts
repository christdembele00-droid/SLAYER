import { Ball } from "../ball/Ball";
import { PlayerSystem } from "../player/PlayerSystem";
import { GKInteraction, GKResult } from "./GKInteraction";

export class GKSystem {
  readonly interaction = new GKInteraction();

  update(players: PlayerSystem, ball: Ball): GKResult[] {
    const reports: GKResult[] = [];
    for (const keeper of players.all()) {
      if (keeper.data.position !== "GK" || !keeper.data.goalkeeper) continue;

      const goalZ = keeper.data.teamId === "home" ? -48 : 48;
      const ballZ = ball.state.position.z;
      const danger = keeper.data.teamId === "home" ? ballZ < -38 : ballZ > 38;
      const targetX = Math.max(-3.45, Math.min(3.45, ball.state.position.x));
      const response = danger ? 0.12 : 0.035;
      keeper.state.position.x += (targetX - keeper.state.position.x) * response;
      keeper.state.position.z += (goalZ - keeper.state.position.z) * 0.08;

      const vx = ball.state.velocity.z;
      const movingTowardGoal = keeper.data.teamId === "home" ? vx < -3 : vx > 3;
      if (danger && movingTowardGoal && ball.state.state !== "Controlled") {
        const report = this.interaction.resolve(keeper, ball);
        if (report !== "Miss") reports.push(report);
      }
    }
    return reports;
  }
}
