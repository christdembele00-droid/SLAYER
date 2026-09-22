import type { PlayerIntentPacket, Snapshot } from "./NetworkTypes";

export class AuthoritativeSession {
  private sequence = 0;
  private readonly intents = new Map<string, PlayerIntentPacket>();
  private readonly lastClientTime = new Map<string, number>();

  receiveIntent(packet: PlayerIntentPacket): void {
    if (!this.validateIntent(packet)) return;
    const previous = this.lastClientTime.get(packet.playerId) ?? -Infinity;
    if (packet.clientTime < previous) return;
    this.lastClientTime.set(packet.playerId, packet.clientTime);
    this.intents.set(packet.playerId, packet);
  }

  validateIntent(packet: PlayerIntentPacket): boolean {
    return Number.isFinite(packet.moveX)
      && Number.isFinite(packet.moveZ)
      && Math.abs(packet.moveX) <= 1
      && Math.abs(packet.moveZ) <= 1
      && Number.isFinite(packet.power)
      && packet.power >= 0
      && packet.power <= 1
      && Number.isFinite(packet.clientTime)
      && packet.clientTime >= 0;
  }

  nextSnapshot(snapshot: Snapshot): Snapshot {
    return {
      ...snapshot,
      sequence: ++this.sequence,
      serverTime: Date.now(),
    };
  }
}
