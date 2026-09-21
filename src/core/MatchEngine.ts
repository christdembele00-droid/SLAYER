import { MatchEventBus } from "./MatchEvents";
import { MatchClock } from "./MatchClock";
import { MatchRules } from "./MatchRules";
import { RestartSystem, RestartType } from "./RestartSystem";
import {
  GoalEvent,
  MatchPhase,
  MatchPeriod,
  MatchSnapshot,
  TeamSide,
  Vector3Like
} from "./MatchTypes";

export class MatchEngine {
  readonly clock = new MatchClock();
  readonly events = new MatchEventBus();
  readonly rules: MatchRules;
  readonly restarts = new RestartSystem();

  phase = MatchPhase.Loading;
  period = MatchPeriod.None;

  private penaltyAttempts = { home: 0, away: 0 };

  constructor(config: ConstructorParameters<typeof MatchRules>[0] = {}) {
    this.rules = new MatchRules(config);
  }

  start(): void {
    if (this.phase !== MatchPhase.Loading) return;

    this.phase = MatchPhase.Preparing;
    this.period = MatchPeriod.FirstHalf;
    this.clock.reset();
    this.rules.resetScore();
    this.restarts.reset();
    this.penaltyAttempts = { home: 0, away: 0 };

    this.events.emit({
      name: "MatchStarted",
      matchTime: 0,
      period: this.period,
      payload: undefined
    });
    this.emitPeriodChanged();
  }

  kickOff(team: TeamSide = "home"): void {
    if (this.phase !== MatchPhase.Preparing) return;

    this.phase = MatchPhase.KickOff;
    this.restarts.begin("KickOff", team);
    this.emitRestartStarted("KickOff", team);

    this.events.emit({
      name: "KickOff",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { team }
    });

    this.restarts.complete();
    this.events.emit({
      name: "RestartCompleted",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { type: "KickOff", team }
    });

    this.phase = MatchPhase.FirstHalf;
    this.clock.start();
    this.emitPeriodChanged();
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

    if (
      this.phase === MatchPhase.FirstHalf ||
      this.phase === MatchPhase.SecondHalf ||
      this.phase === MatchPhase.ExtraTime
    ) {
      this.clock.update(deltaSeconds);
      this.advanceIfNeeded();
    }
  }

  private advanceIfNeeded(): void {
    const half = this.rules.config.halfDurationSeconds;
    if (this.clock.seconds < half) return;

    if (this.period === MatchPeriod.FirstHalf) {
      this.clock.stop();
      this.phase = MatchPhase.HalfTime;
      this.period = MatchPeriod.HalfTime;
      this.events.emit({
        name: "HalfTime",
        matchTime: this.clock.seconds,
        period: this.period,
        payload: undefined
      });
      this.emitPeriodChanged();
      return;
    }

    if (this.period === MatchPeriod.SecondHalf) {
      this.clock.stop();

      if (this.rules.isDraw() && this.rules.config.extraTimeEnabled) {
        this.phase = MatchPhase.ExtraTime;
        this.period = MatchPeriod.ExtraTimeFirstHalf;
        this.clock.reset();
        this.emitPeriodChanged();
        return;
      }

      if (this.rules.isDraw() && this.rules.config.penaltiesEnabled) {
        this.beginPenaltyShootout();
        return;
      }

      this.finishMatch();
      return;
    }

    if (this.period === MatchPeriod.ExtraTimeFirstHalf) {
      this.clock.stop();
      this.period = MatchPeriod.ExtraTimeHalfTime;
      this.events.emit({
        name: "HalfTime",
        matchTime: this.clock.seconds,
        period: this.period,
        payload: undefined
      });
      this.emitPeriodChanged();
      return;
    }

    if (this.period === MatchPeriod.ExtraTimeSecondHalf) {
      this.clock.stop();

      if (this.rules.isDraw() && this.rules.config.penaltiesEnabled) {
        this.beginPenaltyShootout();
      } else {
        this.finishMatch();
      }
    }
  }

  resumeSecondHalf(): void {
    if (this.phase !== MatchPhase.HalfTime) return;

    this.phase = MatchPhase.SecondHalf;
    this.period = MatchPeriod.SecondHalf;
    this.clock.reset();
    this.clock.start();
    this.emitPeriodChanged();
  }

  resumeExtraTimeSecondHalf(): void {
    if (this.period !== MatchPeriod.ExtraTimeHalfTime) return;

    this.phase = MatchPhase.ExtraTime;
    this.period = MatchPeriod.ExtraTimeSecondHalf;
    this.clock.reset();
    this.clock.start();
    this.emitPeriodChanged();
  }

  goal(
    side: TeamSide,
    options: Partial<Omit<GoalEvent, "side" | "ballPosition">> & {
      ballPosition?: Vector3Like;
    } = {}
  ): void {
    if (
      this.phase === MatchPhase.Finished ||
      this.phase === MatchPhase.Aborted ||
      this.period === MatchPeriod.PenaltyShootout
    ) {
      return;
    }

    const goal: GoalEvent = {
      side,
      scoringPlayerId: options.scoringPlayerId,
      assistPlayerId: options.assistPlayerId,
      goalType: options.goalType ?? "Normal",
      ballPosition: options.ballPosition ?? { x: 0, y: 0, z: 0 }
    };

    this.rules.addGoal(side);
    this.clock.stop();
    this.phase = MatchPhase.Preparing;

    this.events.emit({
      name: "Goal",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: goal
    });
  }

