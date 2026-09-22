import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";

export type DuelResult = "CleanTackle" | "LooseBall" | "Miss" | "Foul" | "Continue";

export interface DuelContext {
  time: number;
  seed?: number;
}

export class DuelSystem {
  resolve(attacker: Player, defender: Player, ball: Ball, context: DuelContext = { time: 0 }): DuelResult {
    const dx = attacker.state.position.x - defender.state.position.x;
    const dz = attacker.state.position.z - defender.state.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1.8) return "Miss";

    const attackPower = attacker.data.physical.strength + attacker.data.physical.balance + attacker.data.technical.dribbling;
    const defensePower = defender.data.physical.strength + defender.data.physical.balance + defender.data.technical.tackling;
    const pressure = Math.min(1, Math.hypot(defender.state.velocity.x, defender.state.velocity.z) / 8.5);
    const control = attacker.data.technical.ballControl + attacker.data.mental.composure;
    const tackle = defender.data.technical.tackling + defender.data.physical.agility;
    const challenge = defensePower * (0.55 + pressure * 0.35) - attackPower * 0.5;
    const foulRisk = Math.max(0, defender.data.mental.aggression - attacker.data.physical.balance) / 100;
    const deterministic = Math.abs(Math.sin((context.time + (context.seed ?? 0)) * 12.9898));
    if (foulRisk > 0.72 && deterministic < foulRisk * 0.18) return "Foul";

    const score = challenge + (tackle - control) * 0.2;
    if (score > 35) {
      ball.state.state = "Controlled";
      ball.state.controlledByPlayerId = defender.data.playerId;
      attacker.state.ballMode = "NoBall";
      defender.state.ballMode = "Control";
      defender.state.ballProtection = Math.min(100, defender.data.physical.strength * 0.6);
      return "CleanTackle";
    }
    if (score > 5) {
      ball.state.state = "Free";
      ball.state.controlledByPlayerId = undefined;
      attacker.state.ballMode = "NoBall";
      defender.state.ballMode = "NoBall";
      return "LooseBall";
    }
    return "Continue";
  }
}
