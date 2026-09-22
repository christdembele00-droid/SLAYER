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

    scene.environment = this.environment;
    scene.environmentIntensity = 0.75;
  }

  dispose(): void {
    this.environment.dispose();
    this.pmrem.dispose();
  }
}
