import type {
  Service, Appointment, Customer, AvailabilityRule, BlockedTime,
  BusinessSettings, GalleryItem, Review, FaqItem, AppNotification
} from '../types';
import { format, addDays, subDays } from 'date-fns';

const today = new Date();
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

export const seedServices: Service[] = [
  { id: 'srv-brow-design', name: 'עיצוב גבות', category: 'brows', description: 'עיצוב מדויק בהתאמה אישית לתווי פניך, כולל שעווה וצביעה עדינה.', durationMin: 45, price: 180, active: true, prep: 'להגיע ללא איפור באזור הגבות', aftercare: 'להימנע מחשיפה לשמש 24 שעות' },
  { id: 'srv-brow-sort', name: 'סידור גבות', category: 'brows', description: 'תיקון קו הגבה ופינישינג מהיר לשמירה על הצורה.', durationMin: 25, price: 90, active: true },
  { id: 'srv-brow-lift', name: 'הרמת גבות', category: 'brows', description: 'הרמה ומתיחה של שערות הגבה למראה מלא ועוצמתי.', durationMin: 60, price: 280, active: true },
  { id: 'srv-lash-build', name: 'הלחמת ריסים 1:1', category: 'lashes', description: 'הלחמה קלאסית של ריס לריס למראה טבעי ומחמיא.', durationMin: 120, price: 380, active: true, prep: 'להגיע ללא איפור עיניים', aftercare: 'אין להרטיב במים חמים 24 שעות' },
  { id: 'srv-lash-fill', name: 'מילוי ריסים', category: 'lashes', description: 'שמירה על המראה המלא אחרי הלחמה ראשונית.', durationMin: 75, price: 220, active: true },
  { id: 'srv-lash-lift', name: 'הרמת ריסים + צבע', category: 'lashes', description: 'הרמה וצביעה שמעניקות מראה ערני וזוהר.', durationMin: 60, price: 240, active: true },
  { id: 'srv-lash-lam', name: 'למינציה לגבות', category: 'extras', description: 'יישור וסידור מלא של שערות הגבה למראה מסודר לשבועות.', durationMin: 50, price: 250, active: true },
  { id: 'srv-extra-combo', name: 'קומבו: גבות + ריסים', category: 'extras', description: 'חבילה משולבת לחוויה מושלמת בביקור אחד.', durationMin: 150, price: 520, active: true },
];

export const seedCustomers: Customer[] = [
  { id: 'cst-1', fullName: 'נועה לוי', phone: '050-2345678', email: 'noa@example.com', createdAt: iso(subDays(today, 120)) },
  { id: 'cst-2', fullName: 'שירה כהן', phone: '052-9876543', createdAt: iso(subDays(today, 60)), flagged: true, notes: 'אלרגית להדבקה מסוג X' },
  { id: 'cst-3', fullName: 'מאיה בן-דוד', phone: '054-1122334', createdAt: iso(subDays(today, 200)) },
  { id: 'cst-4', fullName: 'טל אביטל', phone: '053-5556677', createdAt: iso(subDays(today, 30)) },
  { id: 'cst-5', fullName: 'רוני גולן', phone: '050-7788990', createdAt: iso(subDays(today, 10)) },
];

export const seedAppointments: Appointment[] = [
  { id: 'apt-1', serviceId: 'srv-brow-design', customerId: 'cst-1', date: iso(today), startTime: '10:00', endTime: '10:45', status: 'approved', createdAt: iso(subDays(today, 5)) },
  { id: 'apt-2', serviceId: 'srv-lash-build', customerId: 'cst-2', date: iso(today), startTime: '12:00', endTime: '14:00', status: 'pending', createdAt: iso(today) },
  { id: 'apt-3', serviceId: 'srv-lash-lift', customerId: 'cst-3', date: iso(today), startTime: '16:00', endTime: '17:00', status: 'approved', createdAt: iso(subDays(today, 2)) },
  { id: 'apt-4', serviceId: 'srv-brow-sort', customerId: 'cst-4', date: iso(addDays(today, 1)), startTime: '09:30', endTime: '09:55', status: 'pending', createdAt: iso(today) },
  { id: 'apt-5', serviceId: 'srv-extra-combo', customerId: 'cst-5', date: iso(addDays(today, 2)), startTime: '11:00', endTime: '13:30', status: 'approved', createdAt: iso(subDays(today, 1)) },
  { id: 'apt-6', serviceId: 'srv-lash-fill', customerId: 'cst-1', date: iso(subDays(today, 10)), startTime: '14:00', endTime: '15:15', status: 'completed', createdAt: iso(subDays(today, 15)) },
  { id: 'apt-7', serviceId: 'srv-brow-lift', customerId: 'cst-3', date: iso(subDays(today, 5)), startTime: '11:00', endTime: '12:00', status: 'completed', createdAt: iso(subDays(today, 10)) },
  { id: 'apt-8', serviceId: 'srv-lash-lam', customerId: 'cst-4', date: iso(subDays(today, 20)), startTime: '10:00', endTime: '10:50', status: 'no_show', createdAt: iso(subDays(today, 25)) },
];

export const seedAvailability: AvailabilityRule[] = [
  { weekday: 0, enabled: true, open: '09:00', close: '19:00' }, // Sun
  { weekday: 1, enabled: true, open: '09:00', close: '19:00' },
  { weekday: 2, enabled: true, open: '09:00', close: '20:00' },
  { weekday: 3, enabled: true, open: '09:00', close: '20:00' },
  { weekday: 4, enabled: true, open: '09:00', close: '15:00' },
  { weekday: 5, enabled: false, open: '09:00', close: '14:00' }, // Fri off
  { weekday: 6, enabled: false, open: '09:00', close: '14:00' }, // Sat off
];

