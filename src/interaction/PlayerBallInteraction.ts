import { Ball } from "../ball/Ball";
import { Player } from "../player/Player";
import { BallContactType } from "../ball/BallTypes";
import { ContactEvaluation } from "./InteractionTypes";

const ACCESS_RADIUS = 1.65;
const EFFECTIVE_RADIUS = 1.05;
const CONTACT_RADIUS = 0.72;

export class PlayerBallInteraction {
  evaluate(player: Player, ball: Ball, type: BallContactType = "Control"): ContactEvaluation {
    const dx = ball.state.position.x - player.state.position.x;
    const dy = ball.state.position.y - (player.state.position.y + 0.45);
    const dz = ball.state.position.z - player.state.position.z;
    const distance = Math.hypot(dx, dy, dz);
    const horizontal = Math.hypot(dx, dz) || 1;
    const targetAngle = Math.atan2(dx, dz);
    let angleDelta = Math.atan2(Math.sin(targetAngle - player.state.rotationY), Math.cos(targetAngle - player.state.rotationY));
    angleDelta = Math.abs(angleDelta);
    const normalizedAngle = Math.min(1, angleDelta / Math.PI);
    const timingError = Math.min(1, distance / ACCESS_RADIUS);

    let level: 0 | 1 | 2 = distance > ACCESS_RADIUS ? 0 : distance > EFFECTIVE_RADIUS ? 1 : 2;
    if (level === 2 && Math.abs(dy) > 0.8) level = 1;

    const anglePenalty = normalizedAngle;
    const qualityScore = Math.max(0, 1 - distance / ACCESS_RADIUS) * 0.65 + (1 - anglePenalty) * 0.35;
    let quality: ContactEvaluation["quality"] = "Good";
    if (distance > ACCESS_RADIUS) quality = "Miss";
    else if (qualityScore > 0.82) quality = "Perfect";
    else if (qualityScore > 0.58) quality = "Good";
    else if (anglePenalty > 0.72) quality = "BadAngle";
    else if (distance > EFFECTIVE_RADIUS) quality = "Late";

    const foot = this.selectFoot(player, dx, dz);
    const controlResult =
      quality === "Perfect" ? "Perfect" :
      quality === "Good" ? "Good" :
      quality === "Late" ? "Loose" :
      quality === "Miss" ? "Missed" : "Bad";

    return { level, distance, angle: angleDelta, timingError, quality, foot, controlResult };
  }

  control(player: Player, ball: Ball, evaluation = this.evaluate(player, ball, "Control")): boolean {
    if (evaluation.level < 2 || evaluation.quality === "Miss") return false;
    const incoming = Math.hypot(ball.state.velocity.x, ball.state.velocity.z);
    const controlFactor = evaluation.controlResult === "Perfect" ? 0.32 : evaluation.controlResult === "Good" ? 0.55 : 0.8;
    ball.state.velocity.x *= controlFactor;
    ball.state.velocity.y *= 0.35;
    ball.state.velocity.z *= controlFactor;
    ball.state.state = "Controlled";
    player.state.ballMode = "Control";
    player.state.controlResult = evaluation.controlResult;
    player.state.action = "Control";
    if (incoming < 0.05) ball.state.velocity.x = ball.state.velocity.z = 0;
    return true;
  }

  kick(player: Player, ball: Ball, direction: { x: number; y: number; z: number }, power: number, type: BallContactType): boolean {
    const evaluation = this.evaluate(player, ball, type);
    if (evaluation.level < 2 || evaluation.quality === "Miss") return false;
    const technique = this.technicalModifier(player, type);
    const quality = this.qualityModifier(evaluation.quality);
    const adjustedPower = Math.min(1, Math.max(0, power * technique * quality));
    const origin = { ...ball.state.position };
    ball.physics.applyImpulse(ball.state, {
      x: direction.x * (8 + 20 * adjustedPower),
      y: direction.y * (4 + 8 * adjustedPower),
      z: direction.z * (8 + 20 * adjustedPower)
    }, {
      x: 0,
      y: (player.data.preferredFoot === "right" ? 1 : -1) * adjustedPower * 3,
      z: 0
    }, { playerId: player.data.playerId, teamId: player.data.teamId, type, time: performance.now() / 1000 });
    player.state.ballMode = "NoBall";
    player.state.action = type === "Shot" ? "Shoot" : type === "Pass" ? "Pass" : type === "ThroughBall" ? "ThroughBall" : type === "Cross" ? "Cross" : type === "Clearance" ? "Clearance" : "None";
    void origin;
    return true;
  }

  predict(ball: Ball, seconds: number): { x: number; y: number; z: number } {
    const t = Math.max(0, seconds);
    return {
      x: ball.state.position.x + ball.state.velocity.x * t,
      y: Math.max(ball.physics.data.radius, ball.state.position.y + ball.state.velocity.y * t - 0.5 * 9.81 * t * t),
      z: ball.state.position.z + ball.state.velocity.z * t
    };
  }

  private selectFoot(player: Player, dx: number, dz: number) {
    if (player.data.preferredFoot === "left") return "left" as const;
    return Math.abs(dx) > Math.abs(dz) ? "right" as const : "right" as const;
  }

  private technicalModifier(player: Player, type: BallContactType): number {
    const t = player.data.technical;
    const value = type === "Shot" ? t.shooting : type === "Cross" ? t.crossing : type === "Clearance" ? t.heading : t.passing;
    return 0.65 + Math.max(0, Math.min(100, value)) / 100 * 0.35;
  }

  private qualityModifier(quality: ContactEvaluation["quality"]): number {
    return quality === "Perfect" ? 1 : quality === "Good" ? 0.92 : quality === "Late" ? 0.72 : 0.55;
  }
}