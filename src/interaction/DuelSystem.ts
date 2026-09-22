import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";

export type DuelResult = "CleanTackle" | "LooseBall" | "Miss" | "Foul" | "Continue";

export class DuelSystem {
  resolve(attacker: Player, defender: Player, ball: Ball): DuelResult {
    const dx = attacker.state.position.x - defender.state.position.x;
    const dz = attacker.state.position.z - defender.state.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1.8) return "Miss";

    const attackPower = attacker.data.physical.strength + attacker.data.physical.balance + attacker.data.technical.dribbling;
    const defensePower = defender.data.physical.strength + defender.data.physical.balance + defender.data.technical.tackling;
    const pressure = Math.min(1, Math.hypot(defender.state.velocity.x, defender.state.velocity.z) / 8.5);
    const score = defensePower * (0.65 + pressure * 0.35) - attackPower * 0.55;
    if (score > 35) {
      ball.state.state = "Free";
      attacker.state.ballMode = "NoBall";
      defender.state.ballMode = "Control";
      return "CleanTackle";
    }
    if (score > 5) {
      ball.state.state = "Free";
      attacker.state.ballMode = "NoBall";
      defender.state.ballMode = "NoBall";
      return "LooseBall";
    }
    return "Continue";
  }
}