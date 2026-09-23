import { Ball } from "../ball/Ball";
import { PlayerSystem } from "../player/PlayerSystem";
import { MatchEngine } from "../core/MatchEngine";
import { TeamSide } from "../core/MatchTypes";
import { RestartType } from "../core/RestartSystem";

const FIELD_HALF_WIDTH = 34;
const FIELD_HALF_LENGTH = 52.5;
const GOAL_HALF_WIDTH = 3.66;
const CROSSBAR_HEIGHT = 2.44;

export interface RestartResolution {
  type: RestartType | "Goal";
  team: TeamSide;
  position: { x: number; y: number; z: number };
}

export class MatchFlowSystem {
  private previous = { x: 0, y: 0.11, z: 0 };

  reset(ball: Ball): void {
    this.previous = { ...ball.state.position };
  }

  update(ball: Ball, players: PlayerSystem, match: MatchEngine): RestartResolution | null {
    const current = { ...ball.state.position };
    const phase = match.phase;
    const active =
      phase === "FirstHalf" ||
      phase === "SecondHalf" ||
      phase === "ExtraTime";

    if (!active || ball.state.state === "Controlled") {
      this.previous = current;
      return null;
    }

    const previous = this.previous;
    const endline = this.crossedEndline(previous.z, current.z);
    const sideBoundary = Math.abs(current.x) > FIELD_HALF_WIDTH && Math.abs(previous.x) <= FIELD_HALF_WIDTH;

    if (endline !== 0) {
      const cross = this.crossingPoint(previous, current, endline);
      const inGoal = Math.abs(cross.x) <= GOAL_HALF_WIDTH && cross.y <= CROSSBAR_HEIGHT + 0.05;

      if (inGoal) {
        const scoringSide: TeamSide = endline > 0 ? "home" : "away";
        match.goal(scoringSide, {
          scoringPlayerId:
            ball.state.lastContactTeamId === scoringSide
              ? ball.state.lastContactPlayerId
              : undefined,
          ballPosition: cross
        });
        const result: RestartResolution = {
          type: "Goal",
          team: scoringSide === "home" ? "away" : "home",
          position: { x: 0, y: 0.11, z: 0 }
        };
        this.resetBall(ball, result.position);
        this.positionRestartTaker(players, ball, result.team, result.position, "KickOff");
        match.restartAfterGoal(result.team);
        match.completeRestart();
        this.previous = { ...ball.state.position };
        return result;
      }

      const defending: TeamSide = endline > 0 ? "away" : "home";
      const lastTeam = ball.state.lastContactTeamId as TeamSide | undefined;
      const restartTeam: TeamSide =
        lastTeam === defending
          ? (defending === "home" ? "away" : "home")
          : defending;

      const corner =
        lastTeam === defending && Math.abs(cross.x) <= FIELD_HALF_WIDTH + 0.5;
      const type: RestartType = corner ? "Corner" : "GoalKick";
      const position = corner
        ? {
            x: Math.sign(cross.x || 1) * (FIELD_HALF_WIDTH - 0.25),
            y: 0.11,
            z: endline > 0 ? FIELD_HALF_LENGTH - 0.25 : -FIELD_HALF_LENGTH + 0.25
          }
        : {
            x: Math.max(-7, Math.min(7, cross.x)),
            y: 0.11,
            z: endline > 0 ? FIELD_HALF_LENGTH - 6 : -FIELD_HALF_LENGTH + 6
          };

      this.restart(match, ball, players, type, restartTeam, position);
      const result: RestartResolution = { type, team: restartTeam, position };
      this.previous = { ...ball.state.position };
      return result;
    }

    if (sideBoundary) {
      const lastTeam = ball.state.lastContactTeamId as TeamSide | undefined;
      const restartTeam: TeamSide =
        lastTeam === "home" ? "away" : "home";
      const x = current.x > 0 ? FIELD_HALF_WIDTH - 0.15 : -FIELD_HALF_WIDTH + 0.15;
      const position = {
        x,
        y: 0.11,
        z: Math.max(-FIELD_HALF_LENGTH, Math.min(FIELD_HALF_LENGTH, current.z))
      };
      this.restart(match, ball, players, "ThrowIn", restartTeam, position);
      const result: RestartResolution = { type: "ThrowIn", team: restartTeam, position };
      this.previous = { ...ball.state.position };
      return result;
    }

    this.previous = current;
    return null;
  }

