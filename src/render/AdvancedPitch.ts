import * as THREE from "three";
function noiseTexture(size=1024):THREE.CanvasTexture{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=size;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas 2D unavailable");
  const image=ctx.createImageData(size,size);let seed=0x12345678;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967295;};
  for(let i=0;i<image.data.length;i+=4){const n=rand(),fine=rand(),g=64+n*34+fine*8;image.data[i]=15+n*8;image.data[i+1]=g;image.data[i+2]=34+n*11;image.data[i+3]=255;}
  ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(10,16);texture.anisotropy=8;return texture;
}
function grassRoughness(size=512):THREE.CanvasTexture{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=size;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas 2D unavailable");
  const image=ctx.createImageData(size,size);for(let i=0;i<image.data.length;i+=4){const v=122+Math.floor((i/4)%17)*3;image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;}
  ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(10,16);return texture;
}
export class AdvancedPitch{
  readonly group=new THREE.Group();private readonly grass:THREE.Mesh;private readonly stripe:THREE.Mesh;private readonly grassMaterial:THREE.MeshStandardMaterial;
  constructor(){
    const colorMap=noiseTexture(),roughnessMap=grassRoughness();
    this.grassMaterial=new THREE.MeshStandardMaterial({map:colorMap,roughness:.62,roughnessMap,metalness:0,envMapIntensity:.55});
    this.grassMaterial.normalScale.set(.22,.22);
    this.grass=new THREE.Mesh(new THREE.PlaneGeometry(68,105,2,2),this.grassMaterial);this.grass.rotation.x=-Math.PI/2;this.grass.receiveShadow=true;this.group.add(this.grass);
    const stripeMat=new THREE.MeshStandardMaterial({color:0x267946,roughness:.8,metalness:0,envMapIntensity:.34}),stripeGeo=new THREE.PlaneGeometry(8.5,105,1,1);
    for(let i=0;i<8;i++){const stripe=new THREE.Mesh(stripeGeo,stripeMat);stripe.rotation.x=-Math.PI/2;stripe.position.set(-29.75+i*8.5,-.009,0);stripe.receiveShadow=true;this.group.add(stripe);}
    this.stripe=this.group.children[this.group.children.length-1] as THREE.Mesh;this.addMarkings();this.addPenaltySpots();this.addCornerArcs();
  }
  private addMarkings(){
    const mat=new THREE.MeshBasicMaterial({color:0xf5f8f5,transparent:true,opacity:.98,side:THREE.DoubleSide}),add=(pts:THREE.Vector3[])=>this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));
    const w=34,l=52.5;add([new THREE.Vector3(-w,.02,-l),new THREE.Vector3(w,.02,-l),new THREE.Vector3(w,.02,l),new THREE.Vector3(-w,.02,l),new THREE.Vector3(-w,.02,-l)]);add([new THREE.Vector3(-w,.02,0),new THREE.Vector3(w,.02,0)]);
    const circle=(r:number,cx:number,cz:number)=>{const pts:THREE.Vector3[]=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;pts.push(new THREE.Vector3(cx+Math.cos(a)*r,.021,cz+Math.sin(a)*r));}add(pts);};
    circle(9.15,0,0);circle(.11,0,0);
    for(const z of [-52.5,52.5]){const sign=Math.sign(z),boxZ=z-sign*16.5,smallZ=z-sign*5.5;add([new THREE.Vector3(-16.5,.02,boxZ),new THREE.Vector3(16.5,.02,boxZ),new THREE.Vector3(16.5,.02,z),new THREE.Vector3(-16.5,.02,z),new THREE.Vector3(-16.5,.02,boxZ)]);add([new THREE.Vector3(-9.16,.02,smallZ),new THREE.Vector3(9.16,.02,smallZ),new THREE.Vector3(9.16,.02,z),new THREE.Vector3(-9.16,.02,z),new THREE.Vector3(-9.16,.02,smallZ)]);}
  }
  private addPenaltySpots(){const mat=new THREE.MeshBasicMaterial({color:0xffffff});for(const z of [-39.1,39.1]){const spot=new THREE.Mesh(new THREE.CircleGeometry(.11,24),mat);spot.rotation.x=-Math.PI/2;spot.position.set(0,.023,z);this.group.add(spot);}}
  private addCornerArcs(){const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.96});for(const sx of [-1,1])for(const sz of [-1,1]){const pts:THREE.Vector3[]=[];for(let i=0;i<=18;i++){const a=i/18*Math.PI/2;pts.push(new THREE.Vector3(sx*(34-Math.cos(a)),.022,sz*(52.5-Math.sin(a)));}this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));}}
  setWetness(wetness:number){const w=THREE.MathUtils.clamp(wetness,0,1);this.grassMaterial.roughness=THREE.MathUtils.lerp(.78,.28,w);this.grassMaterial.envMapIntensity=THREE.MathUtils.lerp(.42,.8,w);}
}