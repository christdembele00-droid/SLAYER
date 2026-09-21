import { GoalEvent, MatchPeriod, MatchPhase, TeamSide } from "./MatchTypes";

export type MatchEventName =
  | "MatchStarted" | "KickOff" | "Goal" | "Foul" | "YellowCard" | "RedCard"
  | "Offside" | "Corner" | "GoalKick" | "ThrowIn" | "FreeKick"
  | "PenaltyAwarded" | "PenaltyTaken" | "Shot" | "Save" | "BallOut"
  | "HalfTime" | "MatchEnded" | "PeriodChanged" | "RestartStarted" | "RestartCompleted";

export interface MatchEventPayloads {
  MatchStarted: undefined;
  KickOff: { team: TeamSide };
  Goal: GoalEvent;
  Foul: unknown;
  YellowCard: unknown;
  RedCard: unknown;
  Offside: unknown;
  Corner: unknown;
  GoalKick: unknown;
  ThrowIn: unknown;
  FreeKick: unknown;
  PenaltyAwarded: unknown;
  PenaltyTaken: unknown;
  Shot: unknown;
  Save: unknown;
  BallOut: unknown;
  HalfTime: undefined;
  MatchEnded: undefined;
  PeriodChanged: { phase: MatchPhase; period: MatchPeriod };
  RestartStarted: { type: string; team: TeamSide };
  RestartCompleted: { type: string; team: TeamSide };
}

export interface MatchEvent<K extends MatchEventName = MatchEventName> {
  name: K;
  matchTime: number;
  period: MatchPeriod;
  payload: MatchEventPayloads[K];
}

type Listener<K extends MatchEventName> = (event: MatchEvent<K>) => void;

export class MatchEventBus {
  private listeners = new Map<MatchEventName, Set<Listener<any>>>();

  on<K extends MatchEventName>(name: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(name) ?? new Set<Listener<any>>();
    set.add(listener as Listener<any>);
    this.listeners.set(name, set);
    return () => set.delete(listener as Listener<any>);
  }

  emit<K extends MatchEventName>(
    event: MatchEvent<K>
  ): void {
    this.listeners.get(event.name)?.forEach(listener => listener(event));
  }
}