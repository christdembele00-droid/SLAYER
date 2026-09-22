import * as THREE from "three";
import { Player } from "./Player";
export class PlayerMesh{
  readonly object=new THREE.Group();
  constructor(player:Player){
    this.object.userData.playerId=player.data.playerId;
    const material=new THREE.MeshStandardMaterial({color:player.data.teamId==="home"?0x2563eb:0xdc2626});
    const skin=new THREE.MeshStandardMaterial({color:0xc68662});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.72,6,10),material);body.position.y=.78;this.object.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),skin);head.position.y=1.35;this.object.add(head);
    const leftLeg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.42,4,6),material),rightLeg=leftLeg.clone();
    leftLeg.position.set(-.11,.35,0);rightLeg.position.set(.11,.35,0);this.object.add(leftLeg,rightLeg);
  }
  sync(player:Player){const p=player.state.position;this.object.position.set(p.x,p.y,p.z);this.object.rotation.y=player.state.rotationY;}
}