import { PlayerSystem } from "../player/PlayerSystem";
import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";
import { PlayerIntent } from "../player/PlayerTypes";

export interface WorldModel{
  ball:{x:number;y:number;z:number;speed:number};
  players:Array<{id:string;team:string;x:number;z:number;stamina:number}>;
  time:number
}
export type AIDecision = "None"|"Control"|"Move"|"Pass"|"Shoot";
export interface Tactic{formation:string;width:number;depth:number;tempo:number;pressing:number;buildUp:number;attackingRisk:number}
export const defaultTactic:Tactic={formation:"4-3-3",width:55,depth:50,tempo:50,pressing:50,buildUp:50,attackingRisk:50};

export class FootballAI{
  world(ps:PlayerSystem,b:Ball,time:number):WorldModel{
    return{time,ball:{...b.state.position,speed:Math.hypot(b.state.velocity.x,b.state.velocity.y,b.state.velocity.z)},players:ps.all().map(p=>({id:p.data.playerId,team:p.data.teamId,x:p.state.position.x,z:p.state.position.z,stamina:p.state.stamina}))};
  }
  choose(p:Player,w:WorldModel):AIDecision{
    const d=Math.hypot(w.ball.x-p.state.position.x,w.ball.z-p.state.position.z);
    if(p.state.ballMode==="Control")return p.data.mental.composure>70?"Shoot":"Pass";
    return d<2?"Control":"Move";
  }
  update(ps:PlayerSystem,b:Ball,time:number){
    const w=this.world(ps,b,time);
    for(const p of ps.all()){
      const action=this.choose(p,w);
      const playerAction: PlayerIntent["action"] = action==="Shoot"?"Shoot":action==="Pass"?"Pass":action==="Control"?"Control":"None";
      const dx=w.ball.x-p.state.position.x,dz=w.ball.z-p.state.position.z;
      p.state.lastIntent={
        moveDirection:{x:dx,y:0,z:dz},
        moveMagnitude:Math.min(1,Math.hypot(dx,dz)/10),
        sprintPressed:action==="Move" && Math.hypot(dx,dz)>8,
        action:playerAction,
        targetDirection:{x:dx,y:action==="Shoot"?.15:0,z:dz},
        power:action==="Shoot"?.85:.55,
        timestamp:time
      };
    }
  }
}