import * as THREE from "three";
import { configureShadow } from "./GraphicsQuality";
import { StadiumEnvironment } from "./StadiumEnvironment";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export class SceneRenderer{
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(54,1,.05,500);
  readonly renderer:THREE.WebGLRenderer;
  private readonly container:HTMLElement;
  private readonly sun:THREE.DirectionalLight;
  private readonly stadiumEnvironment:StadiumEnvironment;
  private readonly sky:Sky;
  private readonly composer:EffectComposer;
  private readonly bloom:UnrealBloomPass;
  private qualityRatio=1;
  private postProcessing=false;

  constructor(container:HTMLElement){
    this.container=container;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false,stencil:false,depth:true,preserveDrawingBuffer:false});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.06;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset=true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    this.renderer.setSize(container.clientWidth,container.clientHeight,false);

    this.composer=new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.0));
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(container.clientWidth,container.clientHeight),.16,.72,.88);
    this.composer.addPass(this.bloom);

    this.stadiumEnvironment=new StadiumEnvironment(this.renderer,this.scene);
    this.sky=new Sky();
    this.sky.scale.setScalar(450);
    const skyMaterial=this.sky.material as THREE.ShaderMaterial;
    skyMaterial.uniforms["turbidity"].value=5.2;
    skyMaterial.uniforms["rayleigh"].value=.95;
    skyMaterial.uniforms["mieCoefficient"].value=.0022;
    skyMaterial.uniforms["mieDirectionalG"].value=.88;
    skyMaterial.uniforms["sunPosition"].value=new THREE.Vector3(-.28,.88,.36).normalize();
    this.scene.add(this.sky);

    this.scene.background=new THREE.Color(0x060b0c);
    this.scene.fog=new THREE.FogExp2(0x07100e,.00165);

    this.camera.position.set(0,12.5,27);
    this.camera.lookAt(0,1.2,0);

    const hemi=new THREE.HemisphereLight(0xdbefff,0x06140c,1.45);
    this.scene.add(hemi);

    this.sun=new THREE.DirectionalLight(0xfff2dd,3.1);
    this.sun.position.set(-42,68,34);
    configureShadow(this.sun,2048);
    this.sun.shadow.bias=-.00012;
    this.sun.shadow.normalBias=.012;
    this.scene.add(this.sun);

    const fill=new THREE.DirectionalLight(0x8fc9ff,.62);
    fill.position.set(35,26,-38);
    this.scene.add(fill);

    const rim=new THREE.DirectionalLight(0x6fffc1,.54);
    rim.position.set(-18,20,-58);
    this.scene.add(rim);

    container.appendChild(this.renderer.domElement);
    window.addEventListener("resize",()=>this.resize());
  }

  resize(){
    this.camera.aspect=this.container.clientWidth/Math.max(this.container.clientHeight,1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false);
    this.composer.setSize(this.container.clientWidth,this.container.clientHeight);
  }

  setQuality(pixelRatio:number){
    this.qualityRatio=THREE.MathUtils.clamp(pixelRatio,.65,1.35);
    this.renderer.setPixelRatio(this.qualityRatio);
    this.renderer.toneMappingExposure=this.qualityRatio>=1.15?1.08:this.qualityRatio>=.9?1.06:1.02;
    const enabled=this.qualityRatio>=.78;
    this.renderer.shadowMap.enabled=enabled;
    this.sun.castShadow=enabled;
    if(enabled){
      const size=this.qualityRatio>=1.15?2048:this.qualityRatio>=.9?1536:1024;
      this.sun.shadow.mapSize.set(size,size);
    }
    this.scene.fog=new THREE.FogExp2(0x07100e,this.qualityRatio<.78?.0024:this.qualityRatio<.92?.00195:.00145);
    this.bloom.strength=this.qualityRatio<.78?.06:this.qualityRatio<.92?.11:this.qualityRatio<1.12?.16:.22;
    this.bloom.radius=this.qualityRatio>=1.12?.72:.58;
    this.bloom.threshold=this.qualityRatio<.9?.92:.84;
  }

  render(){this.postProcessing?this.composer.render():this.renderer.render(this.scene,this.camera);}
}