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
    if(p.state.ballMode==="Control"){
      const goalZ=p.data.teamId==="home"?52.5:-52.5;
      const goalDistance=Math.hypot(w.ball.x,goalZ-w.ball.z);
      const forward=p.data.teamId==="home"?w.ball.z>0:w.ball.z<0;
      if(goalDistance<24 && p.data.mental.composure+p.data.technical.shooting>145) return "Shoot";
      if(d<1.4 && forward && p.data.technical.dribbling>70) return "Move";
      return "Pass";
    }
    const danger=p.data.teamId==="home"?w.ball.z<-30:w.ball.z>30;
    if(d<1.6) return "Control";
    if(danger && p.data.technical.tackling>65) return "Move";
    return "Move";
  }
  update(ps:PlayerSystem,b:Ball,time:number){
    const w=this.world(ps,b,time);
    for(const p of ps.all()){
      const action=this.choose(p,w);
      const dx=w.ball.x-p.state.position.x,dz=w.ball.z-p.state.position.z;
      const distance=Math.hypot(dx,dz)||1;
      const playerAction: PlayerIntent["action"] = action==="Shoot"?"Shoot":action==="Pass"?"Pass":action==="Control"?"Control":"None";
      p.state.lastIntent={
        moveDirection:{x:dx,y:0,z:dz},
        moveMagnitude:Math.min(1,distance/10),
        sprintPressed:action==="Move" && distance>8,
        action:playerAction,
        targetDirection:{x:dx/distance,y:action==="Shoot"?.12:0,z:dz/distance},
        power:action==="Shoot"?.9:.55,
        timestamp:time
      };
    }
  }
}
