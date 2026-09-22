import { Player } from "../player/Player";
import { AnimationFrame, AnimationInput, AnimationState } from "./AnimationTypes";

export class AnimationSystem {
  private readonly previous = new Map<string,{speed:number;rotation:number;phase:number}>();

  getInput(p:Player, ballPosition={x:0,y:0,z:0}, delta=1/60):AnimationInput{
    const speed=Math.hypot(p.state.velocity.x,p.state.velocity.z);
    const previous=this.previous.get(p.data.playerId);
    const acceleration=previous ? (speed-previous.speed)/Math.max(delta,1e-4) : 0;
    const rawTurn=previous ? p.state.rotationY-previous.rotation : 0;
    const turn=Math.atan2(Math.sin(rawTurn),Math.cos(rawTurn));
    return{
      speed,
      direction:Math.atan2(p.state.velocity.x,p.state.velocity.z),
      acceleration,
      rotation:p.state.rotationY,
      turnRate:turn/Math.max(delta,1e-4),
      ballMode:p.state.ballMode,
      action:p.state.action,
      stamina:p.state.stamina,
      distanceToBall:Math.hypot(ballPosition.x-p.state.position.x,ballPosition.z-p.state.position.z)
    };
  }

  state(input:AnimationInput):AnimationState{
    const action=input.action;
    if(action==="Shoot") return "Shoot";
    if(action==="Pass"||action==="ThroughBall"||action==="Cross"||action==="Clearance") return "Pass";
    if(action==="Header") return "Header";
    if(action==="Tackle"||action==="StandingTackle"||action==="SlideTackle"||action==="Intercept"||action==="Press"||action==="Contain") return "Tackle";
    if(input.ballMode==="Control" && input.distanceToBall<1.7) return "Control";
    if(Math.abs(input.turnRate)>3.2 && input.speed>1.2) return "Turn";
    if(input.acceleration<-4 && input.speed>1.5) return "Brake";
    if(input.speed<0.1) return "Idle";
    if(input.speed<2) return "Walk";
    if(input.speed<5.5) return "Run";
    return "Sprint";
  }

  update(p:Player, delta:number, ballPosition={x:0,y:0,z:0}):AnimationFrame{
    const safeDelta=Math.max(1/240,Math.min(delta,.05));
    const input=this.getInput(p,ballPosition,safeDelta);
    const state=this.state(input);
    const previous=this.previous.get(p.data.playerId)??{speed:0,rotation:p.state.rotationY,phase:0};
    const locomotion=Math.max(input.speed,0);
    const frequency=state==="Sprint"?11:state==="Run"?8.5:state==="Walk"?5.5:3;
    const phase=previous.phase+safeDelta*frequency;
    const moving=input.speed>0.15;
    const stride=moving?Math.sin(phase)*Math.min(.72,.12+input.speed*.065):0;
    const actionWeight=["Pass","Shoot","Tackle","Header"].includes(state)?1:state==="Control"?.35:0;
    const lean=Math.max(-.28,Math.min(.28,input.acceleration*.018));
    const turnLean=Math.max(-.35,Math.min(.35,input.turnRate*.055));
    this.previous.set(p.data.playerId,{speed:input.speed,rotation:p.state.rotationY,phase});
    return{
      state,
      speed:locomotion,
      acceleration:input.acceleration,
      turnRate:input.turnRate,
      stridePhase:phase,
      legSwing:stride,
      bodyLean:lean,
      turnLean,
      actionWeight,
      ballDistance:input.distanceToBall
    };
  }
}
