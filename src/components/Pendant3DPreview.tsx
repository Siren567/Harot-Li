import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  PREVIEW_TEMPLATES,
  resolveFontFamily,
  type PreviewTemplate,
} from "../config/previewTemplates";

export type EngravingLine = {
  text: string;
  fontId: string;
  /** Slider px — the real source of truth. May be shrunk by auto-fit, never grown past this value. */
  size: number;
};

type Pendant3DPreviewProps = {
  template?: PreviewTemplate;
  fallbackImageUrl?: string | null;
  metalColor: string;
  lines: EngravingLine[];
  autoRotate?: boolean;
};

/* ----------------------------- shape builders ----------------------------- */

function buildRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const radius = Math.min(r, hw, hh);
  shape.moveTo(-hw + radius, -hh);
  shape.lineTo(hw - radius, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + radius);
  shape.lineTo(hw, hh - radius);
  shape.quadraticCurveTo(hw, hh, hw - radius, hh);
  shape.lineTo(-hw + radius, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - radius);
  shape.lineTo(-hw, -hh + radius);
  shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);
  return shape;
}

function buildDiscShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const k = 0.5522847498 * radius;
  shape.moveTo(radius, 0);
  shape.bezierCurveTo(radius, k, k, radius, 0, radius);
  shape.bezierCurveTo(-k, radius, -radius, k, -radius, 0);
  shape.bezierCurveTo(-radius, -k, -k, -radius, 0, -radius);
  shape.bezierCurveTo(k, -radius, radius, -k, radius, 0);
  return shape;
}

function buildHeartShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  const sx = w / 2;
  const sy = h / 2;
  shape.moveTo(0, -sy);
  shape.bezierCurveTo(sx * 0.2, -sy * 0.4, sx, -sy * 0.2, sx, sy * 0.35);
  shape.bezierCurveTo(sx, sy * 0.85, sx * 0.35, sy, 0, sy * 0.55);
  shape.bezierCurveTo(-sx * 0.35, sy, -sx, sy * 0.85, -sx, sy * 0.35);
  shape.bezierCurveTo(-sx, -sy * 0.2, -sx * 0.2, -sy * 0.4, 0, -sy);
  return shape;
}

function buildShape(t: PreviewTemplate): THREE.Shape {
  switch (t.shape) {
    case "disc":
      return buildDiscShape(t.width / 2);
    case "heart":
      return buildHeartShape(t.width, t.height);
    case "tag":
    case "bar":
    case "square":
    default:
      return buildRoundedRectShape(t.width, t.height, t.cornerRadius);
  }
}

/* ---------------------------- engraving canvas --------------------------- */

type DrawOpts = {
  canvas: HTMLCanvasElement;
  template: PreviewTemplate;
  lines: EngravingLine[];
  metalColor: string;
};

/** Parse "#rrggbb" / "#rgb" to [r,g,b] in 0-255. Returns mid grey if unparseable. */
function hexToRgb(hex: string): [number, number, number] {
  const s = String(hex || "").trim().replace(/^#/, "");
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    if ([r, g, b].every((v) => Number.isFinite(v))) return [r, g, b];
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    if ([r, g, b].every((v) => Number.isFinite(v))) return [r, g, b];
  }
  return [160, 160, 160];
}

/** Relative luminance (ITU BT.709) in 0-1. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type EngravingPreset = {
  /** Main text fill. */
  ink: string;
  /** Inner edge contrast stroke on top of ink (thin). */
  edge: string;
  /** Offset highlight layer (catches light). */
  highlight: string;
  highlightOffset: number; // as fraction of font size
  /** Offset shadow layer (recessed depth). */
  shadow: string;
  shadowOffset: number;
  /** Anti-alias softening. */
  blur: number;
};

/**
 * Adaptive engraving presets per metal. Dark metals get light engraving,
 * light metals get dark engraving; all share a layered highlight+shadow
 * to sell the recessed-engraving effect.
 */
