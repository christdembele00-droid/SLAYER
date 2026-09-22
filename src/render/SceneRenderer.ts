import * as THREE from "three";

export class SceneRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
  readonly renderer: THREE.WebGLRenderer;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: true
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);

    this.scene.background = new THREE.Color(0x06100d);
    this.scene.fog = new THREE.Fog(0x06100d, 75, 260);
    this.camera.position.set(0, 18, 28);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xeaf7ff, 0x10251b, 2.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4df, 3.2);
    sun.position.set(-35, 55, 25);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fd8ff, 0.8);
    fill.position.set(35, 24, -35);
    this.scene.add(fill);

    this.addPitchBase();
    this.addAtmosphere();
    container.appendChild(this.renderer.domElement);
    window.addEventListener("resize", () => this.resize());
  }

  private addPitchBase(): void {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(68, 105, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x176b38, roughness: 0.88, metalness: 0 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    this.scene.add(grass);
  }

  private addAtmosphere(): void {
    const haze = new THREE.Mesh(
      new THREE.RingGeometry(72, 145, 96),
      new THREE.MeshBasicMaterial({ color: 0x183a2d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = -0.05;
    this.scene.add(haze);
  }

  resize(): void {
    this.camera.aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
  }

  setQuality(pixelRatio: number): void {
    this.renderer.setPixelRatio(Math.min(Math.max(pixelRatio, 0.65), 1.5));
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
