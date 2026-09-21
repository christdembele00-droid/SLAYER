export type TeamSide = "home" | "away";

export enum MatchPhase {
  Loading = "Loading",
  Preparing = "Preparing",
  KickOff = "KickOff",
  FirstHalf = "FirstHalf",
  HalfTime = "HalfTime",
  SecondHalf = "SecondHalf",
  ExtraTime = "ExtraTime",
  PenaltyShootout = "PenaltyShootout",
  Finished = "Finished",
  Aborted = "Aborted"
}

export enum MatchPeriod {
  None = "None",
  FirstHalf = "FirstHalf",
  HalfTime = "HalfTime",
  SecondHalf = "SecondHalf",
  ExtraTimeFirstHalf = "ExtraTimeFirstHalf",
  ExtraTimeHalfTime = "ExtraTimeHalfTime",
  ExtraTimeSecondHalf = "ExtraTimeSecondHalf",
  PenaltyShootout = "PenaltyShootout"
}

export type GoalType =
  | "Normal" | "OwnGoal" | "Penalty" | "FreeKick"
  | "Header" | "LongRange" | "Rebound";

export interface MatchScore {
  homeGoals: number;
  awayGoals: number;
  homePenaltyGoals: number;
  awayPenaltyGoals: number;
}

export interface MatchConfig {
  halfDurationSeconds: number;
  extraTimeEnabled: boolean;
  penaltiesEnabled: boolean;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface GoalEvent {
  side: TeamSide;
  scoringPlayerId?: string;
  assistPlayerId?: string;
  goalType: GoalType;
  ballPosition: Vector3Like;
}

export interface MatchSnapshot {
  phase: MatchPhase;
  period: MatchPeriod;
  timeSeconds: number;
  score: Readonly<MatchScore>;
  restart: {
    type: string;
    team: TeamSide;
    active: boolean;
    position: Vector3Like;
  };
}