import { QualityTier } from "../world/WorldTypes";

export class QualityManager {
  tier: QualityTier = "High";
  private history:number[]=[];
  private stableTime=0;
  private lastTier:QualityTier="High";
  private cooldown=0;

  update(frameMs:number,delta=1/60):boolean {
    this.history.push(Math.max(.01,frameMs));
    if(this.history.length>120)this.history.shift();
    if(this.cooldown>0)this.cooldown-=delta;
    const sorted=[...this.history].sort((a,b)=>a-b);
    const avg=this.history.reduce((a,b)=>a+b,0)/this.history.length;
    const p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];

    let next=this.tier;
    if(p95>24 || avg>22.2) next="Low";
    else if(p95>19 || avg>17.2) next="Medium";
    else if(p95<15.5 && avg<15.8){this.stableTime+=delta;if(this.stableTime>3)next="Ultra";}
    else if(p95<17 && avg<17.0) next="High";
    else this.stableTime=0;

    if(next!==this.tier && this.cooldown<=0){
      this.tier=next;
      this.cooldown=2;
      this.stableTime=0;
    }
    const changed=this.tier!==this.lastTier;
    this.lastTier=this.tier;
    return changed;
  }

  pixelRatio():number{
    const native=Math.min(window.devicePixelRatio||1,1.5);
    switch(this.tier){
      case "Low": return Math.min(native,.68);
      case "Medium": return Math.min(native,.82);
      case "High": return Math.min(native,1.0);
      case "Ultra": return native;
    }
  }

  setTier(tier:QualityTier):void{this.tier=tier;this.stableTime=0;this.cooldown=0;this.lastTier=tier;}
  targetFrameMs():number{return 1000/60;}
  get p95Ms():number{
    if(!this.history.length)return 0;
    const sorted=[...this.history].sort((a,b)=>a-b);
    return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  }
}