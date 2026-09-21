import * as THREE from "three";

export interface FieldDimensions {
  width: number;
  length: number;
}

export class MatchField {
  readonly dimensions: FieldDimensions = { width: 68, length: 105 };
  readonly group = new THREE.Group();

  constructor() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(this.dimensions.width, this.dimensions.length),
      new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.9 })
    );
    grass.rotation.x = -Math.PI / 2;
    this.group.add(grass);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const halfW = this.dimensions.width / 2;
    const halfL = this.dimensions.length / 2;

    const outline = this.createLine([
      [-halfW, -halfL], [halfW, -halfL], [halfW, halfL],
      [-halfW, halfL], [-halfW, -halfL]
    ], lineMaterial);
    this.group.add(outline);

    const halfway = this.createLine([[-halfW, 0], [halfW, 0]], lineMaterial);
    this.group.add(halfway);

    const center = new THREE.Mesh(
      new THREE.RingGeometry(9.15, 9.25, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.012;
    this.group.add(center);

    const centerSpot = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    centerSpot.rotation.x = -Math.PI / 2;
    centerSpot.position.y = 0.013;
    this.group.add(centerSpot);
  }

  private createLine(points: number[][], material: THREE.LineBasicMaterial): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, z]) => new THREE.Vector3(x, 0.015, z))
    );
    return new THREE.Line(geometry, material);
  }
}
