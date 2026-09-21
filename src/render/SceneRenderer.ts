import * as THREE from "three";

export class SceneRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x071018);
    this.camera.position.set(0, 18, 28);
    this.camera.lookAt(0, 0, 0);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x223344, 2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(20, 35, 10);
    this.scene.add(sun);

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(68, 105),
      new THREE.MeshStandardMaterial({ color: 0x1d6b3a, roughness: 0.95 })
    );
    pitch.rotation.x = -Math.PI / 2;
    this.scene.add(pitch);

    window.addEventListener("resize", () => this.resize(container));
  }

  resize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}