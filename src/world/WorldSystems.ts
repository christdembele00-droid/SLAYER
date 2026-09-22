export type Weather="Clear"|"Cloudy"|"Rain";export type QualityTier="Ultra"|"High"|"Medium"|"Low";
export interface StadiumData{id:string;name:string;capacity:number;environment:string;lighting:string}
export class WorldSystem{
  readonly stadium:StadiumData={id:"stadium-default",name:"SLAYER Arena",capacity:50000,environment:"Outdoor",lighting:"Day"};
  weather:Weather="Clear";
  wetness=0;
  wear=0;
  update(dt:number){
    this.wetness=Math.max(0,Math.min(1,this.wetness+(this.weather==="Rain"?.015:-.003)*dt));
  }
}
export class QualityManager{
  tier:QualityTier="High";

  update(frameMs:number):boolean{
    const previous=this.tier;
    if(frameMs>33)this.tier="Low";
    else if(frameMs>22)this.tier="Medium";
    else if(frameMs<15)this.tier="Ultra";
    else this.tier="High";
    return this.tier!==previous;
  }

  pixelRatio(){
    return this.tier==="Low"?.75:this.tier==="Medium"?.85:this.tier==="High"?1:1.25;
  }
}