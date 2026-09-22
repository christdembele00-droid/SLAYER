export type GameMode="Friendly"|"Training"|"League"|"Cup"|"Tournament"|"Career"|"Online";
export interface FriendlyConfig{homeTeamId:string;awayTeamId:string;stadiumId:string;weather:string;difficulty:number;duration:number;}
export interface Competition{competitionId:string;name:string;teams:string[];format:"league"|"cup"|"groups_knockout";seasonId:string;}