import * as THREE from "three";
import { Player } from "./Player";
import { FootballIK } from "../animation/FootballIK";
import { AnimationFrame } from "../animation/AnimationTypes";

export class PlayerMesh {
  readonly object=new THREE.Group();
  private readonly torso:THREE.Mesh;
  private readonly shorts:THREE.Mesh;
  private readonly head:THREE.Mesh;
  private readonly leftArm:THREE.Mesh;
  private readonly rightArm:THREE.Mesh;
  private readonly leftLeg:THREE.Mesh;
  private readonly rightLeg:THREE.Mesh;
  private readonly leftBoot:THREE.Mesh;
  private readonly rightBoot:THREE.Mesh;

  constructor(player:Player){
    this.object.userData.playerId=player.data.playerId;
    const primary=player.data.teamId==="home"?0x1d4ed8:0xdc2626;
    const secondary=player.data.teamId==="home"?0xf4f7ff:0x15191d;
    const kit=new THREE.MeshStandardMaterial({color:primary,roughness:.62,metalness:.02});
    const shortsMat=new THREE.MeshStandardMaterial({color:secondary,roughness:.7});
    const skin=new THREE.MeshStandardMaterial({color:0xa96f52,roughness:.78});
    const boot=new THREE.MeshStandardMaterial({color:0x101316,roughness:.38,metalness:.15});

    this.torso=new THREE.Mesh(new THREE.CapsuleGeometry(.235,.56,6,10),kit);
    this.torso.position.y=.86;
    this.object.add(this.torso);

    this.shorts=new THREE.Mesh(new THREE.BoxGeometry(.38,.25,.25),shortsMat);
    this.shorts.position.y=.53;
    this.object.add(this.shorts);

    this.head=new THREE.Mesh(new THREE.SphereGeometry(.155,14,10),skin);
    this.head.position.y=1.38;
    this.object.add(this.head);

    const armGeo=new THREE.CapsuleGeometry(.055,.38,5,7);
    this.leftArm=new THREE.Mesh(armGeo,kit);
    this.rightArm=this.leftArm.clone();
    this.leftArm.position.set(-.27,.88,0);
    this.rightArm.position.set(.27,.88,0);
    this.object.add(this.leftArm,this.rightArm);

    const legGeo=new THREE.CapsuleGeometry(.075,.42,5,7);
    this.leftLeg=new THREE.Mesh(legGeo,shortsMat);
    this.rightLeg=this.leftLeg.clone();
    this.leftLeg.position.set(-.105,.31,0);
    this.rightLeg.position.set(.105,.31,0);
    this.object.add(this.leftLeg,this.rightLeg);

    const bootGeo=new THREE.BoxGeometry(.13,.08,.27);
    this.leftBoot=new THREE.Mesh(bootGeo,boot);
    this.rightBoot=this.leftBoot.clone();
    this.leftBoot.position.set(-.105,.075,.07);
    this.rightBoot.position.set(.105,.075,.07);
    this.object.add(this.leftBoot,this.rightBoot);
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
    this.leftLeg.rotation.x=THREE.MathUtils.lerp(this.leftLeg.rotation.x,moving?swing:0,smoothing);
    this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,moving?-swing:0,smoothing);
    this.leftArm.rotation.x=THREE.MathUtils.lerp(this.leftArm.rotation.x,moving?-swing*.55:0,smoothing);
    this.rightArm.rotation.x=THREE.MathUtils.lerp(this.rightArm.rotation.x,moving?swing*.55:0,smoothing);

    const action=frame.actionWeight;
    if(frame.state==="Shoot"){
      this.leftLeg.rotation.x=THREE.MathUtils.lerp(this.leftLeg.rotation.x,-.95,action*.38);
      this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,.55,action*.38);
    }else if(frame.state==="Pass"){
      this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,-.5,action*.32);
    }else if(frame.state==="Tackle"){
      this.torso.rotation.x=THREE.MathUtils.lerp(this.torso.rotation.x,.3,action*.25);
    }else{
      this.torso.rotation.x=THREE.MathUtils.lerp(this.torso.rotation.x,-frame.bodyLean*.45,smoothing);
    }
    this.torso.rotation.z=THREE.MathUtils.lerp(this.torso.rotation.z,-frame.turnLean*.35,smoothing);
    this.head.rotation.y=THREE.MathUtils.lerp(this.head.rotation.y,THREE.MathUtils.clamp(frame.turnLean*1.5,-.45,.45),smoothing);
  }

  applyIK(ik:FootballIK,ballPosition:{x:number;y:number;z:number}){
    const localBall=new THREE.Vector3(ballPosition.x-this.object.position.x,ballPosition.y-this.object.position.y,ballPosition.z-this.object.position.z);
    const target=new THREE.Vector3(localBall.x,Math.max(.08,localBall.y),localBall.z);
    const hipL=new THREE.Vector3(-.11,.58,0),kneeL=new THREE.Vector3(-.11,.32,0),ankleL=this.leftLeg.position.clone();
    const hipR=new THREE.Vector3(.11,.58,0),kneeR=new THREE.Vector3(.11,.32,0),ankleR=this.rightLeg.position.clone();
    const targetWeight=Math.min(1,1/Math.max(.4,localBall.length()));
    ik.solveFoot(hipL,kneeL,ankleL,{position:target,weight:targetWeight});
    ik.solveFoot(hipR,kneeR,ankleR,{position:target,weight:targetWeight*.65});
    this.leftLeg.position.lerp(ankleL,.35);
    this.rightLeg.position.lerp(ankleR,.2);
  }
}
