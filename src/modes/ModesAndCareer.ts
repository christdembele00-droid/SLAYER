export type GameMode="Friendly"|"Training"|"League"|"Cup"|"Tournament"|"Career"|"Online";
export interface Competition{
  id:string;
  name:string;
  teams:string[];
  format:"league"|"cup"|"groups_knockout";
  seasonId:string;
}

export type { CareerPlayerState, CareerState } from "../career/CareerTypes";
export { CareerSystem } from "../career/CareerSystem";

export class ModeSystem{
  mode:GameMode="Friendly";
  setMode(m:GameMode){this.mode=m;}
}
