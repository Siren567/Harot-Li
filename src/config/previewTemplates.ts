/**
 * Centralized preview template configuration.
 * One source of truth for: shape, dimensions, text safe area, font bounds,
 * bail (chain loop) presence, default rotation. Keeps Pendant3DPreview
 * purely a renderer — all product-specific rules live here.
 */

export type TemplateShape = "disc" | "tag" | "bar" | "heart" | "square" | "puzzle" | "splitHeart";

/**
 * Canonical pendant-type identifiers used throughout the system (backend + studio + admin).
 * Hebrew labels map 1:1 to these IDs; this is the single source of truth for the four types.
 */
export type PendantTypeId = "heart" | "circle" | "square" | "rectangle" | "puzzle" | "splitHeart";

export const PENDANT_TYPE_IDS: PendantTypeId[] = ["heart", "circle", "square", "rectangle", "puzzle", "splitHeart"];

/** Hebrew display label for each pendant type (used in storefront UI and in admin/cart labels). */
export const PENDANT_TYPE_LABEL_HE: Record<PendantTypeId, string> = {
  heart: "לב",
  circle: "עיגול",
  square: "ריבוע",
  rectangle: "מלבן ארוך",
  puzzle: "פאזל",
  splitHeart: "חצאי לב",
};

/** Reverse lookup: accept Hebrew label, English id, common synonyms — return canonical id or null. */
export function normalizePendantType(raw: string | null | undefined): PendantTypeId | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (
    s.includes("חצאי לב") ||
    s.includes("לב זוגי") ||
    s.includes("לב שבור") ||
    s.includes("split heart") ||
    s.includes("couple heart") ||
    ((s.includes("פאזל") || s.includes("puzzle")) && s.includes("לב"))
  ) {
    return "splitHeart";
  }
  if (s === "heart" || s === "לב") return "heart";
  if (s === "circle" || s === "round" || s === "disc" || s === "עיגול") return "circle";
  if (s === "square" || s === "ריבוע") return "square";
  if (s === "puzzle" || s === "jigsaw" || s === "פאזל" || s.includes("פאזל")) return "puzzle";
  if (s === "rectangle" || s === "rect" || s === "bar" || s === "tag" || s === "מלבן ארוך" || s.includes("מלבן")) return "rectangle";
  return null;
}

export type PreviewTemplate = {
  id: string;
  shape: TemplateShape;
  /** Scene units (roughly pendant diameter for disc, width for others). */
  width: number;
  height: number;
  thickness: number;
  /** Used by rounded rectangles. */
  cornerRadius: number;
  /** Small loop at top for the chain/keyring. */
  hasBail: boolean;
  /**
   * Fraction (0-1) of the bounding box that text is allowed to occupy.
   * Keeps the engraving inside the visible surface.
   */
  safeArea: { x: number; y: number };
  /** Slider-px clamps. The slider value is the real source of truth; auto-fit only shrinks if text overflows. */
  minFontSize: number;
  maxFontSize: number;
  /** Default font-size if no engraving exists yet. */
  defaultFontSize: number;
  /** Default text rotation in radians applied to the engraving canvas. */
  textRotation: number;
  /** Text alignment inside the safe area. */
  textAlign: "center" | "start" | "end";
};

export const PREVIEW_TEMPLATES: Record<string, PreviewTemplate> = {
  disc: {
    id: "disc",
    shape: "disc",
    width: 2.1,
    height: 2.1,
    thickness: 0.16,
    cornerRadius: 0,
    hasBail: true,
    safeArea: { x: 0.72, y: 0.48 },
    minFontSize: 8,
    maxFontSize: 44,
    defaultFontSize: 26,
    textRotation: 0,
    textAlign: "center",
  },
  tag: {
    id: "tag",
    shape: "tag",
    width: 1.55,
    height: 2.25,
    thickness: 0.14,
    cornerRadius: 0.28,
    hasBail: true,
    safeArea: { x: 0.78, y: 0.62 },
    minFontSize: 8,
    maxFontSize: 44,
    defaultFontSize: 26,
    textRotation: 0,
    textAlign: "center",
  },
  /** Tall plate — necklaces / vertical “מלבן ארוך” on a chain. */
  bar: {
    id: "bar",
    shape: "bar",
    width: 0.78,
    height: 2.9,
    thickness: 0.12,
    cornerRadius: 0.18,
    hasBail: false,
    safeArea: { x: 0.78, y: 0.82 },
    minFontSize: 8,
    maxFontSize: 44,
    defaultFontSize: 22,
    textRotation: 0,
    textAlign: "center",
  },
  /** Wide plate — typical bracelet engraving bar (landscape). */
  barBracelet: {
    id: "bar-bracelet",
    shape: "bar",
    width: 2.9,
    height: 0.78,
    thickness: 0.12,
    cornerRadius: 0.18,
    hasBail: false,
    safeArea: { x: 0.86, y: 0.66 },
    minFontSize: 8,
    maxFontSize: 44,
    defaultFontSize: 22,
    textRotation: 0,
    textAlign: "center",
  },
  heart: {
    id: "heart",
    shape: "heart",
    width: 2.0,
    height: 1.9,
    thickness: 0.16,
    cornerRadius: 0,
    hasBail: true,
    safeArea: { x: 0.62, y: 0.44 },
    minFontSize: 8,
    maxFontSize: 40,
    defaultFontSize: 24,
    textRotation: 0,
    textAlign: "center",
  },
  square: {
    id: "square",
    shape: "square",
    width: 1.85,
    height: 1.85,
    thickness: 0.14,
    cornerRadius: 0.22,
    hasBail: true,
    safeArea: { x: 0.78, y: 0.78 },
    minFontSize: 8,
    maxFontSize: 44,
    defaultFontSize: 26,
    textRotation: 0,
    textAlign: "center",
  },
  /** Single jigsaw-style piece (tab on top) — keychains / couples puzzle charms. */
  puzzle: {
    id: "puzzle",
    shape: "puzzle",
    width: 1.75,
    height: 2.15,
    thickness: 0.14,
    cornerRadius: 0,
    hasBail: true,
    safeArea: { x: 0.62, y: 0.42 },
    minFontSize: 8,
    maxFontSize: 40,
    defaultFontSize: 22,
    textRotation: 0,
    textAlign: "center",
  },
  /** Two half-hearts (couple set) — preview uses two engraving lines. */
  splitHeart: {
    id: "split-heart",
    shape: "splitHeart",
    width: 2.05,
    height: 1.92,
    thickness: 0.14,
    cornerRadius: 0,
    hasBail: true,
    safeArea: { x: 0.72, y: 0.55 },
    minFontSize: 8,
    maxFontSize: 40,
    defaultFontSize: 22,
    textRotation: 0,
    textAlign: "center",
  },
};

