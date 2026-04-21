import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Pendant3DPreviewProps = {
  modelUrl?: string;
  fallbackImageUrl?: string | null;
  metalColor: string;
  engravingText: string;
  autoRotate?: boolean;
};

const DEFAULT_MODEL_URL = "/models/pendant.glb";

function clampEngravingText(raw: string) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

export default function Pendant3DPreview({
  modelUrl = DEFAULT_MODEL_URL,
  fallbackImageUrl,
  metalColor,
  engravingText,
  autoRotate = true,
}: Pendant3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const normalizedText = useMemo(() => clampEngravingText(engravingText), [engravingText]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    let rafId = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.05, 3.35);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer) as unknown as THREE.Scene, 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(3, 3.6, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.bias = -0.00015;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff5ea, 0.6);
    fill.position.set(-2.6, 1.7, 1.8);
    scene.add(fill);

    const ambient = new THREE.HemisphereLight(0xffffff, 0xb9987d, 0.38);
    scene.add(ambient);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.62;
    controls.minPolarAngle = Math.PI / 2 - 0.33;
    controls.maxPolarAngle = Math.PI / 2 + 0.28;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.45;
    controls.target.set(0, 0, 0);

    const resize = () => {
      const w = Math.max(120, mountEl.clientWidth || 1);
      const h = Math.max(120, mountEl.clientHeight || 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(mountEl);

    const engravingCanvas = document.createElement("canvas");
    engravingCanvas.width = 1024;
    engravingCanvas.height = 1024;
    const engravingCtx = engravingCanvas.getContext("2d");

    const engravingTexture = new THREE.CanvasTexture(engravingCanvas);
    engravingTexture.flipY = false;
    engravingTexture.colorSpace = THREE.SRGBColorSpace;
    engravingTexture.wrapS = THREE.ClampToEdgeWrapping;
    engravingTexture.wrapT = THREE.ClampToEdgeWrapping;
    engravingTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textureRef.current = engravingTexture;

    const pendantMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(metalColor),
      metalness: 1,
      roughness: 0.28,
      map: engravingTexture,
      bumpMap: engravingTexture,
      bumpScale: 0.01,
      envMapIntensity: 1,
    });
    materialRef.current = pendantMaterial;

    const drawEngraving = (textValue: string) => {
      if (!engravingCtx) return;
      const ctx = engravingCtx;
      const w = engravingCanvas.width;
      const h = engravingCanvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      const safeText = clampEngravingText(textValue);
      if (safeText) {
        const lines = safeText.split("\n");
        const maxLen = Math.max(...lines.map((line) => line.length), 1);
        const fontSize = Math.max(44, Math.min(96, Math.round(170 - maxLen * 5.5)));
        const lineHeight = Math.round(fontSize * 1.18);
        const blockHeight = lineHeight * lines.length;
        const startY = Math.round(h * 0.48 - blockHeight / 2 + lineHeight * 0.8);
        ctx.font = `700 ${fontSize}px Heebo, Arial, sans-serif`;
        ctx.fillStyle = "#444444";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = 0; i < lines.length; i += 1) {
          ctx.fillText(lines[i], w * 0.5, startY + i * lineHeight);
        }
      }
      engravingTexture.needsUpdate = true;
    };

    drawEngraving(normalizedText);

    const loader = new GLTFLoader();
    let mounted = true;
    loader.load(
      modelUrl,
      (gltf: { scene: THREE.Group }) => {
        if (!mounted) return;
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        root.position.sub(center);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.75 / maxAxis;
        root.scale.setScalar(scale);
        root.rotation.y = 0.08;

        root.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            obj.material = pendantMaterial;
          }
        });

        scene.add(root);
        setLoadFailed(false);
        setIsLoading(false);
      },
      undefined,
      () => {
        if (!mounted) return;
        setLoadFailed(true);
        setIsLoading(false);
      }
    );

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(render);
    };
    rafId = window.requestAnimationFrame(render);

    return () => {
      mounted = false;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      pmrem.dispose();
      pendantMaterial.dispose();
      engravingTexture.dispose();
      renderer.dispose();
      mountEl.removeChild(renderer.domElement);
    };
  }, [autoRotate, modelUrl]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.color.set(metalColor);
    materialRef.current.needsUpdate = true;
  }, [metalColor]);

  useEffect(() => {
    const texture = textureRef.current;
    const mat = materialRef.current;
    if (!texture || !mat) return;
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const safeText = clampEngravingText(normalizedText);
    if (safeText) {
      const lines = safeText.split("\n");
      const maxLen = Math.max(...lines.map((line) => line.length), 1);
      const fontSize = Math.max(44, Math.min(96, Math.round(170 - maxLen * 5.5)));
      const lineHeight = Math.round(fontSize * 1.18);
      const blockHeight = lineHeight * lines.length;
      const startY = Math.round(canvas.height * 0.48 - blockHeight / 2 + lineHeight * 0.8);
      ctx.font = `700 ${fontSize}px Heebo, Arial, sans-serif`;
      ctx.fillStyle = "#444444";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillText(lines[i], canvas.width * 0.5, startY + i * lineHeight);
      }
    }
    texture.needsUpdate = true;
    mat.needsUpdate = true;
  }, [normalizedText]);

  return (
    <div className="studio-three-wrap">
      <div ref={mountRef} className="studio-three-canvas-host" />
      {isLoading ? <div className="studio-three-overlay">טוען תצוגת תלת מימד...</div> : null}
      {loadFailed ? (
        <div className="studio-three-fallback">
          {fallbackImageUrl ? <img src={fallbackImageUrl} alt="" loading="lazy" decoding="async" /> : <span>תצוגת תלת מימד אינה זמינה כרגע</span>}
        </div>
      ) : null}
    </div>
  );
}