  restartAfterGoal(team: TeamSide): void {
    if (this.phase !== MatchPhase.Preparing) return;

    this.restarts.begin("KickOff", team);
    this.emitRestartStarted("KickOff", team);
  }

  beginRestart(
    type: RestartType,
    team: TeamSide,
    position: Vector3Like = { x: 0, y: 0, z: 0 }
  ): void {
    if (
      this.phase === MatchPhase.Finished ||
      this.phase === MatchPhase.Aborted ||
      this.period === MatchPeriod.PenaltyShootout
    ) {
      return;
    }

    this.restarts.begin(type, team, position);
    this.emitRestartStarted(type, team);
  }

  completeRestart(): void {
    const current = this.restarts.current;
    if (!current.active) return;

    this.restarts.complete();
    this.events.emit({
      name: "RestartCompleted",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { type: current.type, team: current.team }
    });

    if (current.type === "KickOff" && this.phase === MatchPhase.Preparing) {
      this.phase =
        this.period === MatchPeriod.SecondHalf
          ? MatchPhase.SecondHalf
          : MatchPhase.FirstHalf;
      this.clock.start();
      this.emitPeriodChanged();
    }
  }

  takePenalty(side: TeamSide, scored: boolean): void {
    if (this.phase !== MatchPhase.PenaltyShootout) return;

    if (this.penaltyAttempts[side] >= 5 && this.penaltyAttempts.home === this.penaltyAttempts.away) {
      // Sudden-death rounds continue one attempt per team.
    }

    this.penaltyAttempts[side] += 1;
    if (scored) this.rules.addPenaltyShootoutGoal(side);

    this.events.emit({
      name: "PenaltyTaken",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: {
        side,
        scored,
        attempt: this.penaltyAttempts[side],
        homePenaltyGoals: this.rules.score.homePenaltyGoals,
        awayPenaltyGoals: this.rules.score.awayPenaltyGoals
      }
    });

    if (this.canFinishShootout()) {
      this.finishMatch();
    }
  }

  finishMatch(): void {
    if (this.phase === MatchPhase.Finished) return;

    this.clock.stop();
    this.phase = MatchPhase.Finished;
    this.period = MatchPeriod.None;
    this.restarts.reset();

    this.events.emit({
      name: "MatchEnded",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: undefined
    });
  }

  abort(): void {
    if (
      this.phase === MatchPhase.Finished ||
      this.phase === MatchPhase.Aborted
    ) {
      return;
    }

    this.clock.stop();
    this.phase = MatchPhase.Aborted;

    this.events.emit({
      name: "MatchEnded",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: undefined
    });
  }

  snapshot(): MatchSnapshot {
    return {
      phase: this.phase,
      period: this.period,
      timeSeconds: this.clock.seconds,
      score: { ...this.rules.score },
      restart: {
        type: this.restarts.current.type,
        team: this.restarts.current.team,
        active: this.restarts.current.active,
        position: { ...this.restarts.current.position }
      }
    };
  }

  private beginPenaltyShootout(): void {
    this.clock.stop();
    this.phase = MatchPhase.PenaltyShootout;
    this.period = MatchPeriod.PenaltyShootout;
    this.penaltyAttempts = { home: 0, away: 0 };

    this.events.emit({
      name: "PenaltyAwarded",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { reason: "ShootoutStarted" }
    });
    this.emitPeriodChanged();
  }

  private canFinishShootout(): boolean {
    const home = this.rules.score.homePenaltyGoals;
    const away = this.rules.score.awayPenaltyGoals;
    const homeAttempts = this.penaltyAttempts.home;
    const awayAttempts = this.penaltyAttempts.away;

    // A shootout cannot end before both teams have taken the same number
    // of kicks, unless the trailing team can no longer catch up.
    if (homeAttempts === awayAttempts && homeAttempts < 5) return false;

    if (homeAttempts === awayAttempts && homeAttempts >= 5) {
      if (home !== away) return true;
      return homeAttempts > 5;
    }

    const trailingAttempts = Math.min(homeAttempts, awayAttempts);
    if (trailingAttempts >= 5 && home !== away) {
      const maxPossibleHome = home + Math.max(0, 5 - homeAttempts);
      const maxPossibleAway = away + Math.max(0, 5 - awayAttempts);
      return maxPossibleHome < away || maxPossibleAway < home;
    }

    return false;
  }

  private emitRestartStarted(type: RestartType, team: TeamSide): void {
    this.events.emit({
      name: "RestartStarted",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { type, team }
    });
  }

  private emitPeriodChanged(): void {
    this.events.emit({
      name: "PeriodChanged",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { phase: this.phase, period: this.period }
    });
  }
}