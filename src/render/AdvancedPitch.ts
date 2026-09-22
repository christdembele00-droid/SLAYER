import * as THREE from "three";

function grassTexture(size=512):THREE.CanvasTexture{
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("Canvas 2D unavailable");
  const image=ctx.createImageData(size,size);
  for(let i=0;i<image.data.length;i+=4){
    const n=Math.random();
    const base=48+n*22;
    image.data[i]=20;
    image.data[i+1]=base+35;
    image.data[i+2]=42+n*12;
    image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(7,11);
  texture.anisotropy=4;
  return texture;
}

export class AdvancedPitch{
  readonly group=new THREE.Group();
  private readonly grass:THREE.Mesh;
  private readonly stripe:THREE.Mesh;

  constructor(){
    const map=grassTexture();
    const grassMat=new THREE.MeshStandardMaterial({
      map,roughness:.72,metalness:0
    });
    this.grass=new THREE.Mesh(new THREE.PlaneGeometry(68,105,1,1),grassMat);
    this.grass.rotation.x=-Math.PI/2;
    this.grass.receiveShadow=true;
    this.group.add(this.grass);

    const stripeMat=new THREE.MeshStandardMaterial({
      color:0x2b8a4b,roughness:.78,metalness:0
    });
    const stripeGeo=new THREE.PlaneGeometry(68/8,105,1,1);
    for(let i=0;i<8;i++){
      const stripe=new THREE.Mesh(stripeGeo,stripeMat);
      stripe.rotation.x=-Math.PI/2;
      stripe.position.set(-34+68/16+i*68/8,-.008,0);
      this.group.add(stripe);
    }
    this.stripe=this.group.children[this.group.children.length-1] as THREE.Mesh;
    this.addMarkings();
  }

  private addMarkings(){
    const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.96,side:THREE.DoubleSide});
    const add=(pts:THREE.Vector3[])=>{
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat);
      this.group.add(line);
    };
    const w=68/2,l=105/2;
    add([
      new THREE.Vector3(-w,.018,-l),new THREE.Vector3(w,.018,-l),
      new THREE.Vector3(w,.018,l),new THREE.Vector3(-w,.018,l),
      new THREE.Vector3(-w,.018,-l)
    ]);
    add([new THREE.Vector3(-w,.018,0),new THREE.Vector3(w,.018,0)]);
    const circle=(r:number,cx:number,cz:number)=>{
      const pts:THREE.Vector3[]=[];
      for(let i=0;i<=96;i++){
        const a=i/96*Math.PI*2;
        pts.push(new THREE.Vector3(cx+Math.cos(a)*r,.019,cz+Math.sin(a)*r));
      }
      add(pts);
    };
    circle(9.15,0,0);
    circle(.11,0,0);
    for(const z of [-44.5,44.5]){
      const sign=Math.sign(z);
      const boxZ=z-sign*8.5;
      const smallZ=z-sign*3.9;
      add([
        new THREE.Vector3(-16.5,.018,boxZ),new THREE.Vector3(16.5,.018,boxZ),
        new THREE.Vector3(16.5,.018,z),new THREE.Vector3(-16.5,.018,z),
        new THREE.Vector3(-16.5,.018,boxZ)
      ]);
      add([
        new THREE.Vector3(-9.16,.018,smallZ),new THREE.Vector3(9.16,.018,smallZ),
        new THREE.Vector3(9.16,.018,z),new THREE.Vector3(-9.16,.018,z),
        new THREE.Vector3(-9.16,.018,smallZ)
      ]);
    }
  }

  setWetness(wetness:number){
    const mat=this.grass.material as THREE.MeshStandardMaterial;
    mat.roughness=THREE.MathUtils.lerp(.82,.34,THREE.MathUtils.clamp(wetness,0,1));
  }
}
