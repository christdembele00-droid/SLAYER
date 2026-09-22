import * as THREE from "three";
export interface IKTarget{position:THREE.Vector3;weight:number}
export class FootballIK{
  solveFoot(hip:THREE.Vector3,knee:THREE.Vector3,ankle:THREE.Vector3,target:IKTarget){
    const d=hip.distanceTo(target.position); const reach=Math.max(.05,hip.distanceTo(ankle));
    const t=Math.min(1,target.weight*Math.min(1,d/reach));
    ankle.lerp(target.position,t); knee.lerpVectors(knee,hip.clone().lerp(target.position,.5),t*.35);
  }
  solveLook(head:THREE.Object3D,target:THREE.Vector3,weight=1){const q=head.quaternion.clone();head.lookAt(target);head.quaternion.slerp(q,1-weight);}
}