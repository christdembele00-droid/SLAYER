import { Ball } from "./Ball";

export class BallSystem {
  readonly ball = new Ball();

  update(delta: number): void { this.ball.update(delta); }
}