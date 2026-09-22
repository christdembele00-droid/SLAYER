import type { PlayerIntentPacket, Snapshot } from "./NetworkTypes";

export class AuthoritativeSession {
  private sequence = 0;
  private readonly intents = new Map<string, PlayerIntentPacket>();

  receiveIntent(packet: PlayerIntentPacket): void {
    if (this.validateIntent(packet)) {
      this.intents.set(packet.playerId, packet);
    }
  }

  validateIntent(packet: PlayerIntentPacket): boolean {
    return Number.isFinite(packet.moveX)
      && Number.isFinite(packet.moveZ)
      && Math.abs(packet.moveX) <= 1
      && Math.abs(packet.moveZ) <= 1
      && Number.isFinite(packet.power)
      && packet.power >= 0
      && packet.power <= 1;
  }

  nextSnapshot(snapshot: Snapshot): Snapshot {
    return {
      ...snapshot,
      sequence: ++this.sequence,
      serverTime: Date.now(),
    };
  }
}
