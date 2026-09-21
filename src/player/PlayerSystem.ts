import { Player } from "./Player";
import { PlayerData, PlayerIntent } from "./PlayerTypes";

export class PlayerSystem {
  private players = new Map<string, Player>();

  add(player: Player): void {
    this.players.set(player.data.playerId, player);
  }

  remove(playerId: string): void {
    this.players.delete(playerId);
  }

  get(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  all(): readonly Player[] {
    return [...this.players.values()];
  }

  create(data: PlayerData, position = { x: 0, y: 0, z: 0 }): Player {
    const player = new Player(data, {}, position);
    this.add(player);
    return player;
  }

  updateIntents(intents: Map<string, PlayerIntent>, delta: number): void {
    for (const player of this.players.values()) {
      const intent = intents.get(player.data.playerId);
      if (intent) player.update(intent, delta);
    }
  }
}