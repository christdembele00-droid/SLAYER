import * as THREE from "three";
import { MatchEvent, MatchEventName } from "../core/MatchEvents";
export type CameraMode="match"|"hero"|"setpiece";
export class CameraDirector{
  private mode:CameraMode="hero";
  private heroTarget=new THREE.Vector3(7,3,0);
  setMode(mode:CameraMode){this.mode=mode;}
  setHeroTarget(target:{x:number;y:number;z:number}){this.heroTarget.set(target.x,target.y,target.z);}
  private target=new THREE.Vector3();
  update(camera:THREE.PerspectiveCamera,ball:{x:number;y:number;z:number}){
    if(this.mode==="hero"){camera.position.lerp(new THREE.Vector3(7,3.2,11),.08);camera.lookAt(this.heroTarget);return;}
    if(this.mode==="setpiece"){this.target.set(ball.x,1.2,ball.z);camera.position.lerp(new THREE.Vector3(ball.x,10,ball.z+18),.1);camera.lookAt(this.target);return;}
    this.target.set(ball.x,0,ball.z);
    camera.position.lerp(new THREE.Vector3(ball.x,18,ball.z+28),.08);
    camera.lookAt(this.target);
  }
  onEvent(_event:MatchEvent<MatchEventName>){/* event-driven presentation hook */}
}