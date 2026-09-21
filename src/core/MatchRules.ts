import { MatchConfig, MatchPhase, MatchScore } from "./MatchTypes";

export class MatchRules {
  readonly config: MatchConfig;
  readonly score: MatchScore = { homeGoals: 0, awayGoals: 0 };

  constructor(config: Partial<MatchConfig> = {}) {
    this.config = {
      halfDurationSeconds: config.halfDurationSeconds ?? 45 * 60,
      extraTimeEnabled: config.extraTimeEnabled ?? false,
      penaltiesEnabled: config.penaltiesEnabled ?? true
    };
  }

  addGoal(side: "home" | "away"): void {
    if (side === "home") this.score.homeGoals += 1;
    else this.score.awayGoals += 1;
  }

  canAdvanceFrom(phase: MatchPhase): boolean {
    return phase !== MatchPhase.Finished && phase !== MatchPhase.Aborted;
  }
}