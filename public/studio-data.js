export const STUDIO_STEPS = ["בחירת מוצר", "התאמה אישית", "משלוח ותשלום", "אישור"];
export const PENDANT_SHAPE_OPTIONS = ["heart", "circle", "square", "vertical-rectangle"];

export const PRODUCT_CATEGORIES = [
  {
    id: "necklaces",
    title: "שרשראות",
    useSubcategories: true,
  },
  {
    id: "bracelets",
    title: "צמידים",
    useSubcategories: true,
  },
  {
    id: "keychains",
    title: "מחזיקי מפתחות",
    useSubcategories: false,
  },
  {
    id: "other",
    title: "אחר",
    useSubcategories: false,
  },
];

export const STUDIO_COLOR_SWATCHES = {
  gold: { label: "זהב", hex: "#D4AF37" },
  silver: { label: "כסף", hex: "#C0C0C0" },
  black: { label: "שחור", hex: "#2B2B2B" },
  rose: { label: "רוז גולד", hex: "#B76E79" },
  white: { label: "לבן", hex: "#F7F7F5" },
  beige: { label: "בז׳", hex: "#DCC8AA" },
};

const SWATCH_MAP = Object.fromEntries(
  Object.entries(STUDIO_COLOR_SWATCHES).map(([key, item]) => [key, { color: item.label, swatch: item.hex }])
);

export const STUDIO_VARIANT_BY_KEY = Object.fromEntries(
  Object.entries(STUDIO_COLOR_SWATCHES)
    .filter(([key]) => ["gold", "silver", "black", "rose"].includes(key))
    .map(([key, item]) => [key, { color: item.label, swatch: item.hex }])
);

/**
 * Shared studio props for all product types.
 * Kept separate from each product type schema for maintainability.
 */
export const SHARED_PRODUCT_PROPS = {
  defaults: {
    quantity: 1,
    materialId: "gold",
    fontId: "heebo",
    textSize: 28,
    engravingText: "באהבה גדולה",
    engravingPosition: "center",
    engravingAlign: "center",
  },
  capabilities: {
    allowsEngravingText: true,
    allowsEngravingIcons: true,
    allowsMaterialSelection: true,
    allowsCustomerImageUpload: true,
  },
  optionGroups: {
    materialIds: ["gold", "silver", "black-matte", "rose-gold"],
    fontIds: ["heebo", "serif", "mono", "script", "assistant", "rubik", "david", "arial"],
    sizeIds: ["s", "m", "l"],
  },
};

/**
 * Product-type specific schema (future-proof and normalized).
 * "ring" is included for future use even if the current catalog does not render it yet.
 */
