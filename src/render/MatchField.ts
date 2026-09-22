import * as THREE from "three";

export interface FieldDimensions { width: number; length: number; }

export class MatchField {
  readonly dimensions: FieldDimensions = { width: 68, length: 105 };
  readonly group = new THREE.Group();

  constructor() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(this.dimensions.width, this.dimensions.length),
      new THREE.MeshStandardMaterial({ color: 0x1d743d, roughness: 0.9 })
    );
    grass.rotation.x = -Math.PI / 2;
    this.group.add(grass);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf5f7f2, transparent: true, opacity: 0.92 });
    const halfW = this.dimensions.width / 2;
    const halfL = this.dimensions.length / 2;
    const addLine = (points: number[][]) => this.group.add(this.createLine(points, lineMaterial));

    addLine([[-halfW,-halfL],[halfW,-halfL],[halfW,halfL],[-halfW,halfL],[-halfW,-halfL]]);
    addLine([[-halfW,0],[halfW,0]]);

    const center = new THREE.Mesh(new THREE.RingGeometry(9.15,9.28,96),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.95}));
    center.rotation.x=-Math.PI/2; center.position.y=.014; this.group.add(center);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(.12,24),new THREE.MeshBasicMaterial({color:0xffffff}));
    spot.rotation.x=-Math.PI/2; spot.position.y=.015; this.group.add(spot);

    this.addBox(-halfL, -34, 16.5, 40.3, lineMaterial);
    this.addBox(halfL, 34, 16.5, 40.3, lineMaterial);
    this.addBox(-halfL, -43.5, 9.2, 18.32, lineMaterial);
    this.addBox(halfL, 43.5, 9.2, 18.32, lineMaterial);
    this.addArc(-halfL + 11, 0, 9.15, lineMaterial, Math.PI * .35, Math.PI * .65);
    this.addArc(halfL - 11, Math.PI, 9.15, lineMaterial, Math.PI * .35, Math.PI * .65);
  }

  private addBox(z:number, centerZ:number, width:number, length:number, material:THREE.LineBasicMaterial):void {
    const halfW=width/2; const halfL=length/2;
    const cz=centerZ;
    this.group.add(this.createLine([[-halfW,cz-halfL],[halfW,cz-halfL],[halfW,cz+halfL],[-halfW,cz+halfL],[-halfW,cz-halfL]],material));
  }

  private addArc(cx:number, cz:number, radius:number, material:THREE.LineBasicMaterial, start:number, end:number):void {
    const points:number[][]=[];
    for(let i=0;i<=24;i++){const a=start+(end-start)*(i/24);points.push([cx+Math.cos(a)*radius,cz+Math.sin(a)*radius]);}
    this.group.add(this.createLine(points,material));
  }

  private createLine(points:number[][], material:THREE.LineBasicMaterial):THREE.Line {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,.016,z))),material);
  }
}
