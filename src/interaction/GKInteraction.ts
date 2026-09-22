import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";

export type GKResult = "Catch" | "Parry" | "Deflect" | "Miss";

export interface GKSaveReport {
  result: GKResult;
  distance: number;
  reaction: number;
}

export class GKInteraction {
  resolve(goalkeeper: Player, ball: Ball): GKResult {
    return this.resolveDetailed(goalkeeper, ball).result;
  }

  resolveDetailed(goalkeeper: Player, ball: Ball): GKSaveReport {
    if (goalkeeper.data.position !== "GK" || !goalkeeper.data.goalkeeper) {
      return { result: "Miss", distance: Infinity, reaction: 0 };
    }

    const dx = ball.state.position.x - goalkeeper.state.position.x;
    const dy = ball.state.position.y - (goalkeeper.state.position.y + 0.9);
    const dz = ball.state.position.z - goalkeeper.state.position.z;
    const distance = Math.hypot(dx, dy, dz);
    const gk = goalkeeper.data.goalkeeper;
    const reach = 0.85 + gk.reach / 100;
    if (distance > reach) return { result: "Miss", distance, reaction: 0 };

    const speed = Math.hypot(ball.state.velocity.x, ball.state.velocity.y, ball.state.velocity.z);
    const reaction = Math.min(1, (gk.reflexes * 0.55 + gk.diving * 0.3 + goalkeeper.data.mental.reactions * 0.15) / 100);
    const handling = gk.handling / 100;
    const catchThreshold = 7 + handling * 5;

    if (speed <= catchThreshold) {
      ball.state.velocity = { x: 0, y: 0, z: 0 };
      ball.state.state = "Controlled";
      ball.state.controlledByPlayerId = goalkeeper.data.playerId;
      goalkeeper.state.ballMode = "Control";
      goalkeeper.state.action = "GoalkeeperAction";
      return { result: "Catch", distance, reaction };
    }

    const parryChance = Math.min(0.96, reaction * 0.72 + gk.punching / 100 * 0.2);
    if (reaction > 0.58 && distance < reach && parryChance > 0.62) {
      const away = goalkeeper.data.teamId === "home" ? 1 : -1;
      ball.state.velocity = {
        x: ball.state.velocity.x * 0.25,
        y: Math.max(1.2, ball.state.velocity.y * 0.2 + 2 * reaction),
        z: away * (4 + 5 * reaction)
      };
      ball.state.state = "InFlight";
      ball.state.controlledByPlayerId = undefined;
      goalkeeper.state.ballMode = "NoBall";
      goalkeeper.state.action = "GoalkeeperAction";
      return { result: "Parry", distance, reaction };
    }

    ball.state.velocity.x *= -0.18;
    ball.state.velocity.z *= -0.18;
    ball.state.state = "InFlight";
    ball.state.controlledByPlayerId = undefined;
    goalkeeper.state.ballMode = "NoBall";
    goalkeeper.state.action = "GoalkeeperAction";
    return { result: "Deflect", distance, reaction };
  }
}
