import * as THREE from "three";
import { Player } from "./Player";
import { FootballIK } from "../animation/FootballIK";

export class PlayerMesh{
  readonly object=new THREE.Group();
  private readonly leftLeg:THREE.Mesh;
  private readonly rightLeg:THREE.Mesh;

  constructor(player:Player){
    this.object.userData.playerId=player.data.playerId;
    const material=new THREE.MeshStandardMaterial({color:player.data.teamId==="home"?0x2563eb:0xdc2626});
    const skin=new THREE.MeshStandardMaterial({color:0xc68662});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.72,6,10),material);
    body.position.y=.78;
    this.object.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),skin);
    head.position.y=1.35;
    this.object.add(head);
    this.leftLeg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.42,4,6),material);
    this.rightLeg=this.leftLeg.clone();
    this.leftLeg.position.set(-.11,.35,0);
    this.rightLeg.position.set(.11,.35,0);
    this.object.add(this.leftLeg,this.rightLeg);
  }

  sync(player:Player){
    const p=player.state.position;
    this.object.position.set(p.x,p.y,p.z);
    this.object.rotation.y=player.state.rotationY;
  }

  applyIK(ik:FootballIK,ballPosition:{x:number;y:number;z:number}){
    const localBall=new THREE.Vector3(ballPosition.x-this.object.position.x,ballPosition.y-this.object.position.y,ballPosition.z-this.object.position.z);
    const target=new THREE.Vector3(localBall.x,Math.max(.08,localBall.y),localBall.z);
    const hipL=new THREE.Vector3(-.11,.58,0);
    const kneeL=new THREE.Vector3(-.11,.32,0);
    const ankleL=this.leftLeg.position.clone();
    const hipR=new THREE.Vector3(.11,.58,0);
    const kneeR=new THREE.Vector3(.11,.32,0);
    const ankleR=this.rightLeg.position.clone();
    const targetWeight=Math.min(1,1/(Math.max(.4,localBall.length())));
    ik.solveFoot(hipL,kneeL,ankleL,{position:target,weight:targetWeight});
    ik.solveFoot(hipR,kneeR,ankleR,{position:target,weight:targetWeight*.65});
    this.leftLeg.position.lerp(ankleL,.35);
    this.rightLeg.position.lerp(ankleR,.2);
  }
}