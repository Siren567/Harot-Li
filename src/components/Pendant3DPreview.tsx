import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Pendant3DPreviewProps = {
  modelUrl?: string;
  fallbackImageUrl?: string | null;
  metalColor: string;
  engravingText: string;
  autoRotate?: boolean;
};

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

function drawEngravingCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  invert = false
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  // Base color: white for bump (high = no displacement), black text = displaced inward.
  const base = invert ? "#000000" : "#ffffff";
  const ink = invert ? "#ffffff" : "#1a1a1a";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Soft vignette to concentrate detail at center.
  const safe = clampEngravingText(text);
  if (!safe) return;

  const lines = safe.split("\n");
  const maxLen = Math.max(...lines.map((l) => l.length), 1);
  const fontSize = Math.max(58, Math.min(150, Math.round(260 - maxLen * 10)));
  const lineHeight = Math.round(fontSize * 1.22);
  const blockH = lineHeight * lines.length;
  const startY = Math.round(h * 0.5 - blockH / 2 + lineHeight * 0.55);

  ctx.font = `600 ${fontSize}px "Heebo", "Cormorant Garamond", "Times New Roman", serif`;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // subtle tracking for elegance
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], w * 0.5, startY + i * lineHeight);
  }
}

export default function Pendant3DPreview({
  fallbackImageUrl,
  metalColor,
  engravingText,
  autoRotate = true,
}: Pendant3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frontMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sideMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const backMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bailMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bumpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roughCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bumpTexRef = useRef<THREE.CanvasTexture | null>(null);
  const roughTexRef = useRef<THREE.CanvasTexture | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const normalizedText = useMemo(
    () => clampEngravingText(engravingText),
    [engravingText]
  );

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const isMobile =
      typeof window !== "undefined" && window.innerWidth <= 640;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0, 5.2);

    // Environment reflections (no external HDR needed).
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(
      new RoomEnvironment() as unknown as THREE.Scene,
      0.04
    ).texture;

    // Lighting
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(2.4, 3.2, 3.8);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff0dc, 0.55);
    fill.position.set(-2.8, 1.2, 2.0);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe9c9, 0.5);
    rim.position.set(0, -2.4, -2.6);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8470, 0.28));

    // Engraving textures (bump + roughness) from a shared canvas
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = 1024;
    bumpCanvas.height = 1024;
    bumpCanvasRef.current = bumpCanvas;

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = 1024;
    roughCanvas.height = 1024;
    roughCanvasRef.current = roughCanvas;

    drawEngravingCanvas(bumpCanvas, normalizedText, false);
    drawEngravingCanvas(roughCanvas, normalizedText, true);

    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.colorSpace = THREE.NoColorSpace;
    bumpTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    bumpTex.needsUpdate = true;
    bumpTexRef.current = bumpTex;

    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.colorSpace = THREE.NoColorSpace;
    roughTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    roughTex.needsUpdate = true;
    roughTexRef.current = roughTex;

    // Pendant: circular disc via CylinderGeometry so we get 3 material slots
    // [0] side, [1] top cap (front), [2] bottom cap (back).
    const radius = 1.05;
    const thickness = 0.16;
    const discGeo = new THREE.CylinderGeometry(radius, radius, thickness, 96, 1);
    // Rotate so the flat faces point at camera.
    discGeo.rotateX(Math.PI / 2);

    const base = new THREE.Color(metalColor);

    const frontMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.28,
      bumpMap: bumpTex,
      bumpScale: 0.04,
      roughnessMap: roughTex,
      envMapIntensity: 1.15,
    });
    const backMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.32,
      envMapIntensity: 1.0,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.22,
      envMapIntensity: 1.15,
    });
    frontMatRef.current = frontMat;
    backMatRef.current = backMat;
    sideMatRef.current = sideMat;

    // Cylinder material order: [side, top, bottom]. After rotateX,
    // "top" cap now faces +Z (toward camera) = front.
    const disc = new THREE.Mesh(discGeo, [sideMat, frontMat, backMat]);

    // Polished bevel ring around the edge for a premium rim.
    const rimGeo = new THREE.TorusGeometry(radius - 0.002, 0.055, 24, 128);
    const rimMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.14,
      envMapIntensity: 1.25,
    });
    bailMatRef.current = rimMat; // reuse ref for rim+bail shared tint
    const frontRim = new THREE.Mesh(rimGeo, rimMat);
    frontRim.position.z = thickness / 2 - 0.01;
    const backRim = new THREE.Mesh(rimGeo, rimMat);
    backRim.position.z = -thickness / 2 + 0.01;

    // Bail (small ring at top to hold the chain)
    const bailGeo = new THREE.TorusGeometry(0.14, 0.035, 20, 64);
    const bail = new THREE.Mesh(bailGeo, rimMat);
    bail.position.set(0, radius + 0.11, 0);

    const pendant = new THREE.Group();
    pendant.add(disc, frontRim, backRim, bail);
    pendant.position.y = -0.05;
    scene.add(pendant);

    // Controls: limited drag rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.55;
    controls.minPolarAngle = Math.PI / 2 - 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.35;
    (controls as unknown as { minAzimuthAngle: number }).minAzimuthAngle = -0.7;
    (controls as unknown as { maxAzimuthAngle: number }).maxAzimuthAngle = 0.7;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0, 0);

    // When user drags, stop auto-rotate
    const onStart = () => {
      controls.autoRotate = false;
    };
    (controls as unknown as { addEventListener: (t: string, h: () => void) => void }).addEventListener("start", onStart);

    const resize = () => {
      const w = Math.max(120, mountEl.clientWidth || 1);
      const h = Math.max(120, mountEl.clientHeight || 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mountEl);

    let rafId = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      (controls as unknown as { removeEventListener: (t: string, h: () => void) => void }).removeEventListener("start", onStart);
      controls.dispose();
      pmrem.dispose();
      discGeo.dispose();
      rimGeo.dispose();
      bailGeo.dispose();
      frontMat.dispose();
      backMat.dispose();
      sideMat.dispose();
      rimMat.dispose();
      bumpTex.dispose();
      roughTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate]);

  // React to metal color changes
  useEffect(() => {
    const c = new THREE.Color(metalColor);
    [frontMatRef, backMatRef, sideMatRef, bailMatRef].forEach((ref) => {
      if (ref.current) {
        ref.current.color.copy(c);
        ref.current.needsUpdate = true;
      }
    });
  }, [metalColor]);

  // React to engraving text changes
  useEffect(() => {
    const bc = bumpCanvasRef.current;
    const rc = roughCanvasRef.current;
    const bt = bumpTexRef.current;
    const rt = roughTexRef.current;
    if (!bc || !rc || !bt || !rt) return;
    drawEngravingCanvas(bc, normalizedText, false);
    drawEngravingCanvas(rc, normalizedText, true);
    bt.needsUpdate = true;
    rt.needsUpdate = true;
  }, [normalizedText]);

  return (
    <div className="studio-three-wrap">
      <div ref={mountRef} className="studio-three-canvas-host" />
      {webglFailed ? (
        <div className="studio-three-fallback">
          {fallbackImageUrl ? (
            <img src={fallbackImageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <div
              className="studio-three-flat-pendant"
              style={{ ["--metal" as string]: metalColor }}
              aria-label="תצוגת תליון"
            >
              <div className="studio-three-flat-disc">
                <span className="studio-three-flat-text">
                  {normalizedText || ""}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}
      <div className="studio-three-hint" aria-hidden="true">
        גררו לסיבוב קל
      </div>
    </div>
  );
}
