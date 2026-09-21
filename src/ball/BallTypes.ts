import { Vector3Like } from "../core/MatchTypes";

export type BallState = "Free" | "Controlled" | "InFlight" | "Bouncing" | "OutOfBounds";
export type BallSurface = "GrassDry" | "GrassWet" | "Mud" | "GoalNet" | "GoalPost" | "Concrete";
export type BallContactType = "Control" | "Pass" | "LongPass" | "ThroughBall" | "Cross" | "Shot" | "Header" | "Clearance";
export type Foot = "left" | "right";

export interface BallPhysicsData {
  mass: number;
  radius: number;
  airDensity: number;
  drag: number;
  friction: number;
  restitution: number;
  magnusCoefficient: number;
}

export interface BallRuntimeState {
  state: BallState;
  surface: BallSurface;
  wetness: number;
  position: Vector3Like;
  velocity: Vector3Like;
  angularVelocity: Vector3Like;
  lastContactPlayerId?: string;
  lastContactTeamId?: string;
  lastContactType?: BallContactType;
  lastContactTime: number;
}