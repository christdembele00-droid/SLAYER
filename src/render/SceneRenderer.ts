import * as THREE from "three";
import { configureShadow } from "./GraphicsQuality";

export class SceneRenderer {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(58,1,.08,420);
  readonly renderer:THREE.WebGLRenderer;
  private readonly container:HTMLElement;
  private readonly sun:THREE.DirectionalLight;
  private qualityRatio=1;

  constructor(container:HTMLElement){
    this.container=container;
    this.renderer=new THREE.WebGLRenderer({
      antialias:true,
      powerPreference:"high-performance",
      alpha:false,
      stencil:false,
      depth:true,
      preserveDrawingBuffer:false
    });
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.08;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.35));
    this.renderer.setSize(container.clientWidth,container.clientHeight,false);

    this.scene.background=new THREE.Color(0x06100d);
    this.scene.fog=new THREE.Fog(0x06100d,75,240);

    this.camera.position.set(0,18,28);
    this.camera.lookAt(0,0,0);

    const hemi=new THREE.HemisphereLight(0xdff4ff,0x0b2116,2.0);
    this.scene.add(hemi);

    this.sun=new THREE.DirectionalLight(0xfff1d6,3.6);
    this.sun.position.set(-35,55,25);
    configureShadow(this.sun,1536);
    this.scene.add(this.sun);

    const fill=new THREE.DirectionalLight(0x8fcfff,.95);
    fill.position.set(35,24,-35);
    this.scene.add(fill);

    const rim=new THREE.DirectionalLight(0x8affd0,.55);
    rim.position.set(-10,18,-55);
    this.scene.add(rim);

    this.addAtmosphere();
    container.appendChild(this.renderer.domElement);
    window.addEventListener("resize",()=>this.resize());
  }

  private addAtmosphere(){
    const haze=new THREE.Mesh(
      new THREE.RingGeometry(72,145,128),
      new THREE.MeshBasicMaterial({color:0x183a2d,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false})
    );
    haze.rotation.x=-Math.PI/2;
    haze.position.y=-.05;
    this.scene.add(haze);
  }

  resize(){
    this.camera.aspect=this.container.clientWidth/Math.max(this.container.clientHeight,1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false);
  }

  setQuality(pixelRatio:number){
    this.qualityRatio=Math.min(Math.max(pixelRatio,.65),1.35);
    this.renderer.setPixelRatio(this.qualityRatio);
    const enableShadows=this.qualityRatio>=.8;
    this.renderer.shadowMap.enabled=enableShadows;
    this.sun.castShadow=enableShadows;
    if(enableShadows){
      const size=this.qualityRatio>=1.15?2048:this.qualityRatio>=.9?1536:1024;
      this.sun.shadow.mapSize.set(size,size);
    }
    this.scene.fog=new THREE.Fog(0x06100d,75,this.qualityRatio<.75?150:this.qualityRatio<.9?190:240);
  }

  render(){
    this.renderer.render(this.scene,this.camera);
  }
}
