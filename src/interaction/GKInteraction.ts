import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";

export type GKResult = "Catch" | "Parry" | "Deflect" | "Miss";

export class GKInteraction {
  resolve(goalkeeper: Player, ball: Ball): GKResult {
    if (goalkeeper.data.position !== "GK" || !goalkeeper.data.goalkeeper) return "Miss";
    const dx = ball.state.position.x - goalkeeper.state.position.x;
    const dy = ball.state.position.y - (goalkeeper.state.position.y + 0.9);
    const dz = ball.state.position.z - goalkeeper.state.position.z;
    const distance = Math.hypot(dx, dy, dz);
    const gk = goalkeeper.data.goalkeeper;
    const reach = 1 + gk.reach / 100;
    if (distance > reach) return "Miss";
    const handling = gk.handling / 100;
    const reflex = gk.reflexes / 100;
    const speed = Math.hypot(ball.state.velocity.x, ball.state.velocity.y, ball.state.velocity.z);
    if (speed < 8 && handling > 0.55) {
      ball.state.velocity.x = ball.state.velocity.y = ball.state.velocity.z = 0;
      ball.state.state = "Controlled";
      goalkeeper.state.ballMode = "Control";
      return "Catch";
    }
    if (reflex + gk.diving / 100 > 1.15) {
      ball.state.velocity.x *= -0.35;
      ball.state.velocity.z *= -0.35;
      ball.state.state = "InFlight";
      return "Parry";
    }
    return "Deflect";
  }
}