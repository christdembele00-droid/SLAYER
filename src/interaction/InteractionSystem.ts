import { Ball } from "../ball/Ball";
import { PlayerSystem } from "../player/PlayerSystem";
import { BallContactType } from "../ball/BallTypes";
import { PlayerBallInteraction } from "./PlayerBallInteraction";

export class InteractionSystem {
  readonly playerBall = new PlayerBallInteraction();

  update(playerSystem: PlayerSystem, ball: Ball): void {
    for (const player of playerSystem.all()) {
      if (player.state.ballMode !== "Control") continue;
      const evaluation = this.playerBall.evaluate(player, ball, "Control");
      if (evaluation.level === 0) player.state.ballMode = "NoBall";
    }
  }

  tryControl(playerSystem: PlayerSystem, playerId: string, ball: Ball): boolean {
    const player = playerSystem.get(playerId);
    return !!player && this.playerBall.control(player, ball);
  }

  tryKick(playerSystem: PlayerSystem, playerId: string, ball: Ball, direction: { x: number; y: number; z: number }, power: number, type: BallContactType): boolean {
    const player = playerSystem.get(playerId);
    return !!player && this.playerBall.kick(player, ball, direction, power, type);
  }
}