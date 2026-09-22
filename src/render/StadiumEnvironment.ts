import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export class StadiumEnvironment {
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly environment: THREE.Texture;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    const envScene = new RoomEnvironment();
    this.environment = this.pmrem.fromScene(envScene, 0.04).texture;
    envScene.dispose();

    scene.environment = this.environment;
    scene.environmentIntensity = 0.75;
  }

  setIntensity(value: number): void {
    // Three.js exposes environment intensity on the scene in recent releases.
    this.pmrem.renderer.toneMappingExposure = this.pmrem.renderer.toneMappingExposure;
  }

  dispose(): void {
    this.environment.dispose();
    this.pmrem.dispose();
  }
}
