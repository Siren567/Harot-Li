declare module "three/examples/jsm/controls/OrbitControls.js" {
  import { Camera } from "three";

  export class OrbitControls {
    constructor(object: Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: { set(x: number, y: number, z: number): void };
    enablePan: boolean;
    enableZoom: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    rotateSpeed: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    update(): void;
    dispose(): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import { Group, LoadingManager } from "three";

  export class GLTFLoader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: { scene: Group }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}

declare module "three/examples/jsm/environments/RoomEnvironment.js" {
  export class RoomEnvironment {
    constructor(renderer?: unknown);
  }
}