function getEngravingPreset(metalColor: string): EngravingPreset {
  const lum = luminance(metalColor);

  // Black (or any very dark metal) — light engraving, readability-first.
  if (lum < 0.22) {
    return {
      ink: "rgba(240,238,232,0.92)",
      edge: "rgba(255,255,255,0.35)",
      highlight: "rgba(255,255,255,0.55)",
      highlightOffset: -0.035,
      shadow: "rgba(0,0,0,0.55)",
      shadowOffset: 0.04,
      blur: 0.6,
    };
  }

  // Silver / very light metal — dark engraving with strong shadow to avoid grey-on-grey.
  if (lum > 0.7) {
    return {
      ink: "rgba(28,22,16,0.9)",
      edge: "rgba(0,0,0,0.35)",
      highlight: "rgba(255,255,255,0.7)",
      highlightOffset: -0.04,
      shadow: "rgba(0,0,0,0.45)",
      shadowOffset: 0.045,
      blur: 0.5,
    };
  }

  // Gold / rose / mid-tone metal — dark ink, warm-tinted shadow, subtle highlight.
  // Slightly warmer ink on rose (red-heavy) to stay premium rather than muddy.
  const [r] = hexToRgb(metalColor);
  const roseish = r > 200 && lum < 0.7 && lum > 0.45; // rose gold zone
  return {
    ink: roseish ? "rgba(60,28,24,0.92)" : "rgba(38,22,10,0.9)",
    edge: "rgba(0,0,0,0.3)",
    highlight: "rgba(255,240,215,0.55)",
    highlightOffset: -0.035,
    shadow: "rgba(30,12,4,0.55)",
    shadowOffset: 0.04,
    blur: 0.5,
  };
}

function drawEngraving({ canvas, template, lines, metalColor }: DrawOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Transparent background — this canvas is alpha-blended on top of the metal.
  ctx.clearRect(0, 0, W, H);

  const safeW = W * template.safeArea.x;
  const safeH = H * template.safeArea.y;
  const cleanLines = lines.map((l) => ({ ...l, text: (l.text ?? "").trim() })).filter((l) => l.text);
  if (cleanLines.length === 0) return;

  // Slider-px → canvas-px. Canvas ≈ 1024, pendant renders ≈ 360 CSS px.
  const sliderToCanvas = W / 360;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (template.textRotation) ctx.rotate(template.textRotation);
  ctx.textAlign = template.textAlign === "center" ? "center" : "left";
  ctx.textBaseline = "middle";

  // Per-line font sizes: slider value is the base; only shrink if overflow.
  const perLine = cleanLines.map((line) => {
    const family = resolveFontFamily(line.fontId);
    let fontSize = Math.max(template.minFontSize, line.size) * sliderToCanvas;
    ctx.font = `600 ${fontSize}px ${family}`;
    const measured = ctx.measureText(line.text).width;
    if (measured > safeW) fontSize *= safeW / measured;
    return { ...line, family, fontSize };
  });

  const totalH = perLine.reduce((acc, l) => acc + l.fontSize * 1.22, 0);
  const vScale = totalH > safeH ? safeH / totalH : 1;
  perLine.forEach((l) => (l.fontSize *= vScale));

  const totalBlockH = perLine.reduce((acc, l) => acc + l.fontSize * 1.22, 0);
  let y = -totalBlockH / 2 + perLine[0].fontSize * 0.61;

  const preset = getEngravingPreset(metalColor);

  for (const l of perLine) {
    ctx.font = `600 ${l.fontSize}px ${l.family}`;
    const hOff = l.fontSize * preset.highlightOffset;
    const sOff = l.fontSize * preset.shadowOffset;

    // Layer 1 — recessed shadow (below & right of ink).
    ctx.shadowColor = "transparent";
    ctx.fillStyle = preset.shadow;
    if (preset.blur) ctx.filter = `blur(${preset.blur}px)`;
    ctx.fillText(l.text, 0, y + sOff);
    ctx.filter = "none";

    // Layer 2 — light-catching highlight (above & left of ink).
    ctx.fillStyle = preset.highlight;
    ctx.fillText(l.text, 0, y + hOff);

    // Layer 3 — main ink.
    ctx.fillStyle = preset.ink;
    ctx.fillText(l.text, 0, y);

    // Layer 4 — thin edge contrast stroke for crispness.
    ctx.lineWidth = Math.max(0.75, l.fontSize * 0.018);
    ctx.strokeStyle = preset.edge;
    ctx.strokeText(l.text, 0, y);

    y += l.fontSize * 1.22;
  }
  ctx.restore();
}

async function ensureFontsLoaded(lines: EngravingLine[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all(
      lines.map((l) => {
        const family = resolveFontFamily(l.fontId);
        return (document as unknown as { fonts: FontFaceSet }).fonts.load(`600 24px ${family}`);
      })
    );
    await (document as unknown as { fonts: FontFaceSet }).fonts.ready;
  } catch {
    /* noop — proceed with fallback */
  }
}

/* --------------------------------- component ------------------------------ */

