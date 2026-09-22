import * as THREE from "three";
import { MatchEvent, MatchEventName } from "../core/MatchEvents";
export class CameraDirector{
  private target=new THREE.Vector3();
  update(camera:THREE.PerspectiveCamera,ball:{x:number;y:number;z:number}){
    this.target.set(ball.x,0,ball.z);
    camera.position.lerp(new THREE.Vector3(ball.x,18,ball.z+28),.08);
    camera.lookAt(this.target);
  }
  onEvent(_event:MatchEvent<MatchEventName>){/* event-driven presentation hook */}
}