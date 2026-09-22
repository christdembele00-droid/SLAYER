import * as THREE from "three";

export class AAAStadium{
  readonly group=new THREE.Group();
  constructor(){
    this.addStand("north",0,7,58,90,12);
    this.addStand("south",0,7,-58,90,12);
    this.addStand("west",-40,7,0,12,105);
    this.addStand("east",40,7,0,12,105);
    this.addFloodlights();
    this.addGoals();
    this.addTunnel();
    this.addRoofStructure();
    this.addPitchPerimeter();
  }
  private addStand(_name:string,x:number,y:number,z:number,w:number,d:number){
    const baseMat=new THREE.MeshStandardMaterial({color:0x11181c,roughness:.88,metalness:.08});
    const concreteMat=new THREE.MeshStandardMaterial({color:0x2a3439,roughness:.72,metalness:.12});
    const seatMat=new THREE.MeshStandardMaterial({color:0x4b5660,roughness:.82});
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,14,d),baseMat);
    base.position.set(x,y,z);base.castShadow=true;base.receiveShadow=true;this.group.add(base);
    for(let row=0;row<9;row++){
      const tier=new THREE.Mesh(new THREE.BoxGeometry(w*.9,1.05,d*.76),row<2?concreteMat:seatMat);
      tier.position.set(x,3.2+row*1.42,z);
      tier.castShadow=true;this.group.add(tier);
    }
    for(let row=0;row<4;row++){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(w*.92,.08,.08),new THREE.MeshStandardMaterial({color:0xb7c1c5,metalness:.75,roughness:.3}));
      rail.position.set(x,4.2+row*2.7,z+(d*.38));
      this.group.add(rail);
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+5,1.1,d+4),baseMat);
    roof.position.set(x,16,z);roof.castShadow=true;this.group.add(roof);
    const fascia=new THREE.Mesh(new THREE.BoxGeometry(w+2,.55,.25),new THREE.MeshStandardMaterial({color:0x0b0f12,metalness:.65,roughness:.3}));
    fascia.position.set(x,15.3,z-d*.48);this.group.add(fascia);
  }
  private addFloodlights(){
    const poleMat=new THREE.MeshStandardMaterial({color:0x68747b,roughness:.38,metalness:.8});
    const lampMat=new THREE.MeshStandardMaterial({color:0xfff4d6,emissive:0xffe6ad,emissiveIntensity:2.5});
    for(const x of [-34,34])for(const z of [-48,48]){
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.16,.3,24,12),poleMat);
      pole.position.set(x,12,z);pole.castShadow=true;this.group.add(pole);
      const bar=new THREE.Mesh(new THREE.BoxGeometry(5,.28,.55),lampMat);
      bar.position.set(x,23.8,z);this.group.add(bar);
      for(let i=0;i<8;i++){
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(.34,.12,.18),lampMat);
        lamp.position.set(x-2.1+i*.6,23.58,z);
        this.group.add(lamp);
      }
      const glow=new THREE.PointLight(0xffe8bb,.45,65,2);
      glow.position.set(x,23,z);this.group.add(glow);
    }
  }
  private addGoals(){
    const postMat=new THREE.MeshStandardMaterial({color:0xf7f7f2,roughness:.2,metalness:.15});
    const netMat=new THREE.MeshStandardMaterial({color:0xd9e0e2,transparent:true,opacity:.28,roughness:.7,side:THREE.DoubleSide});
    for(const z of [-52.5,52.5]){
      for(const x of [-3.66,3.66]){
        const p=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,2.44,16),postMat);
        p.position.set(x,1.22,z);p.castShadow=true;this.group.add(p);
      }
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,7.32,16),postMat);
      bar.rotation.z=Math.PI/2;bar.position.set(0,2.44,z);bar.castShadow=true;this.group.add(bar);
      const back=new THREE.Mesh(new THREE.PlaneGeometry(7.32,2.44,12,6),netMat);
      back.position.set(0,1.22,z+(z>0?1.5:-1.5));back.rotation.y=z>0?0:Math.PI;this.group.add(back);
    }
  }
  private addTunnel(){
    const mat=new THREE.MeshStandardMaterial({color:0x101519,roughness:.82,metalness:.1});
    const tunnel=new THREE.Mesh(new THREE.BoxGeometry(8,4,5),mat);
    tunnel.position.set(0,2,-47);tunnel.castShadow=true;this.group.add(tunnel);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(9,.22,5.5),new THREE.MeshStandardMaterial({color:0x3c454a,metalness:.5,roughness:.35}));
    roof.position.set(0,4.15,-47);this.group.add(roof);
  }
  private addRoofStructure(){
    const mat=new THREE.MeshStandardMaterial({color:0x59646a,metalness:.72,roughness:.34});
    for(const z of [-58,58]){
      for(const x of [-42,-21,0,21,42]){
        const beam=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,17,8),mat);
        beam.position.set(x,8,z);beam.rotation.z=Math.PI/2;this.group.add(beam);
      }
    }
  }
  private addPitchPerimeter(){
    const mat=new THREE.MeshStandardMaterial({color:0x151c20,roughness:.9});
    for(const z of [-53.8,53.8]){
      const board=new THREE.Mesh(new THREE.BoxGeometry(76,.65,.28),mat);
      board.position.set(0,.35,z);this.group.add(board);
    }
  }
}