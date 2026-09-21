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

export interface MatchScore {
  homeGoals: number;
  awayGoals: number;
}

export interface MatchConfig {
  halfDurationSeconds: number;
  extraTimeEnabled: boolean;
  penaltiesEnabled: boolean;
}