export const PRODUCT_TYPE_SCHEMAS = {
  necklace: {
    typeId: "necklace",
    categoryId: "necklaces",
    displayName: "שרשרת",
    defaultSubcategoryLabel: "שרשראות לגבר",
    defaultVariantKeys: ["silver", "black", "gold"],
    props: {
      ...SHARED_PRODUCT_PROPS,
      capabilities: {
        ...SHARED_PRODUCT_PROPS.capabilities,
        supportsChainLength: true,
        supportsWristSize: false,
        supportsRingSize: false,
      },
    },
  },
  bracelet: {
    typeId: "bracelet",
    categoryId: "bracelets",
    displayName: "צמיד",
    defaultSubcategoryLabel: "צמידים לגבר",
    defaultVariantKeys: ["black", "silver", "gold"],
    props: {
      ...SHARED_PRODUCT_PROPS,
      capabilities: {
        ...SHARED_PRODUCT_PROPS.capabilities,
        supportsChainLength: false,
        supportsWristSize: true,
        supportsRingSize: false,
      },
    },
  },
  ring: {
    typeId: "ring",
    categoryId: "rings",
    displayName: "טבעת",
    defaultSubcategoryLabel: "טבעות",
    defaultVariantKeys: ["silver", "gold", "rose"],
    props: {
      ...SHARED_PRODUCT_PROPS,
      capabilities: {
        ...SHARED_PRODUCT_PROPS.capabilities,
        supportsChainLength: false,
        supportsWristSize: false,
        supportsRingSize: true,
      },
      optionGroups: {
        ...SHARED_PRODUCT_PROPS.optionGroups,
        ringSizes: ["44", "46", "48", "50", "52", "54", "56", "58", "60"],
      },
    },
  },
  keychain: {
    typeId: "keychain",
    categoryId: "keychains",
    displayName: "מחזיק מפתחות",
    defaultSubcategoryLabel: null,
    defaultVariantKeys: ["silver", "black", "gold"],
    props: {
      ...SHARED_PRODUCT_PROPS,
      capabilities: {
        ...SHARED_PRODUCT_PROPS.capabilities,
        supportsChainLength: false,
        supportsWristSize: false,
        supportsRingSize: false,
      },
    },
  },
  other: {
    typeId: "other",
    categoryId: "other",
    displayName: "מוצר מיוחד",
    defaultSubcategoryLabel: null,
    defaultVariantKeys: ["white", "black", "beige"],
    props: {
      ...SHARED_PRODUCT_PROPS,
      capabilities: {
        ...SHARED_PRODUCT_PROPS.capabilities,
        supportsChainLength: false,
        supportsWristSize: false,
        supportsRingSize: false,
      },
    },
  },
};

