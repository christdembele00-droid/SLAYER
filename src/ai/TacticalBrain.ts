import { PlayerSystem } from "../player/PlayerSystem";
import { Ball } from "../ball/Ball";
import { PlayerIntent, PlayerPosition } from "../player/PlayerTypes";
import { defaultTactic } from "./FootballAI";

const anchors: Record<PlayerPosition,{x:number;z:number}>={
  GK:{x:0,z:-48},CB:{x:0,z:-36},LB:{x:-18,z:-32},RB:{x:18,z:-32},LWB:{x:-22,z:-28},RWB:{x:22,z:-28},
  DM:{x:0,z:-20},CM:{x:0,z:-12},AM:{x:0,z:-5},LW:{x:-22,z:4},RW:{x:22,z:4},ST:{x:0,z:14}
};

export class TacticalBrain {
  readonly tactic=defaultTactic;

  update(ps:PlayerSystem,b:Ball):void{
    const bx=b.state.position.x,bz=b.state.position.z;
    for(const p of ps.all()){
      const base=anchors[p.data.position]??{x:0,z:0};
      const side=p.data.teamId==="home"?1:-1;
      const ballBias=Math.max(-1,Math.min(1,bz/52));
      const width=this.tactic.width/100;
      const targetX=base.x*width + bx*0.22;
      const targetZ=base.z*side + bz*0.18;
      const dx=targetX-p.state.position.x,dz=targetZ-p.state.position.z;
      const distance=Math.hypot(dx,dz);
      const current:PlayerIntent=p.state.lastIntent??{
        moveDirection:{x:0,y:0,z:0},moveMagnitude:0,sprintPressed:false,action:"None",
        targetDirection:{x:0,y:0,z:1},power:0,timestamp:0
      };
      if(distance<0.8) continue;
      const pressing=p.data.teamId!=="home" && ballBias>0.25 || p.data.teamId==="home" && ballBias<-0.25;
      const urgency=pressing?1.35:1;
      p.state.lastIntent={
        ...current,
        moveDirection:{x:dx*urgency,y:0,z:dz*urgency},
        moveMagnitude:Math.min(1,distance/8),
        sprintPressed:current.sprintPressed || (pressing && distance>6),
      };
    }
  }
}