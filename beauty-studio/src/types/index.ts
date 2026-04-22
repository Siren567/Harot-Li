export type ServiceCategory = 'brows' | 'lashes' | 'extras';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  durationMin: number;
  price: number;
  active: boolean;
  prep?: string;
  aftercare?: string;
}

export type AppointmentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'canceled'
  | 'no_show';

export interface Appointment {
  id: string;
  serviceId: string;
  customerId: string;
  date: string;        // ISO yyyy-MM-dd
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  status: AppointmentStatus;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  notes?: string;
  flagged?: boolean;
  createdAt: string;
}

export interface AvailabilityRule {
  weekday: number;   // 0-6 (Sun-Sat)
  enabled: boolean;
  open: string;      // "09:00"
  close: string;     // "18:00"
  breakStart?: string;
  breakEnd?: string;
}

export interface BlockedTime {
  id: string;
  date: string;
  startTime?: string; // full day if omitted
  endTime?: string;
  reason?: string;
}

export interface BusinessSettings {
  name: string;
  ownerName: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  email: string;
  slotInterval: number;     // minutes
  bufferMin: number;
  leadTimeHours: number;
  requireApproval: boolean;
  cancellationPolicy: string;
  bookingPolicy: string;
  homepageHeadline: string;
  homepageSub: string;
  campaignBanner?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: ServiceCategory;
  featured?: boolean;
  // visual: we'll render gradient tiles as stand-ins
  palette: [string, string];
}

export interface AppNotification {
  id: string;
  kind: 'new_booking' | 'pending' | 'approved' | 'rejected' | 'reminder' | 'reschedule';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Review {
  id: string;
  author: string;
  text: string;
  stars: number;
}

export interface FaqItem {
  q: string;
  a: string;
}