function normalize(raw: string | null | undefined): string {
  return String(raw ?? "").toLowerCase().trim();
}

type ProductLike = {
  category?: string | null;
  mainCategoryId?: string | null;
  title?: string | null;
  subcategoryLabel?: string | null;
};

function isBraceletCategory(product: ProductLike | null | undefined): boolean {
  if (!product) return false;
  const category = normalize(product.category) || normalize(product.mainCategoryId);
  return category.includes("bracelet") || category.includes("צמיד");
}

function isKeychainCategory(product: ProductLike | null | undefined): boolean {
  if (!product) return false;
  const category = normalize(product.category) || normalize(product.mainCategoryId);
  return category.includes("keychain") || category.includes("מפתח");
}

/** Map a pendant-type id to its rendering template. Single place to change geometry-per-type. */
export function getTemplateForPendantType(type: PendantTypeId, product?: ProductLike | null): PreviewTemplate {
  switch (type) {
    case "heart":
      return PREVIEW_TEMPLATES.heart;
    case "circle":
      return PREVIEW_TEMPLATES.disc;
    case "square":
      return PREVIEW_TEMPLATES.square;
    case "puzzle":
      return PREVIEW_TEMPLATES.puzzle;
    case "splitHeart":
      return PREVIEW_TEMPLATES.splitHeart;
    case "rectangle":
      return isBraceletCategory(product) || isKeychainCategory(product)
        ? PREVIEW_TEMPLATES.barBracelet
        : PREVIEW_TEMPLATES.bar;
    default:
      return PREVIEW_TEMPLATES.disc;
  }
}

/**
 * Map a product to its preview template. Uses category + subcategory hints.
 * Falls back to "disc" — the safest generic pendant shape.
 */
export function getTemplateForProduct(product: ProductLike | null | undefined): PreviewTemplate {
  if (!product) return PREVIEW_TEMPLATES.disc;
  const category = normalize(product.category) || normalize(product.mainCategoryId);
  const label = `${normalize(product.title)} ${normalize(product.subcategoryLabel)}`;

  const splitHeartTitle =
    label.includes("חצאי לב") ||
    label.includes("לב זוגי") ||
    label.includes("לב שבור") ||
    (label.includes("זוגי") && label.includes("לב")) ||
    ((label.includes("פאזל") || label.includes("puzzle")) && label.includes("לב")) ||
    (label.includes("סט") && label.includes("לב") && (label.includes("שרשר") || label.includes("שרשרת")));

  if (
    splitHeartTitle &&
    (category.includes("necklace") ||
      category.includes("שרשר") ||
      category.includes("couple") ||
      category.includes("זוג"))
  ) {
    return PREVIEW_TEMPLATES.splitHeart;
  }

  if (label.includes("לב") || label.includes("heart")) return PREVIEW_TEMPLATES.heart;
  if (
    label.includes("עגול") ||
    label.includes("עיגול") ||
    label.includes("circle") ||
    label.includes("round") ||
    label.includes("disc")
  ) {
    return PREVIEW_TEMPLATES.disc;
  }

  if (category.includes("bracelet") || category.includes("צמיד")) {
    return PREVIEW_TEMPLATES.barBracelet;
  }
  if (category.includes("keychain") || category.includes("מפתח")) {
    if (label.includes("פאזל") || label.includes("puzzle") || label.includes("jigsaw")) return PREVIEW_TEMPLATES.puzzle;
    if (label.includes("תג") || label.includes("dog") || label.includes("דוג")) return PREVIEW_TEMPLATES.tag;
    // Horizontal plate is the common keychain engraving surface.
    return PREVIEW_TEMPLATES.barBracelet;
  }
  if (category.includes("necklace") || category.includes("שרשר")) {
    if (label.includes("דוג") || label.includes("tag") || label.includes("פלטה")) {
      return PREVIEW_TEMPLATES.tag;
    }
    return PREVIEW_TEMPLATES.disc;
  }
  return PREVIEW_TEMPLATES.disc;
}

export const FONT_FAMILY_BY_ID: Record<string, string> = {
  assistant: '"Assistant", sans-serif',
  heebo: '"Heebo", sans-serif',
  david: '"David Libre", serif',
  rubik: '"Rubik", sans-serif',
  noto: '"Noto Sans Hebrew", sans-serif',
  alef: '"Alef", sans-serif',
  secular: '"Secular One", sans-serif',
  frank: '"Frank Ruhl Libre", serif',
  varela: '"Varela Round", sans-serif',
};

export function resolveFontFamily(fontId: string | null | undefined): string {
  if (!fontId) return FONT_FAMILY_BY_ID.heebo;
  return FONT_FAMILY_BY_ID[fontId] ?? FONT_FAMILY_BY_ID.heebo;
}
