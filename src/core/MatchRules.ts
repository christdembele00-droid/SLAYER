import { MatchConfig, MatchPhase, MatchScore, TeamSide } from "./MatchTypes";

export class MatchRules {
  readonly config: MatchConfig;
  readonly score: MatchScore = {
    homeGoals: 0,
    awayGoals: 0,
    homePenaltyGoals: 0,
    awayPenaltyGoals: 0
  };

  constructor(config: Partial<MatchConfig> = {}) {
    this.config = {
      halfDurationSeconds: config.halfDurationSeconds ?? 45 * 60,
      extraTimeEnabled: config.extraTimeEnabled ?? false,
      penaltiesEnabled: config.penaltiesEnabled ?? true
    };
  }

  resetScore(): void {
    this.score.homeGoals = 0;
    this.score.awayGoals = 0;
    this.score.homePenaltyGoals = 0;
    this.score.awayPenaltyGoals = 0;
  }

  addGoal(side: TeamSide): void {
    if (side === "home") this.score.homeGoals += 1;
    else this.score.awayGoals += 1;
  }

  addPenaltyShootoutGoal(side: TeamSide): void {
    if (side === "home") this.score.homePenaltyGoals += 1;
    else this.score.awayPenaltyGoals += 1;
  }

  canAdvanceFrom(phase: MatchPhase): boolean {
    return phase !== MatchPhase.Finished && phase !== MatchPhase.Aborted;
  }

  isDraw(): boolean {
    return this.score.homeGoals === this.score.awayGoals;
  }
}