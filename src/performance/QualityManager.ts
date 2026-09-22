import { QualityTier } from "../world/WorldTypes";

export class QualityManager {
  tier: QualityTier = "High";
  private history:number[]=[];
  private stableTime=0;
  private lastTier:QualityTier="High";

  update(frameMs:number,delta=1/60):boolean {
    this.history.push(frameMs);
    if(this.history.length>90)this.history.shift();
    const avg=this.history.reduce((a,b)=>a+b,0)/this.history.length;

    if(avg>22.2){
      this.tier="Low";
      this.stableTime=0;
    }else if(avg>17.2){
      this.tier="Medium";
      this.stableTime=0;
    }else if(avg<15.8){
      this.stableTime+=delta;
      if(this.stableTime>2)this.tier="Ultra";
    }else{
      this.stableTime=0;
      this.tier="High";
    }

    const changed=this.tier!==this.lastTier;
    this.lastTier=this.tier;
    return changed;
  }

  pixelRatio():number{
    switch(this.tier){
      case "Low": return .68;
      case "Medium": return .8;
      case "High": return .95;
      case "Ultra": return Math.min(window.devicePixelRatio,1.5);
    }
  }

  targetFrameMs():number{return 1000/60;}
}
