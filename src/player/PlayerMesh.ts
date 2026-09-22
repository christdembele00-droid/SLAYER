import * as THREE from "three";
import { Player } from "./Player";
import { FootballIK } from "../animation/FootballIK";
import { AnimationFrame } from "../animation/AnimationTypes";

export class PlayerMesh{
  readonly object=new THREE.Group();
  private readonly body:THREE.Mesh;
  private readonly head:THREE.Mesh;
  private readonly leftLeg:THREE.Mesh;
  private readonly rightLeg:THREE.Mesh;

  constructor(player:Player){
    this.object.userData.playerId=player.data.playerId;
    const material=new THREE.MeshStandardMaterial({color:player.data.teamId==="home"?0x2563eb:0xdc2626});
    const skin=new THREE.MeshStandardMaterial({color:0xc68662});
    this.body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.72,6,10),material);
    this.body.position.y=.78;
    this.object.add(this.body);
    this.head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),skin);
    this.head.position.y=1.35;
    this.object.add(this.head);
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

  applyAnimation(frame:AnimationFrame,delta:number){
    const smoothing=Math.min(1,delta*14);
    const swing=frame.legSwing;
    const moving=frame.speed>.15;

    const targetLeft=moving?swing:0;
    const targetRight=moving?-swing:0;
    this.leftLeg.rotation.x=THREE.MathUtils.lerp(this.leftLeg.rotation.x,targetLeft,smoothing);
    this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,targetRight,smoothing);

    const action=frame.actionWeight;
    if(frame.state==="Shoot"){
      this.leftLeg.rotation.x=THREE.MathUtils.lerp(this.leftLeg.rotation.x,-.9,action*.35);
      this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,.55,action*.35);
    }else if(frame.state==="Pass"){
      this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,-.5,action*.3);
    }else if(frame.state==="Tackle"){
      this.body.rotation.x=THREE.MathUtils.lerp(this.body.rotation.x,.28,action*.25);
    }else{
      this.body.rotation.x=THREE.MathUtils.lerp(this.body.rotation.x,-frame.bodyLean*.45,smoothing);
    }

    this.body.rotation.z=THREE.MathUtils.lerp(this.body.rotation.z,-frame.turnLean*.35,smoothing);
    this.head.rotation.y=THREE.MathUtils.lerp(this.head.rotation.y,THREE.MathUtils.clamp(frame.turnLean*1.5,-.45,.45),smoothing);
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
