import { Ball } from "./Ball";
import { PlayerSystem } from "../player/PlayerSystem";

export class BallSystem {
  readonly ball = new Ball();

  update(delta: number, players?: PlayerSystem): void {
    const ownerId=this.ball.state.controlledByPlayerId;
    if(ownerId && players){
      const owner=players.get(ownerId);
      if(owner){
        const forward={x:Math.sin(owner.state.rotationY),z:Math.cos(owner.state.rotationY)};
        this.ball.state.position={
          x:owner.state.position.x+forward.x*.72,
          y:Math.max(.11,owner.state.position.y+.16),
          z:owner.state.position.z+forward.z*.72
        };
        this.ball.state.velocity={x:owner.state.velocity.x,y:owner.state.velocity.y,z:owner.state.velocity.z};
        return;
      }
      this.ball.state.controlledByPlayerId=undefined;
      this.ball.state.state="Free";
    }
    this.ball.update(delta);
  }
}