export type MatchEventName =
  | "MatchStarted"
  | "KickOff"
  | "Goal"
  | "Foul"
  | "YellowCard"
  | "RedCard"
  | "Offside"
  | "Corner"
  | "GoalKick"
  | "ThrowIn"
  | "FreeKick"
  | "PenaltyAwarded"
  | "PenaltyTaken"
  | "Shot"
  | "Save"
  | "BallOut"
  | "HalfTime"
  | "MatchEnded";

export interface MatchEvent<T = unknown> {
  name: MatchEventName;
  matchTime: number;
  period: string;
  payload?: T;
}

type Listener<T = unknown> = (event: MatchEvent<T>) => void;

export class MatchEventBus {
  private listeners = new Map<MatchEventName, Set<Listener>>();

  on<T>(name: MatchEventName, listener: Listener<T>): () => void {
    const set = this.listeners.get(name) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(name, set);
    return () => set.delete(listener as Listener);
  }

  emit<T>(event: MatchEvent<T>): void {
    this.listeners.get(event.name)?.forEach(listener => listener(event));
  }
}