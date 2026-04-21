export type StudioCategoryId = "bracelets" | "necklaces" | "keychains" | "other";
export type StudioSubcategory = "men" | "women" | "couple" | null;

export type StudioProduct = {
  id: string;
  category: StudioCategoryId;
  subcategory: StudioSubcategory;
  title: string;
  description: string;
  price: number;
  colors: { name: string; swatch: string }[];
};

export const studioCategories = [
  { id: "bracelets", label: "צמידים" },
  { id: "necklaces", label: "שרשראות" },
  { id: "keychains", label: "מחזיקי מפתחות" },
  { id: "other", label: "אחר" }
] as const;

export const studioSubcategories = [
  { id: "men", label: "גברים" },
  { id: "women", label: "נשים" },
  { id: "couple", label: "זוגי" }
] as const;

export const studioProducts: StudioProduct[] = [
  {
    id: "br-men-1",
    category: "bracelets",
    subcategory: "men",
    title: "צמיד פלדה קלאסי לגבר",
    description: "עיצוב גברי נקי עם מקום לחריטה פנימית.",
    price: 189,
    colors: [
      { name: "זהב", swatch: "#d4af37" },
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "שחור", swatch: "#2a2a2a" }
    ]
  },
  {
    id: "br-women-1",
    category: "bracelets",
    subcategory: "women",
    title: "צמיד אלגנט עדין לאישה",
    description: "מראה יוקרתי עם חריטה אישית עדינה.",
    price: 179,
    colors: [
      { name: "רוז גולד", swatch: "#d4a5a0" },
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "זהב", swatch: "#d4af37" }
    ]
  },
  {
    id: "br-couple-1",
    category: "bracelets",
    subcategory: "couple",
    title: "סט צמידים זוגי",
    description: "זוג צמידים תואמים לחריטה של שני שמות.",
    price: 299,
    colors: [
      { name: "זהב", swatch: "#d4af37" },
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "רוז גולד", swatch: "#d4a5a0" }
    ]
  },
  {
    id: "ne-men-1",
    category: "necklaces",
    subcategory: "men",
    title: "שרשרת לוחית לגבר",
    description: "תליון לוחית עם גימור שחור מט.",
    price: 229,
    colors: [
      { name: "שחור", swatch: "#2a2a2a" },
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "זהב", swatch: "#d4af37" }
    ]
  },
  {
    id: "ne-women-1",
    category: "necklaces",
    subcategory: "women",
    title: "שרשרת לב לאישה",
    description: "שרשרת מעודנת עם תליון לב לחריטה.",
    price: 239,
    colors: [
      { name: "רוז גולד", swatch: "#d4a5a0" },
      { name: "זהב", swatch: "#d4af37" },
      { name: "כסף", swatch: "#c0c0c0" }
    ]
  },
  {
    id: "ne-couple-1",
    category: "necklaces",
    subcategory: "couple",
    title: "זוג שרשראות תואמות",
    description: "שתי שרשראות עם חריטה משלימה.",
    price: 339,
    colors: [
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "זהב", swatch: "#d4af37" },
      { name: "רוז גולד", swatch: "#d4a5a0" }
    ]
  },
  {
    id: "ke-1",
    category: "keychains",
    subcategory: null,
    title: "מחזיק מפתחות חריטה",
    description: "מתנה קומפקטית עם משמעות גדולה.",
    price: 119,
    colors: [
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "שחור", swatch: "#2a2a2a" },
      { name: "זהב", swatch: "#d4af37" }
    ]
  },
  {
    id: "ot-1",
    category: "other",
    subcategory: null,
    title: "טבעת מחזיק מיוחדת",
    description: "פריט אישי ייחודי לחריטה קצרה.",
    price: 149,
    colors: [
      { name: "רוז גולד", swatch: "#d4a5a0" },
      { name: "כסף", swatch: "#c0c0c0" },
      { name: "זהב", swatch: "#d4af37" }
    ]
  }
];

export const studioFonts = [
  { id: "heebo", label: "Heebo" },
  { id: "assistant", label: "Assistant" },
  { id: "david", label: "David Libre" },
  { id: "rubik", label: "Rubik" },
  { id: "noto", label: "Noto Sans Hebrew" },
  { id: "alef", label: "Alef" },
  { id: "secular", label: "Secular One" },
  { id: "frank", label: "Frank Ruhl Libre" },
  { id: "varela", label: "Varela Round" }
] as const;

export const studioMaterials = [
  { id: "gold", label: "זהב", color: "#d4af37" },
  { id: "silver", label: "כסף", color: "#c0c0c0" },
  { id: "rose", label: "רוז גולד", color: "#d4a5a0" },
  { id: "black", label: "שחור מט", color: "#2a2a2a" }
] as const;

export const studioShippingMethods = [
  { id: "pickup", label: "איסוף עצמי", fee: 0, eta: "1-3 ימי עסקים", detail: "בתיאום מול הסטודיו" },
  { id: "home", label: "שליח עד הבית", fee: 0, eta: "2-5 ימי עסקים" }
] as const;

export const studioPayments = [
  { id: "card", label: "כרטיס אשראי" },
  { id: "bit", label: "Bit" },
  { id: "paypal", label: "PayPal" }
] as const;
