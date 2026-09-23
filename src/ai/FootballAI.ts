import { PlayerSystem } from "../player/PlayerSystem";
import { Player } from "../player/Player";
import { Ball } from "../ball/Ball";
import { PlayerIntent, PlayerPosition } from "../player/PlayerTypes";

export interface WorldModel{
  ball:{x:number;y:number;z:number;speed:number};
  players:Array<{id:string;team:string;position:PlayerPosition;x:number;z:number;stamina:number}>;
  time:number
}
export type AIDecision = "None"|"Control"|"Move"|"Pass"|"Shoot";
export interface Tactic{formation:string;width:number;depth:number;tempo:number;pressing:number;buildUp:number;attackingRisk:number}
export const defaultTactic:Tactic={formation:"4-3-3",width:55,depth:50,tempo:50,pressing:50,buildUp:50,attackingRisk:50};

const anchors:Record<PlayerPosition,{x:number;z:number}>={
  GK:{x:0,z:-48},CB:{x:0,z:-36},LB:{x:-18,z:-32},RB:{x:18,z:-32},LWB:{x:-22,z:-28},RWB:{x:22,z:-28},
  DM:{x:0,z:-20},CM:{x:0,z:-12},AM:{x:0,z:-5},LW:{x:-22,z:4},RW:{x:22,z:4},ST:{x:0,z:14}
};

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

export class FootballAI{
  private readonly lastPassTime=new Map<string,number>();
  world(ps:PlayerSystem,b:Ball,time:number):WorldModel{
    return{
      time,
      ball:{...b.state.position,speed:Math.hypot(b.state.velocity.x,b.state.velocity.y,b.state.velocity.z)},
      players:ps.all().map(p=>({
        id:p.data.playerId,team:p.data.teamId,position:p.data.position,
        x:p.state.position.x,z:p.state.position.z,stamina:p.state.stamina
      }))
    };
  }

  private intent(moveX:number,moveZ:number,action:PlayerIntent["action"]="None",power=0,sprint=false):PlayerIntent{
    const len=Math.hypot(moveX,moveZ)||1;
    return{
      moveDirection:{x:moveX,y:0,z:moveZ},
      moveMagnitude:Math.min(1,Math.hypot(moveX,moveZ)/8),
      sprintPressed:sprint,
      action,
      targetDirection:{x:moveX/len,y:action==="Shoot"?.08:0,z:moveZ/len},
      power,
      timestamp:performance.now()
    };
  }

  private setFormationIntent(p:Player,w:WorldModel,attacking:boolean):PlayerIntent{
    const base=anchors[p.data.position]??{x:0,z:0};
    const side=p.data.teamId==="home"?1:-1;
    const bx=w.ball.x,bz=w.ball.z;
    const width=defaultTactic.width/100;

    let targetX=base.x*width+bx*.18;
    let targetZ=base.z*side+bz*.10;

    // Teammates stretch into useful lanes rather than chasing the ball.
    if(attacking){
      const forwardBias=p.data.teamId==="home"?1:-1;
      if(["LW","RW","ST","AM"].includes(p.data.position)){
        targetZ+=forwardBias*clamp((forwardBias*bz+20)*.22,-4,9);
      }
      if(["LB","RB","LWB","RWB"].includes(p.data.position)){
        targetX+=base.x>0?3:-3;
      }
    }else{
      targetZ+=side*clamp(-side*bz*.16,-7,7);
      targetX*=.92;
    }

    const dx=targetX-p.state.position.x,dz=targetZ-p.state.position.z;
    const d=Math.hypot(dx,dz);
    return this.intent(dx,dz,"None",0,d>11 || p.state.stamina>65);
  }