export default function Pendant3DPreview({
  template = PREVIEW_TEMPLATES.disc,
  fallbackImageUrl,
  metalColor,
  lines,
  autoRotate = true,
}: Pendant3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frontMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const backMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const rimMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const engravingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engravingTexRef = useRef<THREE.CanvasTexture | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const templateKey = template.id;

  const linesSignature = useMemo(
    () => JSON.stringify(lines.map((l) => ({ t: l.text, f: l.fontId, s: l.size }))),
    [lines]
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

    const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0, 5.4);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(
      new RoomEnvironment() as unknown as THREE.Scene,
      0.04
    ).texture;

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

    // Build the pendant shape
    const shape = buildShape(template);
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: template.thickness,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      curveSegments: 64,
      steps: 1,
    };
    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bodyGeo.translate(0, 0, -template.thickness / 2);
    bodyGeo.computeVertexNormals();

    const base = new THREE.Color(metalColor);
    const frontMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.24,
      envMapIntensity: 1.2,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: 1.0,
      roughness: 0.18,
      envMapIntensity: 1.3,
    });
    frontMatRef.current = frontMat;
    backMatRef.current = frontMat;
    rimMatRef.current = sideMat;

    // ExtrudeGeometry emits two material groups: 0 = front+back caps, 1 = sides.
    const body = new THREE.Mesh(bodyGeo, [frontMat, sideMat]);

    // Engraving overlay: transparent plane (or shaped plane) just in front of body.
    const engravingCanvas = document.createElement("canvas");
    // Canvas aspect matches shape bounding box so text isn't distorted.
    const longSide = 1024;
    const aspect = template.width / template.height;
    engravingCanvas.width = aspect >= 1 ? longSide : Math.round(longSide * aspect);
    engravingCanvas.height = aspect >= 1 ? Math.round(longSide / aspect) : longSide;
    engravingCanvasRef.current = engravingCanvas;

    const engravingTex = new THREE.CanvasTexture(engravingCanvas);
    engravingTex.colorSpace = THREE.SRGBColorSpace;
    engravingTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    engravingTex.needsUpdate = true;
    engravingTexRef.current = engravingTex;

    const overlayGeo = new THREE.PlaneGeometry(template.width * 0.98, template.height * 0.98);
    const overlayMat = new THREE.MeshBasicMaterial({
      map: engravingTex,
      transparent: true,
      depthWrite: false,
    });
    const overlay = new THREE.Mesh(overlayGeo, overlayMat);
    overlay.position.z = template.thickness / 2 + 0.002;

    const pendant = new THREE.Group();
    pendant.add(body, overlay);

    // Bail (small ring at top) for necklaces / keychains
    if (template.hasBail) {
      const bailRadius = 0.13;
      const bailGeo = new THREE.TorusGeometry(bailRadius, 0.034, 20, 48);
      const bail = new THREE.Mesh(bailGeo, sideMat);
      bail.position.set(0, template.height / 2 + bailRadius - 0.02, 0);
      pendant.add(bail);
    }

    scene.add(pendant);

    // Controls
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
      bodyGeo.dispose();
      overlayGeo.dispose();
      overlayMat.dispose();
      frontMat.dispose();
      sideMat.dispose();
      engravingTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
      frontMatRef.current = null;
      backMatRef.current = null;
      rimMatRef.current = null;
      engravingCanvasRef.current = null;
      engravingTexRef.current = null;
    };
    // Rebuild when the template changes (shape swap).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, autoRotate]);

  // React to metal color changes
  useEffect(() => {
    const c = new THREE.Color(metalColor);
    [frontMatRef, rimMatRef].forEach((ref) => {
      if (ref.current) {
        ref.current.color.copy(c);
        ref.current.needsUpdate = true;
      }
    });
  }, [metalColor]);

  // React to text / font / size changes (debounced through React batching)
  useEffect(() => {
    let cancelled = false;
    const canvas = engravingCanvasRef.current;
    const tex = engravingTexRef.current;
    if (!canvas || !tex) return;

    (async () => {
      await ensureFontsLoaded(lines);
      if (cancelled) return;
      const c = engravingCanvasRef.current;
      const t = engravingTexRef.current;
      if (!c || !t) return;
      drawEngraving({ canvas: c, template, lines, metalColor });
      t.needsUpdate = true;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesSignature, templateKey, metalColor]);

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
                <span
                  className="studio-three-flat-text"
                  style={{ fontFamily: resolveFontFamily(lines[0]?.fontId) }}
                >
                  {lines.map((l) => l.text.trim()).filter(Boolean).join("\n")}
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
