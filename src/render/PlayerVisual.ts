import * as THREE from "three";
import { AssetPipeline, LoadedAsset } from "./AssetPipeline";

export interface PlayerVisualAssetConfig {
  heroUrl?: string;
  lodUrls?: string[];
  scale?: number;
}

export class PlayerVisual {
  readonly group = new THREE.Group();
  private readonly pipeline = new AssetPipeline();
  private readonly config: PlayerVisualAssetConfig;
  private lod: THREE.LOD | null = null;
  private fallback: THREE.Group;
  private loaded = false;

  constructor(primary = 0x1976d2, config: PlayerVisualAssetConfig = {}) {
    this.config = config;
    this.fallback = this.createFallback(primary);
    this.group.add(this.fallback);
    void this.loadProductionAsset();
  }

  private createFallback(primary: number): THREE.Group {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xb9795b, roughness: .75 });
    const kit = new THREE.MeshStandardMaterial({ color: primary, roughness: .65 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.28, .72, 6, 10), kit);
    body.position.y = .85;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), skin);
    head.position.y = 1.55;
    group.add(head);
    for (const x of [-.12, .12]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.08, .65, 4, 8), skin);
      leg.position.set(x, .42, 0);
      group.add(leg);
    }
    return group;
  }

  private async loadProductionAsset(): Promise<void> {
    if (!this.config.heroUrl) return;
    try {
      const hero = await this.pipeline.load(this.config.heroUrl, {
        castShadow: true,
        receiveShadow: true,
        maxAnisotropy: 8
      });
      const levels: THREE.Object3D[] = [hero.scene];
      for (const url of this.config.lodUrls ?? []) {
        const asset = await this.pipeline.load(url, {
          castShadow: true,
          receiveShadow: true,
          maxAnisotropy: 4
        });
        levels.push(asset.scene);
      }
      const prepared = levels.map(level => this.pipeline.prepareScene(level));
      this.lod = this.pipeline.createLOD(prepared, [0, 18, 42]);
      this.lod.scale.setScalar(this.config.scale ?? 1);
      this.group.add(this.lod);
      this.fallback.visible = false;
      this.loaded = true;
    } catch {
      this.loaded = false;
    }
  }

  get isProductionAssetLoaded(): boolean {
    return this.loaded;
  }

  update(p: {x:number;y:number;z:number}, r:number) {
    this.group.position.set(p.x,p.y,p.z);
    this.group.rotation.y=r;
    if (this.lod) this.lod.updateMatrixWorld(true);
  }
}