  update(ps:PlayerSystem,b:Ball,time:number):void{
    const w=this.world(ps,b,time);
    const ownerId=b.state.controlledByPlayerId;
    const owner=ownerId?ps.get(ownerId):undefined;
    const ballTarget={x:w.ball.x,z:w.ball.z};
    const nearestBallPlayer=ps.all().reduce<Player|undefined>((best,p)=>{
      if(!best)return p;
      const d=distance({x:p.state.position.x,z:p.state.position.z},ballTarget);
      const bd=distance({x:best.state.position.x,z:best.state.position.z},ballTarget);
      return d<bd?p:best;
    },undefined);

    for(const p of ps.all()){
      const isOwner=p.data.playerId===ownerId;
      const pPos={x:p.state.position.x,z:p.state.position.z};
      const ballPos={x:w.ball.x,z:w.ball.z};
      const dBall=distance(pPos,ballPos);

      if(isOwner){
        const forward=p.data.teamId==="home"?1:-1;
        const goalZ=forward*52.5;
        const goalDistance=Math.abs(goalZ-w.ball.z);
        const shootChance=p.data.technical.shooting>=72 && goalDistance<25 && Math.abs(w.ball.x)<22;

        if(shootChance){
          const gx=-w.ball.x*.10;
          const gz=goalZ-w.ball.z;
          p.state.lastIntent=this.intent(gx,gz,"Shoot",.78,true);
        }else{
          const teammates=ps.all()
            .filter(x=>x.data.teamId===p.data.teamId && x.data.playerId!==p.data.playerId)
            .map(x=>({
              p:x,
              distance:Math.hypot(x.state.position.x-p.state.position.x,x.state.position.z-p.state.position.z),
              forward:forward*(x.state.position.z-p.state.position.z)
            }))
            .filter(x=>x.distance<28 && x.forward>1)
            .sort((a,b)=>b.forward-a.forward);
          const pressure=ps.all().some(x=>x.data.teamId!==p.data.teamId &&
            Math.hypot(x.state.position.x-p.state.position.x,x.state.position.z-p.state.position.z)<4.2);
          const lastPass=this.lastPassTime.get(p.data.playerId)??-99;
          const target=teammates[0]?.p;
          if(target && time-lastPass>1.25 && (pressure || goalDistance>28)){
            this.lastPassTime.set(p.data.playerId,time);
            p.state.lastIntent=this.intent(
              target.state.position.x-p.state.position.x,
              target.state.position.z-p.state.position.z,
              "Pass",.65,false
            );
          }else{
            const nextLaneX=p.data.position==="LW"?-18:p.data.position==="RW"?18:0;
            const dx=nextLaneX-w.ball.x*.28;
            const dz=forward*24;
            p.state.lastIntent=this.intent(dx,dz,"None",0,dBall<8 && p.state.stamina>55);
          }
        }
        continue;
      }

      const sameTeam=owner?.data.teamId===p.data.teamId;
      if(!owner){
        if(p.data.playerId===nearestBallPlayer?.data.playerId && dBall<1.5){
          p.state.lastIntent=this.intent(w.ball.x-p.state.position.x,w.ball.z-p.state.position.z,"Control",.35,dBall>.7);
        }else{
          p.state.lastIntent=this.setFormationIntent(p,w,p.data.teamId==="home");
        }
        continue;
      }

      if(sameTeam){
        // Supporting players move continuously and preserve formation.
        const support=this.setFormationIntent(p,w,true);
        if(dBall<2.0 && p.data.position!=="GK" && p.data.position!=="CB"){
          support.moveMagnitude=Math.min(1,support.moveMagnitude+.15);
        }
        p.state.lastIntent=support;
      }else{
        // Defending AI: one player presses, the next covers the passing lane,
        // the rest maintain a compact block.
        const opponents=[...ps.all()]
          .filter(x=>x.data.teamId===owner.data.teamId)
          .sort((a,b)=>distance({x:a.state.position.x,z:a.state.position.z},pPos)-distance({x:b.state.position.x,z:b.state.position.z},pPos));
        const nearestDefender=ps.all()
          .filter(x=>x.data.teamId===p.data.teamId)
          .sort((a,b)=>distance({x:a.state.position.x,z:a.state.position.z},ballPos)-distance({x:b.state.position.x,z:b.state.position.z},ballPos))[0];
        if(nearestDefender?.data.playerId===p.data.playerId || dBall<3.2){
          const dx=owner.state.position.x-p.state.position.x,dz=owner.state.position.z-p.state.position.z;
          p.state.lastIntent=this.intent(dx,dz,dBall<1.7?"StandingTackle":"Press",dBall<1.7?.8:.35,dBall>5);
        }else{
          const support=this.setFormationIntent(p,w,false);
          const markX=owner.state.position.x*.38+p.state.position.x*.62;
          const markZ=owner.state.position.z*.38+p.state.position.z*.62;
          support.moveDirection={x:markX-p.state.position.x,y:0,z:markZ-p.state.position.z};
          support.moveMagnitude=Math.min(1,Math.hypot(markX-p.state.position.x,markZ-p.state.position.z)/8);
          p.state.lastIntent=support;
        }
      }

    }
  }
}
