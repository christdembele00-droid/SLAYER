import { PitchState,Weather,StadiumData } from "./WorldTypes";
export class WorldSystem{readonly stadium:StadiumData={id:"stadium-default",name:"SLAYER Arena",capacity:50000,environment:"Outdoor",lighting:"Day"};readonly pitch:PitchState={wetness:0,surface:"GrassDry",wear:0};weather:Weather="Clear";
  grass:"short-dry"|"long-dry"|"short-wet"="short-dry";
  setWeather(value:string):void{this.weather=value==="rain"?"Rain":"Clear";if(value==="snow")this.weather="Clear";if(this.weather==="Rain")this.pitch.wetness=Math.max(this.pitch.wetness,.45);}
  setGrass(value:string):void{if(value==="long-dry"||value==="short-wet"||value==="short-dry")this.grass=value as WorldSystem["grass"];if(value==="short-wet")this.pitch.wetness=Math.max(this.pitch.wetness,.55);}
  setTime(value:string):void{this.stadium.lighting=value==="night"?"Night":value==="sunset"?"Twilight":"Day";}
  get wetness():number{return this.pitch.wetness;}update(delta:number){this.pitch.wetness=Math.max(0,Math.min(1,this.pitch.wetness+(this.weather==="Rain"?0.01:-0.003)*delta));this.pitch.surface=this.pitch.wetness>.55?"GrassWet":"GrassDry";}}