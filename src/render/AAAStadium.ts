import * as THREE from "three";

function makeSeatMaterial(color:number){return new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.06});}

export class AAAStadium{
  readonly group=new THREE.Group();
  constructor(){
    this.group.name="SLAYER_AAA_STADIUM";
    this.addStand("north",0,7,58,90,12);this.addStand("south",0,7,-58,90,12);
    this.addStand("west",-40,7,0,12,105);this.addStand("east",40,7,0,12,105);
    this.addFloodlights();this.addGoals();this.addTunnel();this.addRoofStructure();this.addPitchPerimeter();
    this.addAdvertising();this.addCornerStructures();
  }
  private addStand(_name:string,x:number,y:number,z:number,w:number,d:number){
    const baseMat=new THREE.MeshStandardMaterial({color:0x0d1418,roughness:.88,metalness:.12});
    const concreteMat=new THREE.MeshStandardMaterial({color:0x273238,roughness:.68,metalness:.14});
    const lower=makeSeatMaterial(0x33433f),upper=makeSeatMaterial(0x263b35);
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,14,d),baseMat);
    base.position.set(x,y,z);base.castShadow=true;base.receiveShadow=true;this.group.add(base);
    for(let row=0;row<11;row++){
      const tier=new THREE.Mesh(new THREE.BoxGeometry(w*.91,1.02,d*.76),row<2?concreteMat:(row%2?lower:upper));
      tier.position.set(x,3.1+row*1.35,z-(row%2)*.15);tier.castShadow=true;tier.receiveShadow=true;this.group.add(tier);
    }
    const aisleMat=new THREE.MeshStandardMaterial({color:0x10181b,roughness:.9});
    if(w>20) for(const laneX of [-.34,0,.34]){
      const aisle=new THREE.Mesh(new THREE.BoxGeometry(.7,1.1,d*.78),aisleMat);
      aisle.position.set(x+w*laneX,3.25,z);this.group.add(aisle);
    }
    const railMat=new THREE.MeshStandardMaterial({color:0xa8b2b3,metalness:.78,roughness:.28});
    for(let row=0;row<4;row++){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(w*.94,.055,.055),railMat);
      rail.position.set(x,4.15+row*2.65,z+d*.39);this.group.add(rail);
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+6,1.15,d+5),baseMat);
    roof.position.set(x,16,z);roof.castShadow=true;this.group.add(roof);
    const fascia=new THREE.Mesh(new THREE.BoxGeometry(w+2,.55,.22),new THREE.MeshStandardMaterial({color:0x090d10,metalness:.68,roughness:.28}));
    fascia.position.set(x,15.35,z-d*.49);this.group.add(fascia);
  }
  private addFloodlights(){
    const poleMat=new THREE.MeshStandardMaterial({color:0x59666c,roughness:.34,metalness:.86});
    const housingMat=new THREE.MeshStandardMaterial({color:0x12181b,roughness:.44,metalness:.66});
    const lampMat=new THREE.MeshStandardMaterial({color:0xfff5d9,emissive:0xffdf9e,emissiveIntensity:3.2,roughness:.25});
    for(const [x,z] of [[-34,-48],[-34,48],[34,-48],[34,48]] as [number,number][]){
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.34,24,12),poleMat);
      pole.position.set(x,12,z);pole.castShadow=true;this.group.add(pole);
      const head=new THREE.Mesh(new THREE.BoxGeometry(6.2,.62,.9),housingMat);
      head.position.set(x,23.6,z);head.castShadow=true;this.group.add(head);
      for(let i=0;i<10;i++){
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(.42,.16,.3),lampMat);
        lamp.position.set(x-2.25+i*.5,23.52,z-.02);this.group.add(lamp);
      }
      const spot=new THREE.SpotLight(0xffe9bf,18,115,Math.PI/5,.62,1.55);
      spot.position.set(x,23.2,z);spot.target.position.set(0,0,0);this.group.add(spot,spot.target);
      const glow=new THREE.PointLight(0xffe3b2,.55,58,2);glow.position.set(x,22.8,z);this.group.add(glow);
    }
  }
  private addGoals(){
    const postMat=new THREE.MeshStandardMaterial({color:0xf4f7f6,roughness:.16,metalness:.18});
    for(const z of [-52.5,52.5]){
      for(const x of [-3.66,3.66]){
        const p=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,2.44,18),postMat);p.position.set(x,1.22,z);p.castShadow=true;this.group.add(p);
      }
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,7.32,18),postMat);bar.rotation.z=Math.PI/2;bar.position.set(0,2.44,z);bar.castShadow=true;this.group.add(bar);
    }
  }
  private addTunnel(){
    const mat=new THREE.MeshStandardMaterial({color:0x0c1317,roughness:.82,metalness:.08});
    const tunnel=new THREE.Mesh(new THREE.BoxGeometry(8.5,4,5.2),mat);tunnel.position.set(0,2,-47);tunnel.castShadow=true;this.group.add(tunnel);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(9.4,.22,5.7),new THREE.MeshStandardMaterial({color:0x344148,metalness:.58,roughness:.32}));
    roof.position.set(0,4.15,-47);this.group.add(roof);
    const light=new THREE.PointLight(0xfff1d6,.9,18,2);light.position.set(0,3.2,-44.8);this.group.add(light);
  }
  private addRoofStructure(){
    const mat=new THREE.MeshStandardMaterial({color:0x4a565c,metalness:.74,roughness:.34});
    for(const z of [-58,58]){
      for(const x of [-42,-21,0,21,42]){
        const beam=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,17,8),mat);beam.position.set(x,8,z);beam.rotation.z=Math.PI/2;beam.castShadow=true;this.group.add(beam);
      }
      const truss=new THREE.Mesh(new THREE.BoxGeometry(88,.32,.32),mat);truss.position.set(0,17,z);truss.castShadow=true;this.group.add(truss);
    }
  }
  private addPitchPerimeter(){
    const mat=new THREE.MeshStandardMaterial({color:0x11181b,roughness:.86,metalness:.08});
    for(const z of [-53.8,53.8]){const board=new THREE.Mesh(new THREE.BoxGeometry(76,.65,.28),mat);board.position.set(0,.35,z);this.group.add(board);}
  }
  private addAdvertising(){
    const panelMat=new THREE.MeshStandardMaterial({color:0x071417,roughness:.44,metalness:.08,emissive:0x02100d,emissiveIntensity:.45});
    for(const z of [-53.35,53.35]) for(let i=0;i<10;i++){
      const panel=new THREE.Mesh(new THREE.BoxGeometry(7.15,.72,.06),panelMat);panel.position.set(-32.2+i*7.15,.78,z);this.group.add(panel);
    }
  }
  private addCornerStructures(){
    const mat=new THREE.MeshStandardMaterial({color:0x182328,roughness:.72,metalness:.18});
    for(const [x,z] of [[-39,-53],[-39,53],[39,-53],[39,53]] as [number,number][]){
      const tower=new THREE.Mesh(new THREE.BoxGeometry(1.2,15,1.2),mat);tower.position.set(x,7.5,z);tower.castShadow=true;this.group.add(tower);
    }
  }
}