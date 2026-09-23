import type { PlayerIntentPacket } from "./NetworkTypes";

const ACTIONS = new Set([
  "None","Pass","Shoot","ThroughBall","Cross","Clearance","Tackle","Header",
  "Control","Dribble","SkillMove","ProtectBall","Press","Contain","Intercept",
  "StandingTackle","SlideTackle","GoalkeeperAction"
]);

export class ServerValidation {
  validate(packet: PlayerIntentPacket): boolean {
    return Number.isFinite(packet.moveX)
      && Number.isFinite(packet.moveZ)
      && Math.hypot(packet.moveX, packet.moveZ) <= 1.001
      && Number.isFinite(packet.power)
      && packet.power >= 0
      && packet.power <= 1
      && Number.isFinite(packet.clientTime)
      && ACTIONS.has(packet.action);
  }
}
