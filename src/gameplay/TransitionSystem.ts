import { PlayerSystem } from "../player/PlayerSystem";
import { Ball } from "../ball/Ball";
import { TeamSide } from "../core/MatchTypes";
import { PlayerIntent } from "../player/PlayerTypes";

export type TeamPhase = "Attacking" | "Defending" | "TransitionToAttack" | "TransitionToDefense";
export type TransitionTrigger = "PossessionWon" | "PossessionLost" | "None";

export interface TeamTransitionState {
  phase: TeamPhase;
  trigger: TransitionTrigger;
  timer: number;
  possessionPlayerId?: string;
}

export class TransitionSystem {
  private readonly states: Record<TeamSide, TeamTransitionState> = {
    home: { phase: "Defending", trigger: "None", timer: 0 },
    away: { phase: "Defending", trigger: "None", timer: 0 }
  };
  private previousOwner?: string;
  private previousOwnerTeam?: TeamSide;

  update(players: PlayerSystem, ball: Ball, delta: number): void {
    const ownerId = ball.state.controlledByPlayerId;
    const owner = ownerId ? players.get(ownerId) : undefined;
    const ownerTeam = owner?.data.teamId as TeamSide | undefined;
    const trigger: TransitionTrigger =
      ownerTeam && this.previousOwnerTeam && ownerTeam !== this.previousOwnerTeam
        ? "PossessionWon"
        : !ownerTeam && this.previousOwnerTeam
          ? "PossessionLost"
          : "None";

    if (trigger !== "None" && this.previousOwnerTeam) {
      const losing = this.previousOwnerTeam;
      const gaining = ownerTeam;
      this.states[losing] = {
        phase: gaining ? "TransitionToDefense" : "Defending",
        trigger: "PossessionLost",
        timer: 0.9,
        possessionPlayerId: undefined
      };
      if (gaining) {
        this.states[gaining] = {
          phase: "TransitionToAttack",
          trigger: "PossessionWon",
          timer: 1.2,
          possessionPlayerId: ownerId
        };
      }
    }

    for (const team of ["home", "away"] as TeamSide[]) {
      const state = this.states[team];
      state.timer = Math.max(0, state.timer - delta);
      if (state.timer === 0) {
        state.phase = ownerTeam === team ? "Attacking" : "Defending";
        state.trigger = "None";
        state.possessionPlayerId = ownerTeam === team ? ownerId : undefined;
      }
      this.applyShape(players, ball, team, state);
    }

    this.previousOwner = ownerId;
    this.previousOwnerTeam = ownerTeam;
  }

  getState(team: TeamSide): TeamTransitionState {
    return { ...this.states[team] };
  }

  private applyShape(players: PlayerSystem, ball: Ball, team: TeamSide, state: TeamTransitionState): void {
    const side = team === "home" ? 1 : -1;
    const attacking = state.phase === "Attacking" || state.phase === "TransitionToAttack";
    const transitionBoost = state.phase === "TransitionToAttack" ? 1.35 : state.phase === "TransitionToDefense" ? 1.55 : 1;
    const targetZBias = attacking ? side * 4 : -side * 3;
    const ballX = ball.state.position.x;
    const ballZ = ball.state.position.z;

    for (const p of players.all()) {
      if (p.data.teamId !== team || p.data.position === "GK") continue;
      const dx = ballX - p.state.position.x;
      const dz = ballZ - p.state.position.z;
      const distance = Math.hypot(dx, dz) || 1;
      const pressing = !attacking && distance < 14;
      const cover = state.phase === "TransitionToDefense" && distance < 24;
      const urgency = pressing ? 1.15 : cover ? transitionBoost : 1;
      const intent: PlayerIntent = p.state.lastIntent ?? {
        moveDirection: { x: 0, y: 0, z: 0 },
        moveMagnitude: 0,
        sprintPressed: false,
        action: "None",
        targetDirection: { x: 0, y: 0, z: 1 },
        power: 0,
        timestamp: 0
      };
      if (pressing || cover || state.phase === "TransitionToAttack") {
        p.state.lastIntent = {
          ...intent,
          moveDirection: {
            x: dx * urgency,
            y: 0,
            z: dz * urgency + targetZBias
          },
          moveMagnitude: Math.min(1, Math.max(0.2, distance / 12)),
          sprintPressed: state.phase === "TransitionToAttack" || state.phase === "TransitionToDefense" || pressing
        };
      }
    }
  }
}
