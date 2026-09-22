import * as THREE from "three";
import { Ball } from "../ball/Ball";
import { Player } from "../player/Player";

export type SkillMove="None"|"BodyFeint"|"StepOver"|"BallRoll"|"DragBack"|"Burst";

export class AdvancedBallControl{
  update(player:Player,ball:Ball,dt:number,skill:SkillMove="None"):void{
    if(player.state.ballMode!=="Control" || ball.state.controlledByPlayerId!==player.data.playerId) return;
    const forward={x:Math.sin(player.state.rotationY),z:Math.cos(player.state.rotationY)};
    const side={x:Math.cos(player.state.rotationY),z:-Math.sin(player.state.rotationY)};
    const speed=Math.hypot(player.state.velocity.x,player.state.velocity.z);
    let distance=.68;
    let lateral=0;
    let lift=0;
    if(skill==="BallRoll"){lateral=.32;distance=.58;}
    if(skill==="DragBack"){distance=.38;}
    if(skill==="Burst"){distance=.82;}
    if(skill==="StepOver"||skill==="BodyFeint"){lateral=Math.sin(performance.now()/120)*.18;}
    const controlStrength=THREE.MathUtils.clamp(player.data.technical.ballControl/100,.35,1);
    const responsiveness=THREE.MathUtils.lerp(.16,.42,controlStrength);
    const target={
      x:player.state.position.x+forward.x*distance+side.x*lateral,
      y:Math.max(.11,player.state.position.y+.14+lift),
      z:player.state.position.z+forward.z*distance+side.z*lateral
    };
    ball.state.position.x=THREE.MathUtils.lerp(ball.state.position.x,target.x,Math.min(1,responsiveness*dt*60));
    ball.state.position.y=THREE.MathUtils.lerp(ball.state.position.y,target.y,Math.min(1,.3*dt*60));
    ball.state.position.z=THREE.MathUtils.lerp(ball.state.position.z,target.z,Math.min(1,responsiveness*dt*60));
    ball.state.velocity.x=player.state.velocity.x;
    ball.state.velocity.y=0;
    ball.state.velocity.z=player.state.velocity.z;
    player.state.ballProtection=skill==="DragBack"?85:skill==="BodyFeint"?70:45;
    if(speed<.15) player.state.ballProtection=Math.min(100,player.state.ballProtection+15);
  }
}
