import * as THREE from "three";
import { Player } from "./Player";

export class PlayerMesh {
  readonly object = new THREE.Group();

  constructor(player: Player) {
    const material = new THREE.MeshStandardMaterial({ color: player.data.teamId === "home" ? 0x2563eb : 0xdc2626 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc68662 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.72, 6, 10), material);
    body.position.y = 0.78;
    this.object.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), skin);
    head.position.y = 1.35;
    this.object.add(head);

    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 6), material);
    const rightLeg = leftLeg.clone();
    leftLeg.position.set(-0.11, 0.35, 0);
    rightLeg.position.set(0.11, 0.35, 0);
    this.object.add(leftLeg, rightLeg);
  }

  sync(player: Player): void {
    const p = player.state.position;
    this.object.position.set(p.x, p.y, p.z);
    this.object.rotation.y = player.state.rotationY;
  }
}