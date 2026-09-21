import { Vector3Like } from "../core/MatchTypes";
import { BallContactType, Foot } from "../ball/BallTypes";
import { ControlResult } from "../player/PlayerTypes";

export type ContactLevel = 0 | 1 | 2;
export type ContactQuality = "Perfect" | "Good" | "Late" | "Early" | "BadAngle" | "WeakContact" | "Miss";

export interface BallContactData {
  contactPoint: Vector3Like;
  contactNormal: Vector3Like;
  contactDirection: Vector3Like;
  contactForce: number;
  spin: Vector3Like;
  contactType: BallContactType;
  foot: Foot;
  playerVelocity: Vector3Like;
  ballVelocity: Vector3Like;
  contactQuality: ContactQuality;
  playerId: string;
  teamId: string;
  time: number;
}

export interface ContactEvaluation {
  level: ContactLevel;
  distance: number;
  angle: number;
  timingError: number;
  quality: ContactQuality;
  foot: Foot;
  controlResult: ControlResult;
}

export interface BallPrediction {
  position: Vector3Like;
  time: number;
}