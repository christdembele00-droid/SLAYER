import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Player } from "./Player";
import { FootballIK } from "../animation/FootballIK";
import { AnimationFrame } from "../animation/AnimationTypes";

function numberTexture(number:string):THREE.CanvasTexture{
  const canvas=document.createElement("canvas");
  canvas.width=128; canvas.height=128;
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("Canvas 2D unavailable");
  ctx.clearRect(0,0,128,128);
  ctx.fillStyle="#ffffff";
  ctx.font="900 82px Arial";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(number,64,66);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export class PlayerMesh{
  readonly object=new THREE.Group();
  private readonly torso:THREE.Mesh;
  private readonly shorts:THREE.Mesh;
  private readonly head:THREE.Mesh;
  private readonly neck:THREE.Mesh;
  private readonly hair:THREE.Mesh;
  private readonly leftArm:THREE.Mesh;
  private readonly rightArm:THREE.Mesh;
  private readonly leftLeg:THREE.Mesh;
  private readonly rightLeg:THREE.Mesh;
  private readonly leftSock:THREE.Mesh;
  private readonly rightSock:THREE.Mesh;
  private readonly leftBoot:THREE.Mesh;
  private readonly rightBoot:THREE.Mesh;
  private readonly shoulders:THREE.Mesh;
  private readonly numberMesh:THREE.Mesh;
  private productionRoot:THREE.Object3D|null=null;
  private mixer:THREE.AnimationMixer|null=null;
  private clips=new Map<string,THREE.AnimationAction>();
  private activeClip="";
  private static heroPromise:Promise<THREE.Group>|null=null;
  private static animationPromise:Promise<THREE.AnimationClip[]>|null=null;
  private static productionAssetsEnabled=import.meta.env.VITE_SLAYER_PRODUCTION_ASSETS==="1";

  constructor(player:Player){
    this.object.userData.playerId=player.data.playerId;
    const home=player.data.teamId==="home";
    const primary=home?0x1557d6:0xc91f35;
    const secondary=home?0xf4f7ff:0x171a20;
    const accent=home?0x66b7ff:0xffa0aa;

    const kit=new THREE.MeshStandardMaterial({color:primary,roughness:.48,metalness:.02});
    const accentMat=new THREE.MeshStandardMaterial({color:accent,roughness:.5});
    const shortsMat=new THREE.MeshStandardMaterial({color:secondary,roughness:.62});
    const skin=new THREE.MeshStandardMaterial({color:0xa96f52,roughness:.7});
    const hairMat=new THREE.MeshStandardMaterial({color:0x17110e,roughness:.88});
    const boot=new THREE.MeshStandardMaterial({color:0x080b0e,roughness:.25,metalness:.35});

    this.torso=new THREE.Mesh(new THREE.CapsuleGeometry(.235,.56,10,18),kit);
    this.torso.scale.set(1.12,1.0,.76);
    this.torso.position.y=.86;
    this.torso.castShadow=true;
    this.object.add(this.torso);

    this.shoulders=new THREE.Mesh(new THREE.CapsuleGeometry(.31,.14,8,16),kit);
    this.shoulders.rotation.z=Math.PI/2;
    this.shoulders.position.y=1.08;
    this.shoulders.castShadow=true;
    this.object.add(this.shoulders);

    this.shorts=new THREE.Mesh(new THREE.BoxGeometry(.39,.25,.28),shortsMat);
    this.shorts.position.y=.53;
    this.shorts.castShadow=true;
    this.object.add(this.shorts);

    this.neck=new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,.13,10),skin);
    this.neck.position.y=1.25;
    this.object.add(this.neck);

    this.head=new THREE.Mesh(new THREE.SphereGeometry(.158,24,18),skin);
    this.head.scale.set(1.02,.99,.98);
    this.head.position.y=1.39;
    this.head.castShadow=true;
    this.object.add(this.head);

    this.hair=new THREE.Mesh(new THREE.SphereGeometry(.162,18,10,0,Math.PI*2,0,Math.PI*.48),hairMat);
    this.hair.position.y=1.43;
    this.hair.scale.set(1.02,.8,1.02);
    this.object.add(this.hair);

    const eyeWhite=new THREE.MeshStandardMaterial({color:0xf7f7f3,roughness:.42,metalness:0});
    const eyeDark=new THREE.MeshStandardMaterial({color:0x111317,roughness:.3,metalness:.02});
    for(const side of [-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.022,10,8),eyeWhite);
      eye.position.set(side*.055,1.414,.145);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(.009,8,6),eyeDark);
      pupil.position.set(side*.055,1.414,.165);
      this.object.add(eye,pupil);
    }
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.018,.06,8),skin);
    nose.rotation.x=Math.PI/2;
    nose.position.set(0,1.365,.16);
    this.object.add(nose);

    const collar=new THREE.Mesh(new THREE.TorusGeometry(.09,.018,6,16),accentMat);
    collar.rotation.x=Math.PI/2;
    collar.position.y=1.16;
    this.object.add(collar);

    const armGeo=new THREE.CapsuleGeometry(.052,.34,8,10);
    this.leftArm=new THREE.Mesh(armGeo,kit);
    this.rightArm=new THREE.Mesh(armGeo,kit);
    this.leftArm.position.set(-.275,.89,0);
    this.rightArm.position.set(.275,.89,0);
    this.leftArm.castShadow=this.rightArm.castShadow=true;
    this.object.add(this.leftArm,this.rightArm);
    const forearmGeo=new THREE.CapsuleGeometry(.048,.16,7,9);
    const leftForearm=new THREE.Mesh(forearmGeo,skin);
    leftForearm.position.set(0,-.20,0);
    leftForearm.castShadow=true;
    this.leftArm.add(leftForearm);

    const rightForearm=new THREE.Mesh(forearmGeo,skin);
    rightForearm.position.set(0,-.20,0);
    rightForearm.castShadow=true;
    this.rightArm.add(rightForearm);

    const legGeo=new THREE.CapsuleGeometry(.075,.40,7,9);
    this.leftLeg=new THREE.Mesh(legGeo,skin);
    this.rightLeg=new THREE.Mesh(legGeo,skin);
    this.leftLeg.position.set(-.105,.32,0);
    this.rightLeg.position.set(.105,.32,0);
    this.object.add(this.leftLeg,this.rightLeg);

    const sockGeo=new THREE.CylinderGeometry(.077,.072,.22,10);
    this.leftSock=new THREE.Mesh(sockGeo,accentMat);
    this.rightSock=new THREE.Mesh(sockGeo,accentMat);
    this.leftSock.position.set(-.105,.19,0);
    this.rightSock.position.set(.105,.19,0);
    this.object.add(this.leftSock,this.rightSock);

    const bootGeo=new THREE.BoxGeometry(.14,.09,.31);
    this.leftBoot=new THREE.Mesh(bootGeo,boot);
    this.rightBoot=new THREE.Mesh(bootGeo,boot);
    this.leftBoot.position.set(-.105,.075,.09);
    this.rightBoot.position.set(.105,.075,.09);
    this.leftBoot.castShadow=this.rightBoot.castShadow=true;
    this.object.add(this.leftBoot,this.rightBoot);

    const number=new THREE.Mesh(
      new THREE.PlaneGeometry(.13,.13),
      new THREE.MeshBasicMaterial({map:numberTexture(String(Number(player.data.playerId.replace(/\D/g,""))%99||1)),transparent:true,side:THREE.DoubleSide})
    );
    number.position.set(0,.9,.242);
    this.numberMesh=number;
    this.object.add(number);

    if(PlayerMesh.productionAssetsEnabled){
      void this.loadProductionVisual();
    }

    this.object.traverse(o=>{
      const m=o as THREE.Mesh;
      if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}
    });
  }

  private static loadHero():Promise<THREE.Group>{
    if(!this.heroPromise){
      const loader=new GLTFLoader();
      this.heroPromise=loader.loadAsync("/assets/3d/players/player-hero.glb").then(gltf=>gltf.scene);
    }
    return this.heroPromise;
  }

  private static loadAnimations():Promise<THREE.AnimationClip[]>{
    if(!this.animationPromise){
      const loader=new GLTFLoader();
      this.animationPromise=loader.loadAsync("/assets/3d/animations/universal-animation-library.glb").then(gltf=>gltf.animations);
    }
    return this.animationPromise;
  }

  private async loadProductionVisual():Promise<void>{
    try{
      const [source,clips]=await Promise.all([PlayerMesh.loadHero(),PlayerMesh.loadAnimations()]);
      const root=SkeletonUtils.clone(source) as THREE.Object3D;
      root.scale.setScalar(.95);
      root.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(!mesh.isMesh) return;
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const raw of materials){
          const m=raw as THREE.MeshStandardMaterial;
          if(!m.isMeshStandardMaterial) continue;
          m.envMapIntensity=1;
          m.roughness=THREE.MathUtils.clamp(m.roughness,.28,.92);
          m.metalness=THREE.MathUtils.clamp(m.metalness,0,1);
          if(m.map) m.map.colorSpace=THREE.SRGBColorSpace;
        }
      });
      this.productionRoot=root;
      this.object.add(root);
      this.torso.visible=false;this.shoulders.visible=false;this.shorts.visible=false;this.neck.visible=false;
      this.head.visible=false;this.hair.visible=false;this.leftArm.visible=false;this.rightArm.visible=false;
      this.leftLeg.visible=false;this.rightLeg.visible=false;this.leftSock.visible=false;this.rightSock.visible=false;
      this.leftBoot.visible=false;this.rightBoot.visible=false;this.numberMesh.visible=false;this.numberMesh.visible=false;
      this.mixer=new THREE.AnimationMixer(root);
      for(const clip of clips){
        const normalized=clip.name.toLowerCase();
        let semantic:string|undefined;
        if(normalized.includes("idle")) semantic="Idle";
        else if(normalized.includes("sprint")) semantic="Sprint";
        else if(normalized.includes("jog")) semantic="Run";
        else if(normalized.includes("walk")) semantic="Walk";
        if(semantic && !this.clips.has(semantic)) this.clips.set(semantic,this.mixer.clipAction(clip));
      }
      const idle=this.clips.get("Idle");
      if(idle){idle.play();this.activeClip="Idle";}
    }catch(error){
      console.warn("[SLAYER assets] Optional player GLB unavailable; procedural player retained.");
    }
  }

  sync(player:Player){
    const p=player.state.position;
    this.object.position.set(p.x,p.y,p.z);
    this.object.rotation.y=player.state.rotationY;
  }

  applyAnimation(frame:AnimationFrame,delta:number){
    if(this.mixer){
      const desired=frame.state==="Sprint"?"Sprint":frame.state==="Run"?"Run":frame.state==="Walk"?"Walk":"Idle";
      const next=this.clips.get(desired)??this.clips.get("Idle");
      if(next && this.activeClip!==desired){
        this.clips.get(this.activeClip)?.fadeOut(.12);
        next.reset().fadeIn(.12).play();
        this.activeClip=desired;
      }
      next?.setEffectiveTimeScale(Math.max(.7,Math.min(1.8,frame.speed/3.2||1)));
      this.mixer.update(delta);
      return;
    }
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
    this.hair.rotation.y=this.head.rotation.y;
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
