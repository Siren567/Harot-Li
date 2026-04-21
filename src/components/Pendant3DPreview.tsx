import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** Resolved OrbitControls + dolly props (TS can widen `new OrbitControls()` to base Controls). */
type StudioOrbitControls = OrbitControls & {
  target: THREE.Vector3;
  zoomSpeed: number;
  minDistance: number;
  maxDistance: number;
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

/** Half of the symmetric `buildHeartShape` heart, split on the vertical center line (x = 0). */
function buildHalfHeartShape(side: -1 | 1, w: number, h: number): THREE.Shape {
  const sx = w / 2;
  const sy = h / 2;
  const shape = new THREE.Shape();
  if (side === -1) {
    shape.moveTo(0, -sy);
    shape.bezierCurveTo(-sx * 0.2, -sy * 0.4, -sx, -sy * 0.2, -sx, sy * 0.35);
    shape.bezierCurveTo(-sx, sy * 0.85, -sx * 0.35, sy, 0, sy * 0.55);
    shape.lineTo(0, -sy);
  } else {
    shape.moveTo(0, sy * 0.55);
    shape.bezierCurveTo(sx * 0.35, sy, sx, sy * 0.85, sx, sy * 0.35);
    shape.bezierCurveTo(sx, -sy * 0.2, sx * 0.2, -sy * 0.4, 0, -sy);
    shape.lineTo(0, sy * 0.55);
  }
  return shape;
}

/** One classic jigsaw piece: flat body + rounded tab on top + side “blanks” (inward semicircular notches). */
function buildPuzzlePieceShape(w: number, h: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const c = Math.min(w, h) * 0.065;
  /** Tab radius — a bit rounder / fuller like physical puzzle charms. */
  let tr = Math.min(w, h) * 0.235;
  tr = Math.min(tr, Math.max(0.11, hw - c - 0.035));
  const bodyTop = hh - tr;
  const bodyBottom = -hh;
  const yMid = (bodyTop + bodyBottom) * 0.5;
  const bodyH = bodyTop - bodyBottom;
  /** Half-height of each side notch — slightly taller for clearer “classic” puzzle silhouette. */
  let nHalf = Math.min(h * 0.115, bodyH * 0.175);
  /** Notch depth — deeper bite reads closer to interlocking product photos. */
  const nDep = Math.min(w, h) * 0.148;
  const margin = c + 0.04;
  nHalf = Math.min(nHalf, (yMid - (bodyBottom + margin)) * 0.92, (bodyTop - margin - yMid) * 0.92);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + c, bodyBottom);
  shape.lineTo(hw - c, bodyBottom);
  shape.quadraticCurveTo(hw, bodyBottom, hw, bodyBottom + c);
  shape.lineTo(hw, yMid - nHalf);
  shape.quadraticCurveTo(hw - nDep, yMid, hw, yMid + nHalf);
  shape.lineTo(hw, bodyTop - c);
  shape.quadraticCurveTo(hw, bodyTop, hw - c, bodyTop);
  if (hw - c > tr + 1e-4) shape.lineTo(tr, bodyTop);
  shape.absarc(0, bodyTop, tr, 0, Math.PI, false);
  if (-hw + c < -tr - 1e-4) shape.lineTo(-hw + c, bodyTop);
  shape.quadraticCurveTo(-hw, bodyTop, -hw, bodyTop - c);
  shape.lineTo(-hw, yMid + nHalf);
  shape.quadraticCurveTo(-hw + nDep, yMid, -hw, yMid - nHalf);
  shape.lineTo(-hw, bodyBottom + c);
  shape.quadraticCurveTo(-hw, bodyBottom, -hw + c, bodyBottom);
  return shape;
}

