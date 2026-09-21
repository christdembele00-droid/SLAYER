import { MatchEventBus } from "./MatchEvents";
import { MatchClock } from "./MatchClock";
import { MatchRules } from "./MatchRules";
import { RestartSystem, RestartType } from "./RestartSystem";
import { GoalEvent, MatchPhase, MatchPeriod, MatchSnapshot, TeamSide, Vector3Like } from "./MatchTypes";

export class MatchEngine {
  readonly clock = new MatchClock();
  readonly events = new MatchEventBus();
  readonly rules: MatchRules;
  readonly restarts = new RestartSystem();

  phase = MatchPhase.Loading;
  period = MatchPeriod.None;

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
    this.events.emit({ name: "MatchStarted", matchTime: 0, period: this.period, payload: undefined });
    this.emitPeriodChanged();
  }

  kickOff(team: TeamSide = "home"): void {
    if (this.phase !== MatchPhase.Preparing) return;
    this.phase = MatchPhase.KickOff;
    this.restarts.begin("KickOff", team);
    this.events.emit({ name: "RestartStarted", matchTime: this.clock.seconds, period: this.period, payload: { type: "KickOff", team } });
    this.events.emit({ name: "KickOff", matchTime: this.clock.seconds, period: this.period, payload: { team } });
    this.restarts.complete();
    this.events.emit({ name: "RestartCompleted", matchTime: this.clock.seconds, period: this.period, payload: { type: "KickOff", team } });
    this.phase = MatchPhase.FirstHalf;
    this.clock.start();
    this.emitPeriodChanged();
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    if (this.phase === MatchPhase.FirstHalf || this.phase === MatchPhase.SecondHalf ||
        this.phase === MatchPhase.ExtraTime || this.phase === MatchPhase.KickOff) {
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
      this.events.emit({ name: "HalfTime", matchTime: this.clock.seconds, period: this.period, payload: undefined });
      this.emitPeriodChanged();
      return;
    }

    if (this.period === MatchPeriod.SecondHalf) {
      this.clock.stop();
      if (this.rules.isDraw() && this.rules.config.extraTimeEnabled) {
        this.phase = MatchPhase.ExtraTime;
        this.period = MatchPeriod.ExtraTimeFirstHalf;
        this.clock.reset();
      } else {
        this.finishMatch();
      }
      this.emitPeriodChanged();
      return;
    }

    if (this.period === MatchPeriod.ExtraTimeFirstHalf) {
      this.clock.stop();
      this.period = MatchPeriod.ExtraTimeHalfTime;
      this.events.emit({ name: "HalfTime", matchTime: this.clock.seconds, period: this.period, payload: undefined });
      this.emitPeriodChanged();
      return;
    }

    if (this.period === MatchPeriod.ExtraTimeSecondHalf) {
      this.finishMatch();
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

  goal(side: TeamSide, options: Partial<Omit<GoalEvent, "side" | "ballPosition">> & { ballPosition?: Vector3Like } = {}): void {
    if (this.phase === MatchPhase.Finished || this.phase === MatchPhase.Aborted) return;
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
    this.events.emit({ name: "Goal", matchTime: this.clock.seconds, period: this.period, payload: goal });
  }

  restartAfterGoal(team: TeamSide): void {
    if (this.phase !== MatchPhase.Preparing) return;
    this.restarts.begin("KickOff", team);
    this.events.emit({ name: "RestartStarted", matchTime: this.clock.seconds, period: this.period, payload: { type: "KickOff", team } });
  }

  completeRestart(): void {
    const current = this.restarts.current;
    if (!current.active) return;
    this.restarts.complete();
    this.events.emit({ name: "RestartCompleted", matchTime: this.clock.seconds, period: this.period, payload: { type: current.type, team: current.team } });
    if (current.type === "KickOff" && this.phase === MatchPhase.Preparing) {
      this.phase = this.period === MatchPeriod.SecondHalf ? MatchPhase.SecondHalf : MatchPhase.FirstHalf;
      this.clock.start();
      this.emitPeriodChanged();
    }
  }

  beginRestart(type: RestartType, team: TeamSide, position: Vector3Like = { x: 0, y: 0, z: 0 }): void {
    if (this.phase === MatchPhase.Finished || this.phase === MatchPhase.Aborted) return;
    this.restarts.begin(type, team, position);
    this.events.emit({ name: "RestartStarted", matchTime: this.clock.seconds, period: this.period, payload: { type, team } });
  }

  finishMatch(): void {
    if (this.phase === MatchPhase.Finished) return;
    this.clock.stop();
    this.phase = MatchPhase.Finished;
    this.period = MatchPeriod.None;
    this.events.emit({ name: "MatchEnded", matchTime: this.clock.seconds, period: this.period, payload: undefined });
  }

  abort(): void {
    if (this.phase === MatchPhase.Finished || this.phase === MatchPhase.Aborted) return;
    this.clock.stop();
    this.phase = MatchPhase.Aborted;
    this.events.emit({ name: "MatchEnded", matchTime: this.clock.seconds, period: this.period, payload: undefined });
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

  private emitPeriodChanged(): void {
    this.events.emit({
      name: "PeriodChanged",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { phase: this.phase, period: this.period }
    });
  }
}