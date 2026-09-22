import { PlayerSystem } from "../player/PlayerSystem"; import { Ball } from "../ball/Ball"; import { InteractionSystem } from "../interaction/InteractionSystem"; import { GameplayAction,GameplayResult } from "./GameplayTypes";
export class GameplaySystem{
 constructor(private readonly interactions:InteractionSystem){}
 execute(players:PlayerSystem,ball:Ball,playerId:string,action:GameplayAction,direction:{x:number;y:number;z:number},power:number):GameplayResult{
  const p=players.get(playerId); if(!p)return{success:false,action,quality:0,reason:"player_not_found"};
  const fatigue=Math.max(0,1-p.state.stamina/100), pressure=0;
  if(action==="Pass"||action==="ThroughBall"||action==="Cross"||action==="Shoot"||action==="Clearance"){
   const type=action==="Shoot"?"Shot":action==="ThroughBall"?"ThroughBall":action==="Cross"?"Cross":action==="Clearance"?"Clearance":"Pass";
   const ok=this.interactions.tryKick(players,playerId,ball,direction,power,type);
   return{success:ok,action,quality:ok?1-fatigue*0.35:0,reason:ok?"contact":"contact_failed"};
  }
  if(action==="Control"){const ok=this.interactions.tryControl(players,playerId,ball);return{success:ok,action,quality:ok?1:0,reason:ok?"controlled":"control_failed"};}
  return{success:true,action,quality:Math.max(0,1-fatigue),reason:"intent_registered"};
 }
}