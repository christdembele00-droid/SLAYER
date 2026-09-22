import { TeamSide, Vector3Like } from "../core/MatchTypes";

export type PlayerPosition = "GK" | "CB" | "LB" | "RB" | "LWB" | "RWB" | "DM" | "CM" | "AM" | "LW" | "RW" | "ST";
export type PreferredFoot = "left" | "right";
export type LocomotionState = "Idle" | "Walk" | "Run" | "Sprint" | "Brake" | "Turn";
export type BallMode = "NoBall" | "Control";
export type DribbleStyle = "Balanced" | "Close" | "Sprint";
export type PlayerAction = "None" | "Pass" | "Shoot" | "ThroughBall" | "Cross" | "Clearance" | "Tackle" | "Header" | "Control";
export type ControlResult = "Perfect" | "Good" | "Loose" | "Bad" | "Missed";
export type DefensiveAction = "Press" | "Contain" | "Intercept" | "StandingTackle" | "SlideTackle" | "Mark";

export interface PhysicalAttributes {
  acceleration: number;
  maxSpeed: number;
  sprintSpeed: number;
  agility: number;
  balance: number;
  strength: number;
  jump: number;
  stamina: number;
}

export interface TechnicalAttributes {
  passing: number;
  shooting: number;
  ballControl: number;
  dribbling: number;
  crossing: number;
  tackling: number;
  heading: number;
}

export interface MentalAttributes {
  vision: number;
  reactions: number;
  positioning: number;
  composure: number;
  decisions: number;
  aggression: number;
}

export interface GoalkeeperAttributes {
  reflexes: number;
  diving: number;
  handling: number;
  positioning: number;
  reach: number;
  punching: number;
  distribution: number;
  sweeperKeeper: number;
}

export interface PlayerData {
  playerId: string;
  name: string;
  position: PlayerPosition;
  preferredFoot: PreferredFoot;
  height: number;
  weight: number;
  teamId: string;
  physical: PhysicalAttributes;
  technical: TechnicalAttributes;
  mental: MentalAttributes;
  goalkeeper?: GoalkeeperAttributes;
}

export interface PlayerIntent {
  moveDirection: Vector3Like;
  moveMagnitude: number;
  sprintPressed: boolean;
  action: PlayerAction;
  targetDirection: Vector3Like;
  power: number;
  timestamp: number;
}

export interface PlayerRuntimeState {
  position: Vector3Like;
  velocity: Vector3Like;
  rotationY: number;
  locomotion: LocomotionState;
  ballMode: BallMode;
  action: PlayerAction;
  stamina: number;
  controlResult?: ControlResult;
  dribbleStyle: DribbleStyle;
  ballProtection: number;
  lastIntent?: PlayerIntent;
}

export interface PlayerVisualData {
  body: string;
  skin: string;
  hair: string;
  face: string;
  kit: string;
  boots: string;
  socks: string;
  accessories: string[];
}