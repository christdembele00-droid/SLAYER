export type RestartType =
  | "KickOff"
  | "ThrowIn"
  | "GoalKick"
  | "Corner"
  | "FreeKick"
  | "Penalty";

export interface RestartState {
  type: RestartType;
  team: "home" | "away";
  active: boolean;
  position: { x: number; y: number; z: number };
}

export class RestartSystem {
  private state: RestartState = {
    type: "KickOff",
    team: "home",
    active: false,
    position: { x: 0, y: 0, z: 0 }
  };

  begin(type: RestartType, team: "home" | "away", position = { x: 0, y: 0, z: 0 }): void {
    this.state = { type, team, active: true, position: { ...position } };
  }

  complete(): void {
    this.state.active = false;
  }

  get current(): Readonly<RestartState> {
    return this.state;
  }
}