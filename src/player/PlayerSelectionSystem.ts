import { Ball } from "../ball/Ball";
import { PlayerSystem } from "./PlayerSystem";

export class PlayerSelectionSystem{
  private currentId:string;
  constructor(initialId:string){this.currentId=initialId;}

  get id():string{return this.currentId;}

  update(players:PlayerSystem,ball:Ball):string{
    const ownerId=ball.state.controlledByPlayerId;
    const owner=ownerId?players.get(ownerId):undefined;
    if(owner?.data.teamId==="home"){
      this.currentId=owner.data.playerId;
      return this.currentId;
    }

    const current=players.get(this.currentId);
    const home=players.all().filter(p=>p.data.teamId==="home");
    if(!home.length)return this.currentId;

    const bx=ball.state.position.x,bz=ball.state.position.z;
    const dist=(p:any)=>Math.hypot(p.state.position.x-bx,p.state.position.z-bz);
    const nearest=home.reduce((best,p)=>dist(p)<dist(best)?p:best,home[0]);

    if(!current || current.data.teamId!=="home"){
      this.currentId=nearest.data.playerId;
      return this.currentId;
    }

    const currentDistance=dist(current);
    const nearestDistance=dist(nearest);

    // Stay with the current footballer unless another teammate is clearly
    // closer to the active play. This prevents visual/controller thrashing.
    if(nearest.data.playerId!==current.data.playerId && nearestDistance+4<currentDistance){
      this.currentId=nearest.data.playerId;
    }

    return this.currentId;
  }
}