const IMAGE_BANK = {
  necklacesMen: {
    silver: [
      "https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    black: [
      "https://images.pexels.com/photos/10983785/pexels-photo-10983785.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/9428789/pexels-photo-9428789.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    gold: [
      "https://images.pexels.com/photos/5370706/pexels-photo-5370706.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983783/pexels-photo-10983783.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
  necklacesWomen: {
    gold: [
      "https://images.pexels.com/photos/10983783/pexels-photo-10983783.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/5370706/pexels-photo-5370706.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    rose: [
      "https://images.pexels.com/photos/9428777/pexels-photo-9428777.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983783/pexels-photo-10983783.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    silver: [
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/5370698/pexels-photo-5370698.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/9428777/pexels-photo-9428777.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
  braceletsMen: {
    black: [
      "https://images.pexels.com/photos/9428789/pexels-photo-9428789.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983785/pexels-photo-10983785.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    silver: [
      "https://images.pexels.com/photos/10983785/pexels-photo-10983785.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983790/pexels-photo-10983790.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    gold: [
      "https://images.pexels.com/photos/10983790/pexels-photo-10983790.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/9428789/pexels-photo-9428789.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
  braceletsWomen: {
    gold: [
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/5370698/pexels-photo-5370698.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    rose: [
      "https://images.pexels.com/photos/9428777/pexels-photo-9428777.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    silver: [
      "https://images.pexels.com/photos/5370698/pexels-photo-5370698.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/9428777/pexels-photo-9428777.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
  keychains: {
    silver: [
      "https://images.pexels.com/photos/2079451/pexels-photo-2079451.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    black: [
      "https://images.pexels.com/photos/10983785/pexels-photo-10983785.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/2079451/pexels-photo-2079451.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    gold: [
      "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/585750/pexels-photo-585750.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
  other: {
    white: [
      "https://images.pexels.com/photos/9826127/pexels-photo-9826127.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/6164042/pexels-photo-6164042.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    black: [
      "https://images.pexels.com/photos/585750/pexels-photo-585750.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/9826127/pexels-photo-9826127.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
    beige: [
      "https://images.pexels.com/photos/6164042/pexels-photo-6164042.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
      "https://images.pexels.com/photos/585750/pexels-photo-585750.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    ],
  },
};

function makeVariants(imageSet, variantKeys, offset = 0) {
  return variantKeys.map((key, idx) => {
    const images = imageSet[key] || imageSet.silver || imageSet.gold || Object.values(imageSet)[0];
    return {
      ...SWATCH_MAP[key],
      image: images[(offset + idx) % images.length],
    };
  });
}

/** כל כתובות התמונות לגלריה בתחתית הסטודיו (ללא כפילויות, לפי סדר צבעים). */
function collectGalleryUrls(imageSet, variantKeys) {
  const out = [];
  const seen = new Set();
  for (const k of variantKeys) {
    for (const u of imageSet[k] || []) {
      if (u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

function buildSeries(
  {
    prefix,
    typeId,
    category,
    subcategory,
    titleBase,
    description,
    startPrice,
    imageSet,
    variantKeys,
    pendantShape,
    itemProps = {},
  },
  count = 8
) {
  const schema = PRODUCT_TYPE_SCHEMAS[typeId];
  const normalizedCategoryId = category || schema?.categoryId || "other";
  const normalizedSubcategory = subcategory ?? schema?.defaultSubcategoryLabel ?? null;
  const normalizedVariantKeys = variantKeys || schema?.defaultVariantKeys || ["silver", "gold"];
  const imageUrls = collectGalleryUrls(imageSet, normalizedVariantKeys);
  const studioProps = {
    ...(schema?.props || SHARED_PRODUCT_PROPS),
    ...itemProps,
    defaults: {
      ...(schema?.props?.defaults || SHARED_PRODUCT_PROPS.defaults),
      ...(itemProps.defaults || {}),
    },
    capabilities: {
      ...(schema?.props?.capabilities || SHARED_PRODUCT_PROPS.capabilities),
      ...(itemProps.capabilities || {}),
    },
    optionGroups: {
      ...(schema?.props?.optionGroups || SHARED_PRODUCT_PROPS.optionGroups),
      ...(itemProps.optionGroups || {}),
    },
  };
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}-${idx + 1}`,
    category: normalizedCategoryId,
    subcategory: normalizedSubcategory,
    categoryId: normalizedCategoryId,
    subcategoryLabel: normalizedSubcategory,
    productType: typeId || "other",
    pendantShape: pendantShape || (typeId === "necklace" ? "vertical-rectangle" : null),
    title: `${titleBase} ${idx + 1}`,
    description,
    price: startPrice + (idx % 4) * 15,
    imageUrls,
    variants: makeVariants(imageSet, normalizedVariantKeys, idx),
    studioProps,
    allowCustomerImageUpload: studioProps.capabilities.allowsCustomerImageUpload,
  }));
}

export const PRODUCT_ITEMS = [
  ...buildSeries({
    prefix: "n-men",
    typeId: "necklace",
    category: "necklaces",
    subcategory: "שרשראות לגבר",
    titleBase: "שרשרת גבר קלאסית",
    description: "שרשרת נקייה במראה גברי יוקרתי.",
    startPrice: 189,
    imageSet: IMAGE_BANK.necklacesMen,
    variantKeys: ["silver", "black", "gold"],
    pendantShape: "vertical-rectangle",
  }),
  ...buildSeries({
    prefix: "n-women",
    typeId: "necklace",
    category: "necklaces",
    subcategory: "שרשראות לאישה",
    titleBase: "שרשרת נשית עדינה",
    description: "שרשרת אלגנטית עם נגיעה אישית.",
    startPrice: 199,
    imageSet: IMAGE_BANK.necklacesWomen,
    variantKeys: ["gold", "rose", "silver"],
    pendantShape: "heart",
  }),
  ...buildSeries({
    prefix: "b-men",
    typeId: "bracelet",
    category: "bracelets",
    subcategory: "צמידים לגבר",
    titleBase: "צמיד גבר מינימל",
    description: "צמיד גברי בגימור נקי ומדויק.",
    startPrice: 169,
    imageSet: IMAGE_BANK.braceletsMen,
    variantKeys: ["black", "silver", "gold"],
  }),
  ...buildSeries({
    prefix: "b-women",
    typeId: "bracelet",
    category: "bracelets",
    subcategory: "צמידים לאישה",
    titleBase: "צמיד נשי מעודן",
    description: "צמיד עדין עם אפשרות חריטה אישית.",
    startPrice: 179,
    imageSet: IMAGE_BANK.braceletsWomen,
    variantKeys: ["gold", "rose", "silver"],
  }),
  ...buildSeries({
    prefix: "k",
    typeId: "keychain",
    category: "keychains",
    subcategory: null,
    titleBase: "מחזיק מפתחות חריטה",
    description: "מחזיק קומפקטי בעיצוב אישי.",
    startPrice: 89,
    imageSet: IMAGE_BANK.keychains,
    variantKeys: ["silver", "black", "gold"],
  }),
  ...buildSeries({
    prefix: "o",
    typeId: "other",
    category: "other",
    subcategory: null,
    titleBase: "מתנת חריטה מיוחדת",
    description: "מוצר מתנה ייחודי בקטגוריית אחר.",
    startPrice: 149,
    imageSet: IMAGE_BANK.other,
    variantKeys: ["white", "black", "beige"],
  }).map((item, idx) => ({
    ...item,
    title: idx < 4 ? `סט ספלים ${idx + 1}` : idx < 7 ? `סט סכום ${idx - 3}` : `מוצר חריטה נוסף ${idx - 6}`,
  })),
];

export const FONT_OPTIONS = [
  { id: "heebo", label: "Heebo קלאסי", family: "'Heebo', sans-serif" },
  { id: "serif", label: "אלגנט סריף", family: "'Times New Roman', serif" },
  { id: "mono", label: "מודרני נקי", family: "'Courier New', monospace" },
  { id: "script", label: "כתב רך", family: "'Brush Script MT', cursive" },
  { id: "assistant", label: "Assistant נקי", family: "'Assistant', sans-serif" },
  { id: "rubik", label: "Rubik מודרני", family: "'Rubik', sans-serif" },
  { id: "david", label: "David קלאסי", family: "'David', serif" },
  { id: "arial", label: "Arial נגיש", family: "Arial, sans-serif" },
];

export const MATERIAL_OPTIONS = [
  { id: "gold", label: "זהב", tone: "linear-gradient(150deg, #f2e6b8 0%, #d4af37 42%, #9a7224 100%)" },
  { id: "silver", label: "כסף", tone: "linear-gradient(150deg, #f7f7f7 0%, #c8c8c8 48%, #8e8e8e 100%)" },
  { id: "black-matte", label: "שחור מאט", tone: "linear-gradient(155deg, #3a3a3a 0%, #1a1a1a 55%, #0f0f0f 100%)" },
  { id: "rose-gold", label: "רוז גולד", tone: "linear-gradient(150deg, #fce4e6 0%, #e8b4b8 45%, #b76e79 100%)" },
];

export const SIZE_OPTIONS = [
  { id: "s", label: "קטן", dimensions: "20x12 ס\"מ", multiplier: 1 },
  { id: "m", label: "בינוני", dimensions: "28x18 ס\"מ", multiplier: 1.15 },
  { id: "l", label: "גדול", dimensions: "35x24 ס\"מ", multiplier: 1.35 },
];

export const ICON_OPTIONS = ["❤", "✦", "∞", "☼", "✿", "✶"];

export const SHIPPING_METHODS = [
  { id: "pickup", label: "איסוף עצמי", fee: 0, eta: "תיאום מול הסטודיו" },
  { id: "home", label: "משלוח עד 7 ימי עסקים (חינם)", fee: 0, eta: "חינם" },
];


/** אפשרויות תשלום לתפריט הארנקים (UI דמה בלבד). */
export const PAYMENT_METHOD_OPTIONS = [
  { id: "card", label: "כרטיס אשראי", brand: null },
  { id: "google_pay", label: "Google Pay", brand: "google" },
  { id: "apple_pay", label: "Apple Pay", brand: "apple" },
  { id: "bit", label: "ביט", brand: "bit" },
  { id: "paypal", label: "PayPal", brand: "paypal" },
];
