import { Ball } from "./Ball";

export class BallCollision {
  resolveGround(ball: Ball): void {
    if (ball.state.position.y < ball.physics.data.radius) {
      ball.state.position.y = ball.physics.data.radius;
      if (ball.state.velocity.y < 0) ball.state.velocity.y = -ball.state.velocity.y * ball.physics.data.restitution;
    }
  }

  resolvePost(ball: Ball, normal: { x: number; y: number; z: number }): void {
    const dot = ball.state.velocity.x * normal.x + ball.state.velocity.y * normal.y + ball.state.velocity.z * normal.z;
    if (dot >= 0) return;
    const bounce = 1 + ball.physics.data.restitution;
    ball.state.velocity.x -= bounce * dot * normal.x;
    ball.state.velocity.y -= bounce * dot * normal.y;
    ball.state.velocity.z -= bounce * dot * normal.z;
    ball.state.state = "Bouncing";
  }
}