export const seedBlocked: BlockedTime[] = [
  { id: 'blk-1', date: iso(addDays(today, 7)), reason: 'השתלמות מקצועית' },
];

export const seedSettings: BusinessSettings = {
  name: 'Lumière Studio',
  ownerName: 'עדי כהן',
  tagline: 'עיצוב גבות וריסים בסטנדרט פרימיום',
  address: 'רחוב רוטשילד 42, תל אביב',
  phone: '03-5551234',
  whatsapp: '972525551234',
  instagram: 'lumiere.studio',
  email: 'hello@lumiere-studio.co.il',
  slotInterval: 15,
  bufferMin: 10,
  leadTimeHours: 3,
  requireApproval: true,
  cancellationPolicy: 'ניתן לבטל תור עד 24 שעות לפני המועד ללא חיוב. ביטול מאוחר יותר יחויב ב-50% מעלות הטיפול.',
  bookingPolicy: 'על מנת לאשר את התור, אנא הגיעי 5 דקות לפני. איחור של מעל 15 דקות יחייב קביעת מועד חדש.',
  homepageHeadline: 'המראה המושלם מתחיל בפרטים הקטנים',
  homepageSub: 'סטודיו בוטיק לעיצוב גבות וטיפולי ריסים, שם טכניקה מדויקת פוגשת יחס אישי.',
  campaignBanner: '✨ לקוחות חדשות: 10% הנחה על טיפול ראשון',
};

export const seedGallery: GalleryItem[] = [
  { id: 'g-1', title: 'עיצוב גבות קלאסי', category: 'brows', featured: true, palette: ['#E8C9BE', '#B69A84'] },
  { id: 'g-2', title: 'ריסים 1:1', category: 'lashes', featured: true, palette: ['#D9BE95', '#8A6F5A'] },
  { id: 'g-3', title: 'הרמת ריסים', category: 'lashes', palette: ['#F3DCD2', '#E8C9BE'] },
  { id: 'g-4', title: 'למינציה', category: 'brows', palette: ['#EFE1D4', '#B99465'] },
  { id: 'g-5', title: 'קומבו מלא', category: 'extras', featured: true, palette: ['#B69A84', '#3A302B'] },
  { id: 'g-6', title: 'מראה טבעי', category: 'lashes', palette: ['#F6EFE8', '#D9BE95'] },
  { id: 'g-7', title: 'עיצוב אדריכלי', category: 'brows', palette: ['#8A6F5A', '#E8C9BE'] },
  { id: 'g-8', title: 'נפח מקסימלי', category: 'lashes', palette: ['#2C2420', '#B99465'] },
  { id: 'g-9', title: 'טיפוח יומיומי', category: 'extras', palette: ['#EFE1D4', '#FAF5EF'] },
];

export const reviews: Review[] = [
  { id: 'r1', author: 'נ. לוי', stars: 5, text: 'פשוט מושלמת. הגבות יצאו בדיוק כפי שחלמתי, והיחס האישי מרגש. אין כמו עדי.' },
  { id: 'r2', author: 'ש. כהן', stars: 5, text: 'סטודיו מפנק, נקי, ומקצועי. הרגשתי כמו בבית ספא אמיתי. חוזרת שוב ושוב.' },
  { id: 'r3', author: 'ט. אביטל', stars: 5, text: 'עבודה אומנותית ממש. כל פרט מדויק, כל תור מרגיש כמו טיפוח של עצמך.' },
];

export const faq: FaqItem[] = [
  { q: 'כמה זמן הטיפול נמשך?', a: 'תלוי בטיפול: עיצוב גבות כ-45 דקות, הלחמת ריסים עד שעתיים. בסיכום ההזמנה מופיע משך מדויק.' },
  { q: 'איך מגיעים מוכנות לתור?', a: 'רצוי להגיע ללא איפור באזור הטיפול, ובטיפולי ריסים — לא להרטיב את העיניים בשעות שלפני.' },
  { q: 'האם יש מדיניות ביטול?', a: 'ניתן לבטל עד 24 שעות לפני. ביטול מאוחר יותר יחויב ב-50% מעלות הטיפול.' },
  { q: 'מה ההבדל בין הלחמה לבין הרמת ריסים?', a: 'הלחמה מוסיפה ריסים סינתטיים למראה מלא; הרמה מיישרת את הריסים הטבעיים למראה ערני, ללא תוספת.' },
  { q: 'האם צריך מילוי אחרי הלחמה?', a: 'כן, מומלץ מילוי כל 3-4 שבועות לשמירה על המראה.' },
];

export const seedNotifications: AppNotification[] = [
  { id: 'n1', kind: 'pending', title: 'הזמנה חדשה ממתינה לאישור', body: 'שירה כהן · הלחמת ריסים 1:1', createdAt: new Date().toISOString(), read: false },
  { id: 'n2', kind: 'reminder', title: 'תזכורת — תור מחר', body: 'טל אביטל · סידור גבות · 09:30', createdAt: new Date().toISOString(), read: false },
];

export const categoryLabel: Record<string, string> = {
  brows: 'גבות',
  lashes: 'ריסים',
  extras: 'טיפולים נוספים',
};

export const statusLabel: Record<string, string> = {
  pending: 'ממתין לאישור',
  approved: 'מאושר',
  rejected: 'נדחה',
  completed: 'הושלם',
  canceled: 'בוטל',
  no_show: 'לא הגיעה',
};
