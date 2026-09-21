import { MatchEventBus } from "./MatchEvents";
import { MatchClock } from "./MatchClock";
import { MatchRules } from "./MatchRules";
import { RestartSystem, RestartType } from "./RestartSystem";
import { MatchPhase, MatchPeriod } from "./MatchTypes";

export class MatchEngine {
  readonly clock = new MatchClock();
  readonly events = new MatchEventBus();
  readonly rules = new MatchRules();
  readonly restarts = new RestartSystem();

  phase = MatchPhase.Loading;
  period = MatchPeriod.None;

  start(): void {
    this.phase = MatchPhase.Preparing;
    this.period = MatchPeriod.FirstHalf;
    this.events.emit({ name: "MatchStarted", matchTime: 0, period: this.period });
  }

  kickOff(team: "home" | "away" = "home"): void {
    this.phase = MatchPhase.FirstHalf;
    this.period = MatchPeriod.FirstHalf;
    this.restarts.begin("KickOff", team);
    this.clock.start();
    this.events.emit({ name: "KickOff", matchTime: this.clock.seconds, period: this.period });
    this.restarts.complete();
  }

  update(deltaSeconds: number): void {
    this.clock.update(deltaSeconds);
  }

  beginRestart(type: RestartType, team: "home" | "away", position = { x: 0, y: 0, z: 0 }): void {
    this.restarts.begin(type, team, position);
  }

  completeRestart(): void {
    this.restarts.complete();
  }

  goal(side: "home" | "away", playerId?: string): void {
    this.rules.addGoal(side);
    this.clock.stop();
    this.phase = MatchPhase.Preparing;
    this.events.emit({
      name: "Goal",
      matchTime: this.clock.seconds,
      period: this.period,
      payload: { side, playerId }
    });
  }
}