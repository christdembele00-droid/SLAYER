import { PlayerSystem } from "../player/PlayerSystem";
import { Ball } from "../ball/Ball";
import { InteractionSystem } from "../interaction/InteractionSystem";
import { GameplayAction, GameplayResult } from "./GameplayTypes";

export class GameplaySystem {
  constructor(private readonly interactions: InteractionSystem) {}

  execute(players: PlayerSystem, ball: Ball, playerId: string, action: GameplayAction, direction: {x:number;y:number;z:number}, power:number): GameplayResult {
    const p=players.get(playerId);
    if(!p) return {success:false,action,quality:0,reason:"player_not_found"};
    const fatigue=Math.max(0,1-p.state.stamina/100);
    const target=Math.hypot(direction.x,direction.z)||1;
    const normalized={x:direction.x/target,y:direction.y,z:direction.z/target};

    if(["Pass","ThroughBall","Cross","Shoot","FinesseShot","ChipShot","Clearance"].includes(action)){
      const type=action==="Shoot"||action==="FinesseShot"||action==="ChipShot"?"Shot":action==="ThroughBall"?"ThroughBall":action==="Cross"?"Cross":action==="Clearance"?"Clearance":"Pass";
      let adjusted=Math.min(1,Math.max(0,power));
      if(action==="FinesseShot") adjusted*=.78;
      if(action==="ChipShot") normalized.y=Math.max(normalized.y,.32);
      const ok=this.interactions.tryKick(players,playerId,ball,normalized,adjusted,type);
      return {success:ok,action,quality:ok?Math.max(.2,1-fatigue*.35):0,reason:ok?"contact":"contact_failed"};
    }

    if(action==="Dribble"||action==="Control"){
      const ok=this.interactions.tryControl(players,playerId,ball);
      return {success:ok,action,quality:ok?1:0,reason:ok?"controlled":"control_failed"};
    }

    if(action==="ProtectBall"){
      if(ball.state.controlledByPlayerId!==playerId)return {success:false,action,quality:0,reason:"not_in_possession"};
      p.state.action="ProtectBall";
      return {success:true,action,quality:Math.max(.3,1-fatigue),reason:"shielding"};
    }

    if(action==="Tackle"||action==="StandingTackle"||action==="SlideTackle"||action==="Intercept"){
      const ownerId=ball.state.controlledByPlayerId;
      if(!ownerId||ownerId===playerId)return {success:false,action,quality:0,reason:"no_opponent_possession"};
      const owner=players.get(ownerId);
      if(!owner)return {success:false,action,quality:0,reason:"owner_missing"};
      const d=Math.hypot(owner.state.position.x-p.state.position.x,owner.state.position.z-p.state.position.z);
      const range=action==="SlideTackle"?1.8:1.35;
      if(d>range)return {success:false,action,quality:0,reason:"out_of_range"};
      const tackling=Math.max(0,Math.min(100,p.data.technical.tackling));
      const chance=(tackling/100)*(.55+Math.min(1,p.data.physical.agility/100)*.25);
      if(Math.random()>chance)return {success:false,action,quality:chance,reason:"tackle_missed"};
      owner.state.ballMode="NoBall";
      owner.state.ballProtection=0;
      p.state.ballProtection=Math.min(100,p.data.technical.ballControl*0.5+p.data.physical.strength*0.5);
      owner.state.action=action;
      ball.state.controlledByPlayerId=undefined;
      ball.state.state="Free";
      ball.state.velocity={x:normalized.x*(action==="SlideTackle"?7:4),y:action==="SlideTackle"?.45:.18,z:normalized.z*(action==="SlideTackle"?7:4)};
      p.state.action=action==="Tackle"?"StandingTackle":action;
      return {success:true,action,quality:chance,reason:"ball_won"};
    }

    if(action==="Press"||action==="Contain"){
      p.state.action=action;
      return {success:true,action,quality:Math.max(.25,1-fatigue),reason:"defensive_intent"};
    }
    return {success:true,action,quality:Math.max(0,1-fatigue),reason:"intent_registered"};
  }
}