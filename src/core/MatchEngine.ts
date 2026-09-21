import { MatchEventBus } from "./MatchEvents";
import { MatchClock } from "./MatchClock";
import { MatchRules } from "./MatchRules";
import { MatchPhase, MatchPeriod } from "./MatchTypes";

export class MatchEngine {
  readonly clock = new MatchClock();
  readonly events = new MatchEventBus();
  readonly rules = new MatchRules();

  phase = MatchPhase.Loading;
  period = MatchPeriod.None;

  start(): void {
    this.phase = MatchPhase.Preparing;
    this.period = MatchPeriod.FirstHalf;
    this.events.emit({ name: "MatchStarted", matchTime: 0, period: this.period });
  }

  kickOff(): void {
    this.phase = MatchPhase.FirstHalf;
    this.period = MatchPeriod.FirstHalf;
    this.clock.start();
    this.events.emit({ name: "KickOff", matchTime: this.clock.seconds, period: this.period });
  }

  update(deltaSeconds: number): void {
    this.clock.update(deltaSeconds);
  }

  goal(side: "home" | "away", playerId?: string): void {
    this.rules.addGoal(side);
    this.events.emit({
      name: "Goal",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { side, playerId }
    });
  }
}