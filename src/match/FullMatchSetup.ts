import { PlayerSystem } from "../player/PlayerSystem";
import { PlayerFactory } from "../player/PlayerFactory";
import { PlayerPosition } from "../player/PlayerTypes";
import { HOME_TEAM, AWAY_TEAM } from "./TeamData";

const slots: PlayerPosition[] = ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"];

const formations = [
  { team: HOME_TEAM, positions: [[-34, -49], [-17, -39], [-5, -43], [8, -43], [25, -39], [-12, -25], [4, -25], [0, -10], [-25, -18], [25, -18], [0, -5]] },
  { team: AWAY_TEAM, positions: [[-34, 49], [-25, 39], [-8, 43], [5, 43], [22, 39], [-4, 25], [12, 25], [0, 10], [-25, 18], [25, 18], [0, 5]] }
] as const;

export class FullMatchSetup {
  populate(ps: PlayerSystem): void {
    if (ps.all().length >= 22) return;

    for (const formation of formations) {
      for (let i = 0; i < slots.length; i++) {
        const playerId = `${formation.team.id}-${i + 1}`;
        const data = PlayerFactory.createPlayerData(
          playerId,
          `${formation.team.name} ${i + 1}`,
          formation.team.id,
          slots[i]
        );
        const player = ps.create(data);
        const [x, z] = formation.positions[i];
        player.state.position = { x, y: 0, z };
      }
    }
  }
}
