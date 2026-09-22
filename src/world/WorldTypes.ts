export type Weather="Clear"|"Cloudy"|"Rain"; export type QualityTier="Ultra"|"High"|"Medium"|"Low";
export interface StadiumData{id:string;name:string;capacity:number;environment:string;lighting:string;}
export interface PitchState{wetness:number;surface:"GrassDry"|"GrassWet"|"Mud";wear:number;}