  private crossedEndline(previousZ: number, currentZ: number): -1 | 0 | 1 {
    if (previousZ < FIELD_HALF_LENGTH && currentZ >= FIELD_HALF_LENGTH) return 1;
    if (previousZ > -FIELD_HALF_LENGTH && currentZ <= -FIELD_HALF_LENGTH) return -1;
    return 0;
  }

  private crossingPoint(
    previous: { x: number; y: number; z: number },
    current: { x: number; y: number; z: number },
    lineZ: number
  ) {
    const denominator = current.z - previous.z;
    const t = Math.abs(denominator) < 0.0001
      ? 1
      : Math.max(0, Math.min(1, (lineZ - previous.z) / denominator));
    return {
      x: previous.x + (current.x - previous.x) * t,
      y: previous.y + (current.y - previous.y) * t,
      z: lineZ
    };
  }

  public restart(
    match: MatchEngine,
    ball: Ball,
    players: PlayerSystem,
    type: RestartType,
    team: TeamSide,
    position: { x: number; y: number; z: number }
  ): void {
    match.beginRestart(type, team, position);
    this.resetBall(ball, position);
    this.positionRestartTaker(players, ball, team, position, type);
    match.completeRestart();
  }

  private positionRestartTaker(
    players: PlayerSystem,
    ball: Ball,
    team: TeamSide,
    position: { x: number; y: number; z: number },
    type: RestartType
  ): void {
    const candidates = players.all()
      .filter(p => p.data.teamId === team)
      .filter(p => type === "GoalKick" || type === "Penalty" ? p.data.position === "GK" || p.data.position !== "GK" : true)
      .filter(p => type !== "Penalty" || p.data.position !== "GK");

    const taker = candidates
      .slice()
      .sort((a, b) =>
        Math.hypot(a.state.position.x - position.x, a.state.position.z - position.z) -
        Math.hypot(b.state.position.x - position.x, b.state.position.z - position.z)
      )[0];

    if (!taker) return;

    if (type === "ThrowIn") {
      taker.state.position = {
        x: Math.max(-FIELD_HALF_WIDTH + 0.35, Math.min(FIELD_HALF_WIDTH - 0.35, position.x)),
        y: 0,
        z: position.z
      };
      taker.state.rotationY = position.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else if (type === "Corner") {
      const dz = position.z > 0 ? -1 : 1;
      taker.state.position = { x: position.x * 0.92, y: 0, z: position.z + dz * 0.8 };
      taker.state.rotationY = Math.atan2(position.x - taker.state.position.x, position.z - taker.state.position.z);
    } else if (type === "GoalKick") {
      taker.state.position = { x: position.x * 0.4, y: 0, z: position.z + (position.z > 0 ? 2.0 : -2.0) };
      taker.state.rotationY = position.z > 0 ? Math.PI : 0;
    } else if (type === "Penalty") {
      const goalZ = team === "home" ? FIELD_HALF_LENGTH : -FIELD_HALF_LENGTH;
      const fromGoal = team === "home" ? -13.4 : 13.4;
      taker.state.position = { x: 0, y: 0, z: goalZ + fromGoal };
      taker.state.rotationY = team === "home" ? 0 : Math.PI;
    } else {
      taker.state.position = {
        x: Math.max(-FIELD_HALF_WIDTH + 1, Math.min(FIELD_HALF_WIDTH - 1, position.x)),
        y: 0,
        z: Math.max(-FIELD_HALF_LENGTH + 1, Math.min(FIELD_HALF_LENGTH - 1, position.z))
      };
      const forward = team === "home" ? 1 : -1;
      taker.state.rotationY = Math.atan2(0, forward);
    }

    taker.state.ballMode = "Control";
    taker.state.action = "Control";
    taker.state.lastIntent = undefined;
    ball.state.controlledByPlayerId = taker.data.playerId;
    ball.state.state = "Controlled";
    ball.state.position = { x: taker.state.position.x, y: 0.11, z: taker.state.position.z };
  }

  private resetBall(ball: Ball, position: { x: number; y: number; z: number }): void {
    ball.setPosition(position);
    ball.state.velocity = { x: 0, y: 0, z: 0 };
    ball.state.angularVelocity = { x: 0, y: 0, z: 0 };
    ball.state.state = "Free";
    ball.state.controlledByPlayerId = undefined;
  }
}
