export type Benefit = {
  icon: string;
  title: string;
  description: string;
};

export type Step = {
  id: number;
  title: string;
  description: string;
};

export type FeaturedProduct = {
  id: string;
  name: string;
  priceFrom: string;
  imageUrl: string;
};

export const navLinks = [
  { label: "דף הבית", href: "#top" },
  { label: "איך זה עובד", href: "#how" },
  { label: "צור קשר", href: "#contact" }
];

export const benefits: Benefit[] = [
  {
    icon: "heart",
    title: "מתנה אישית עם משמעות",
    description: "כל מוצר הופך לזיכרון שנשאר לנצח - שם, תאריך, או מילה שרק אתם מבינים."
  },
  {
    icon: "gem",
    title: "חריטה מדויקת ואיכותית",
    description: "טכנולוגיית חריטה מתקדמת שמבטיחה תוצאה חדה, ברורה ועמידה לאורך שנים."
  },
  {
    icon: "truck",
    title: "משלוח מהיר עד הבית",
    description: "הזמינו היום, תקבלו בקרוב. אריזת מתנה אלגנטית כלולה בכל הזמנה."
  }
];

export const steps: Step[] = [
  {
    id: 1,
    title: "בוחרים מוצר",
    description: "צמיד, תליון או מחזיק מפתחות - מבחר מוקפד לכל רגע מרגש."
  },
  {
    id: 2,
    title: "כותבים חריטה",
    description: "שם, תאריך או משפט אישי - אנחנו חורטים בדיוק מה שחשוב לכם."
  },
  {
    id: 3,
    title: "מקבלים עד הבית",
    description: "אריזה יוקרתית, משלוח מהיר, ומתנה שמוכנה לרגע הגדול."
  }
];

export const examples = [
  "לאמא הכי טובה בעולם",
  "לנצח שלך",
  "12.08.2023",
  "תמיד איתך",
  "אהבה ראשונה ואחרונה"
];

export const featuredProducts: FeaturedProduct[] = [
  {
    id: "1",
    name: "שרשרת עם חריטה אישית",
    priceFrom: "₪149",
    imageUrl: "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=540&fit=crop"
  },
  {
    id: "2",
    name: "צמיד מתכת קלאסי",
    priceFrom: "₪129",
    imageUrl: "https://images.pexels.com/photos/1927259/pexels-photo-1927259.jpeg?auto=compress&cs=tinysrgb&w=900&h=540&fit=crop"
  },
  {
    id: "3",
    name: "מחזיק מפתחות עם הקדשה",
    priceFrom: "₪99",
    imageUrl: "https://images.pexels.com/photos/1457801/pexels-photo-1457801.jpeg?auto=compress&cs=tinysrgb&w=900&h=540&fit=crop"
  }
];
