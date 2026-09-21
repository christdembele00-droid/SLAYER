import { TeamSide, Vector3Like } from "./MatchTypes";

export type RestartType =
  | "KickOff" | "ThrowIn" | "GoalKick" | "Corner" | "FreeKick" | "Penalty";

export interface RestartState {
  type: RestartType;
  team: TeamSide;
  active: boolean;
  position: Vector3Like;
}

export class RestartSystem {
  private state: RestartState = {
    type: "KickOff",
    team: "home",
    active: false,
    position: { x: 0, y: 0, z: 0 }
  };

  begin(type: RestartType, team: TeamSide, position: Vector3Like = { x: 0, y: 0, z: 0 }): void {
    this.state = { type, team, active: true, position: { ...position } };
  }

  complete(): void {
    this.state.active = false;
  }

  reset(): void {
    this.state = {
      type: "KickOff",
      team: "home",
      active: false,
      position: { x: 0, y: 0, z: 0 }
    };
  }

  get current(): Readonly<RestartState> {
    return this.state;
  }
}