function buildShape(t: PreviewTemplate): THREE.Shape {
  switch (t.shape) {
    case "disc":
      return buildDiscShape(t.width / 2);
    case "heart":
      return buildHeartShape(t.width, t.height);
    case "puzzle":
      return buildPuzzlePieceShape(t.width, t.height);
    case "splitHeart":
      return buildHalfHeartShape(-1, t.width, t.height);
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
function getEngravingPreset(metalColor: string, template?: PreviewTemplate): EngravingPreset {
  const lum = luminance(metalColor);

  // Black (or any very dark metal) — light engraving, readability-first.
  if (lum < 0.22) {
    const puzzle = template?.shape === "puzzle";
    return {
      ink: puzzle ? "rgba(252,250,255,0.96)" : "rgba(240,238,232,0.92)",
      edge: puzzle ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.35)",
      highlight: puzzle ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.55)",
      highlightOffset: puzzle ? -0.03 : -0.035,
      shadow: puzzle ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.55)",
      shadowOffset: puzzle ? 0.035 : 0.04,
      blur: puzzle ? 0.45 : 0.6,
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

  // Slider-px → canvas-px. Canvas long side ≈ 1024, pendant renders ≈ 360 CSS px.
  const longCanvasSide = Math.max(W, H);
  const sliderToCanvas = longCanvasSide / 360;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.direction = "rtl";
  if (template.textRotation) ctx.rotate(template.textRotation);
  ctx.textAlign = template.textAlign === "center" ? "center" : "left";
  ctx.textBaseline = "middle";

  const fontWeight =
    template.shape === "puzzle" && luminance(metalColor) < 0.28 ? "500" : "600";
  const preset = getEngravingPreset(metalColor, template);

  // Per-line font sizes: slider value is the base; only shrink if overflow.
  const perLine = cleanLines.map((line) => {
    const family = resolveFontFamily(line.fontId);
    let fontSize = Math.max(template.minFontSize, line.size) * sliderToCanvas;
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    const measured = ctx.measureText(line.text).width;
    if (measured > safeW) fontSize *= safeW / measured;
    return { ...line, family, fontSize };
  });

  const totalH = perLine.reduce((acc, l) => acc + l.fontSize * 1.22, 0);
  const vScale = totalH > safeH ? safeH / totalH : 1;
  perLine.forEach((l) => (l.fontSize *= vScale));

  const totalBlockH = perLine.reduce((acc, l) => acc + l.fontSize * 1.22, 0);
  let y = -totalBlockH / 2 + perLine[0].fontSize * 0.61;

  for (const l of perLine) {
    ctx.font = `${fontWeight} ${l.fontSize}px ${l.family}`;
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

type DrawHalfOpts = {
  canvas: HTMLCanvasElement;
  template: PreviewTemplate;
  line: EngravingLine;
  metalColor: string;
};

/** Single engraving line centered on a half-heart texture. */
function drawEngravingSingleOnHalf({ canvas, template, line, metalColor }: DrawHalfOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const text = (line.text ?? "").trim();
  if (!text) return;

  const safeW = W * template.safeArea.x;
  const safeH = H * template.safeArea.y;
  const longCanvasSide = Math.max(W, H);
  const sliderToCanvas = longCanvasSide / 360;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.direction = "rtl";
  if (template.textRotation) ctx.rotate(template.textRotation);
  ctx.textAlign = template.textAlign === "center" ? "center" : "left";
  ctx.textBaseline = "middle";

  const family = resolveFontFamily(line.fontId);
  let fontSize =
    Math.max(template.minFontSize, Math.min(template.maxFontSize, line.size || template.defaultFontSize)) * sliderToCanvas;
  ctx.font = `600 ${fontSize}px ${family}`;
  let measured = ctx.measureText(text).width;
  if (measured > safeW) fontSize *= safeW / measured;
  ctx.font = `600 ${fontSize}px ${family}`;
  measured = ctx.measureText(text).width;
  if (measured > safeW) fontSize *= safeW / measured;
  const lineH = fontSize * 1.2;
  if (lineH > safeH) fontSize *= safeH / lineH;
  ctx.font = `600 ${fontSize}px ${family}`;

  const y = 0;
  const preset = getEngravingPreset(metalColor, template);
  const hOff = fontSize * preset.highlightOffset;
  const sOff = fontSize * preset.shadowOffset;

  ctx.shadowColor = "transparent";
  ctx.fillStyle = preset.shadow;
  if (preset.blur) ctx.filter = `blur(${preset.blur}px)`;
  ctx.fillText(text, 0, y + sOff);
  ctx.filter = "none";
  ctx.fillStyle = preset.highlight;
  ctx.fillText(text, 0, y + hOff);
  ctx.fillStyle = preset.ink;
  ctx.fillText(text, 0, y);
  ctx.lineWidth = Math.max(0.75, fontSize * 0.018);
  ctx.strokeStyle = preset.edge;
  ctx.strokeText(text, 0, y);
  ctx.restore();
}

/** FontFaceSet.load expects a single family name, not a full CSS stack. */
function primaryFamilyForLoading(cssStack: string): string {
  const s = String(cssStack ?? "").trim();
  const quoted = s.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  const first = s.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "sans-serif";
  return first || "sans-serif";
}

async function ensureFontsLoaded(lines: EngravingLine[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all(
      lines.map((l) => {
        const family = resolveFontFamily(l.fontId);
        const loadName = primaryFamilyForLoading(family);
        return (document as unknown as { fonts: FontFaceSet }).fonts.load(`600 24px ${loadName}`);
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
  const engravingCanvasLeftRef = useRef<HTMLCanvasElement | null>(null);
  const engravingCanvasRightRef = useRef<HTMLCanvasElement | null>(null);
  const engravingTexLeftRef = useRef<THREE.CanvasTexture | null>(null);
  const engravingTexRightRef = useRef<THREE.CanvasTexture | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  /** Live OrbitControls + camera for zoom buttons (set in useLayoutEffect). */
  const orbitCtxRef = useRef<{
    controls: StudioOrbitControls;
    camera: THREE.PerspectiveCamera;
    minD: number;
    maxD: number;
  } | null>(null);

  const templateKey = template.id;

  const handleZoomStep = useCallback((closer: boolean) => {
    const ctx = orbitCtxRef.current;
    if (!ctx) return;
    const { controls, camera, minD, maxD } = ctx;
    const target = new THREE.Vector3().copy(controls.target);
    const offset = camera.position.clone().sub(target);
    const dist = offset.length();
    const factor = closer ? 0.9 : 1 / 0.9;
    const newDist = THREE.MathUtils.clamp(dist * factor, minD, maxD);
    offset.setLength(newDist);
    camera.position.copy(target).add(offset);
    controls.update();
  }, []);

  const linesSignature = useMemo(
    () => JSON.stringify(lines.map((l) => ({ t: l.text, f: l.fontId, s: l.size }))),
    [lines]
  );

  useLayoutEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const isPuzzle = template.shape === "puzzle";

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
    renderer.toneMappingExposure = isPuzzle ? 0.98 : 1.05;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    // Puzzle: pull back + tiny vertical bias so tab, bail, and side notches stay in frame like product shots.
    const camZ = isPuzzle ? 7.95 : 6.65;
    const camY = isPuzzle ? 0.1 : 0;
    camera.position.set(0, camY, camZ);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(
      new RoomEnvironment() as unknown as THREE.Scene,
      isPuzzle ? 0.035 : 0.04
    ).texture;

    const key = new THREE.DirectionalLight(0xffffff, isPuzzle ? 1.12 : 1.35);
    if (isPuzzle) {
      key.position.set(0.25, 4.6, 5.4);
    } else {
      key.position.set(2.4, 3.2, 3.8);
    }
    scene.add(key);
    const fill = new THREE.DirectionalLight(isPuzzle ? 0xeef0f4 : 0xfff0dc, isPuzzle ? 0.36 : 0.55);
    fill.position.set(isPuzzle ? -3.0 : -2.8, isPuzzle ? 2.2 : 1.2, isPuzzle ? 1.4 : 2.0);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(isPuzzle ? 0xd8dce2 : 0xffe9c9, isPuzzle ? 0.32 : 0.5);
    rim.position.set(0.15, isPuzzle ? -2.6 : -2.4, isPuzzle ? -2.0 : -2.6);
    scene.add(rim);
    scene.add(
      new THREE.HemisphereLight(
        isPuzzle ? 0xf4f2f0 : 0xffffff,
        isPuzzle ? 0x5c5855 : 0x9a8470,
        isPuzzle ? 0.2 : 0.28
      )
    );

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: template.thickness,
      bevelEnabled: true,
      bevelSegments: isPuzzle ? 3 : 4,
      bevelSize: isPuzzle ? 0.022 : 0.035,
      bevelThickness: isPuzzle ? 0.022 : 0.035,
      curveSegments: isPuzzle ? 80 : 64,
      steps: 1,
    };

    const base = new THREE.Color(metalColor);
    const frontMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: isPuzzle ? 0.93 : 1.0,
      roughness: isPuzzle ? 0.38 : 0.24,
      envMapIntensity: isPuzzle ? 1.02 : 1.2,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: base.clone(),
      metalness: isPuzzle ? 0.94 : 1.0,
      roughness: isPuzzle ? 0.32 : 0.18,
      envMapIntensity: isPuzzle ? 1.08 : 1.3,
    });
    frontMatRef.current = frontMat;
    backMatRef.current = frontMat;
    rimMatRef.current = sideMat;

    const splitMode = template.shape === "splitHeart";
    let bodyGeo: THREE.ExtrudeGeometry | null = null;
    let overlayGeo: THREE.PlaneGeometry | null = null;
    let overlayMat: THREE.MeshBasicMaterial | null = null;
    let engravingTex: THREE.CanvasTexture | null = null;
    let leftBodyGeo: THREE.ExtrudeGeometry | null = null;
    let rightBodyGeo: THREE.ExtrudeGeometry | null = null;
    let leftOverlayGeo: THREE.PlaneGeometry | null = null;
    let rightOverlayGeo: THREE.PlaneGeometry | null = null;
    let leftOverlayMat: THREE.MeshBasicMaterial | null = null;
    let rightOverlayMat: THREE.MeshBasicMaterial | null = null;
    let leftEngravingTex: THREE.CanvasTexture | null = null;
    let rightEngravingTex: THREE.CanvasTexture | null = null;

    const overlayMatCommon = {
      transparent: true,
      depthWrite: false,
      // Curved pendants (e.g. half-hearts) fight the depth buffer with a flat plane — draw engraving on top.
      depthTest: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    } as const;

    const pendant = new THREE.Group();

    if (splitMode) {
      engravingCanvasRef.current = null;
      engravingTexRef.current = null;

      const sx = template.width / 2;
      const gap = 0.035;
      const leftShape = buildHalfHeartShape(-1, template.width, template.height);
      const rightShape = buildHalfHeartShape(1, template.width, template.height);

      leftBodyGeo = new THREE.ExtrudeGeometry(leftShape, extrudeSettings);
      leftBodyGeo.translate(0, 0, -template.thickness / 2);
      leftBodyGeo.computeVertexNormals();
      rightBodyGeo = new THREE.ExtrudeGeometry(rightShape, extrudeSettings);
      rightBodyGeo.translate(0, 0, -template.thickness / 2);
      rightBodyGeo.computeVertexNormals();

      const leftMesh = new THREE.Mesh(leftBodyGeo, [frontMat, sideMat]);
      const rightMesh = new THREE.Mesh(rightBodyGeo, [frontMat, sideMat]);

      const halfPlateW = sx * 0.95;
      const halfPlateH = template.height * 0.95;
      const longSideHalf = 640;
      const aspectHalf = halfPlateW / halfPlateH;
      const cW = aspectHalf >= 1 ? longSideHalf : Math.round(longSideHalf * aspectHalf);
      const cH = aspectHalf >= 1 ? Math.round(longSideHalf / aspectHalf) : longSideHalf;

      const canvasL = document.createElement("canvas");
      canvasL.width = cW;
      canvasL.height = cH;
      const canvasR = document.createElement("canvas");
      canvasR.width = cW;
      canvasR.height = cH;
      engravingCanvasLeftRef.current = canvasL;
      engravingCanvasRightRef.current = canvasR;

      leftEngravingTex = new THREE.CanvasTexture(canvasL);
      leftEngravingTex.colorSpace = THREE.SRGBColorSpace;
      leftEngravingTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      leftEngravingTex.needsUpdate = true;
      engravingTexLeftRef.current = leftEngravingTex;

      rightEngravingTex = new THREE.CanvasTexture(canvasR);
      rightEngravingTex.colorSpace = THREE.SRGBColorSpace;
      rightEngravingTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      rightEngravingTex.needsUpdate = true;
      engravingTexRightRef.current = rightEngravingTex;

      leftOverlayGeo = new THREE.PlaneGeometry(halfPlateW, halfPlateH);
      leftOverlayMat = new THREE.MeshBasicMaterial({ map: leftEngravingTex, ...overlayMatCommon });
      const leftOverlay = new THREE.Mesh(leftOverlayGeo, leftOverlayMat);
      const engrZ = template.thickness / 2 + 0.055;
      leftOverlay.position.set(-sx / 2, 0, engrZ);
      leftOverlay.renderOrder = 2;

      rightOverlayGeo = new THREE.PlaneGeometry(halfPlateW, halfPlateH);
      rightOverlayMat = new THREE.MeshBasicMaterial({ map: rightEngravingTex, ...overlayMatCommon });
      const rightOverlay = new THREE.Mesh(rightOverlayGeo, rightOverlayMat);
      rightOverlay.position.set(sx / 2, 0, engrZ);
      rightOverlay.renderOrder = 2;

      const leftRoot = new THREE.Group();
      leftRoot.add(leftMesh, leftOverlay);
      leftRoot.position.x = -gap / 2;
      const rightRoot = new THREE.Group();
      rightRoot.add(rightMesh, rightOverlay);
      rightRoot.position.x = gap / 2;

      if (template.hasBail) {
        const bailRadius = 0.11;
        const bailGeo = new THREE.TorusGeometry(bailRadius, 0.028, 16, 40);
        const bailL = new THREE.Mesh(bailGeo, sideMat);
        bailL.position.set(-sx * 0.22, template.height * 0.2 + bailRadius * 0.45, 0);
        leftRoot.add(bailL);
        const bailR = new THREE.Mesh(bailGeo, sideMat);
        bailR.position.set(sx * 0.22, template.height * 0.2 + bailRadius * 0.45, 0);
        rightRoot.add(bailR);
      }

      pendant.add(leftRoot, rightRoot);
    } else {
      const shape = buildShape(template);
      bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      bodyGeo.translate(0, 0, -template.thickness / 2);
      bodyGeo.computeVertexNormals();

      const body = new THREE.Mesh(bodyGeo, [frontMat, sideMat]);

      const engravingCanvas = document.createElement("canvas");
      const longSide = 1024;
      const aspect = template.width / template.height;
      engravingCanvas.width = aspect >= 1 ? longSide : Math.round(longSide * aspect);
      engravingCanvas.height = aspect >= 1 ? Math.round(longSide / aspect) : longSide;
      engravingCanvasRef.current = engravingCanvas;

      engravingTex = new THREE.CanvasTexture(engravingCanvas);
      engravingTex.colorSpace = THREE.SRGBColorSpace;
      engravingTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      engravingTex.needsUpdate = true;
      engravingTexRef.current = engravingTex;

      overlayGeo = new THREE.PlaneGeometry(template.width * 0.98, template.height * 0.98);
      overlayMat = new THREE.MeshBasicMaterial({
        map: engravingTex,
        ...overlayMatCommon,
      });
      const overlay = new THREE.Mesh(overlayGeo, overlayMat);
      overlay.position.z = template.thickness / 2 + 0.055;
      overlay.renderOrder = 2;

      pendant.add(body, overlay);

      if (template.hasBail) {
        const bailRadius = isPuzzle ? 0.1 : 0.13;
        const bailTube = isPuzzle ? 0.021 : 0.034;
        const bailGeo = new THREE.TorusGeometry(bailRadius, bailTube, isPuzzle ? 18 : 20, isPuzzle ? 44 : 48);
        const bail = new THREE.Mesh(bailGeo, sideMat);
        const bailY = template.height / 2 + bailRadius - (isPuzzle ? 0.015 : 0.02);
        bail.position.set(0, bailY, 0);
        pendant.add(bail);
      }

      engravingCanvasLeftRef.current = null;
      engravingCanvasRightRef.current = null;
      engravingTexLeftRef.current = null;
      engravingTexRightRef.current = null;
    }

    scene.add(pendant);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement) as StudioOrbitControls;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = isPuzzle ? 0.52 : 0.58;
    const minZoomDist = isPuzzle ? 6.45 : 5.25;
    const maxZoomDist = isPuzzle ? 13.2 : 11.2;
    controls.minDistance = minZoomDist;
    controls.maxDistance = maxZoomDist;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.55;
    // Let shoppers orbit freely to any viewing angle (no narrow azimuth window).
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI - 0.08;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0, 0);
    const onStart = () => {
      controls.autoRotate = false;
    };
    (controls as unknown as { addEventListener: (t: string, h: () => void) => void }).addEventListener("start", onStart);

    orbitCtxRef.current = { controls, camera, minD: minZoomDist, maxD: maxZoomDist };

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
      orbitCtxRef.current = null;
      controls.dispose();
      pmrem.dispose();
      if (splitMode) {
        leftBodyGeo?.dispose();
        rightBodyGeo?.dispose();
        leftOverlayGeo?.dispose();
        rightOverlayGeo?.dispose();
        leftOverlayMat?.dispose();
        rightOverlayMat?.dispose();
        leftEngravingTex?.dispose();
        rightEngravingTex?.dispose();
        engravingCanvasLeftRef.current = null;
        engravingCanvasRightRef.current = null;
        engravingTexLeftRef.current = null;
        engravingTexRightRef.current = null;
      } else {
        bodyGeo?.dispose();
        overlayGeo?.dispose();
        overlayMat?.dispose();
        engravingTex?.dispose();
        engravingCanvasRef.current = null;
        engravingTexRef.current = null;
      }
      frontMat.dispose();
      sideMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
      frontMatRef.current = null;
      backMatRef.current = null;
      rimMatRef.current = null;
    };
    // Rebuild when the template changes (shape swap). useLayoutEffect so engraving canvases exist
    // before the follow-up useEffect that paints them (avoids missing first-frame text).
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
    const split = template.shape === "splitHeart";
    if (split) {
      const paintSplit = async () => {
        await ensureFontsLoaded(lines);
        if (cancelled) return;
        const leftCanvas = engravingCanvasLeftRef.current;
        const rightCanvas = engravingCanvasRightRef.current;
        const leftTex = engravingTexLeftRef.current;
        const rightTex = engravingTexRightRef.current;
        if (!leftCanvas || !rightCanvas || !leftTex || !rightTex) return;
        const line0 = lines[0] ?? { text: "", fontId: "heebo", size: template.defaultFontSize };
        const line1 = lines[1] ?? { text: "", fontId: line0.fontId, size: line0.size };
        drawEngravingSingleOnHalf({ canvas: leftCanvas, template, line: line0, metalColor });
        drawEngravingSingleOnHalf({ canvas: rightCanvas, template, line: line1, metalColor });
        leftTex.needsUpdate = true;
        rightTex.needsUpdate = true;
      };

      const tryPaint = (attempt: number) => {
        if (cancelled) return;
        const cL = engravingCanvasLeftRef.current;
        const cR = engravingCanvasRightRef.current;
        const tL = engravingTexLeftRef.current;
        const tR = engravingTexRightRef.current;
        if (!cL || !cR || !tL || !tR) {
          if (attempt < 24) requestAnimationFrame(() => tryPaint(attempt + 1));
          return;
        }
        void paintSplit();
      };
      tryPaint(0);

      return () => {
        cancelled = true;
      };
    }

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
  }, [linesSignature, templateKey, metalColor, template.shape]);

  return (
    <div className={`studio-three-wrap${template.shape === "puzzle" ? " studio-three-wrap--puzzle" : ""}`}>
      <div ref={mountRef} className="studio-three-canvas-host" />
      {!webglFailed ? (
        <div className="studio-three-zoom-stack">
          <button
            type="button"
            className="studio-three-zoom-btn"
            aria-label="התקרב לתכשיט"
            title="התקרב"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleZoomStep(true)}
          >
            +
          </button>
          <button
            type="button"
            className="studio-three-zoom-btn"
            aria-label="התרחק מהתכשיט"
            title="התרחק"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleZoomStep(false)}
          >
            −
          </button>
        </div>
      ) : null}
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
                  {template.shape === "splitHeart"
                    ? [lines[0]?.text, lines[1]?.text].map((t) => String(t ?? "").trim()).filter(Boolean).join("\n")
                    : lines.map((l) => l.text.trim()).filter(Boolean).join("\n")}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
