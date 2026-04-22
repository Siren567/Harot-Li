import type { Appointment, AvailabilityRule, BlockedTime, BusinessSettings, Service } from '../types';
import { parseISO, format, addMinutes, isBefore, differenceInHours } from 'date-fns';

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function fromMin(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function dayAvailability(date: string, rules: AvailabilityRule[]): AvailabilityRule | null {
  const d = parseISO(date);
  const wd = d.getDay();
  const rule = rules.find(r => r.weekday === wd);
  if (!rule || !rule.enabled) return null;
  return rule;
}

export function isDayOpen(date: string, rules: AvailabilityRule[], blocked: BlockedTime[]) {
  const r = dayAvailability(date, rules);
  if (!r) return false;
  const fullBlock = blocked.find(b => b.date === date && !b.startTime);
  if (fullBlock) return false;
  return true;
}

export function generateSlots(
  date: string,
  service: Service,
  rules: AvailabilityRule[],
  appointments: Appointment[],
  blocked: BlockedTime[],
  settings: BusinessSettings
): { time: string; available: boolean }[] {
  const rule = dayAvailability(date, rules);
  if (!rule) return [];
  const fullBlock = blocked.find(b => b.date === date && !b.startTime);
  if (fullBlock) return [];

  const open = toMin(rule.open);
  const close = toMin(rule.close);
  const dur = service.durationMin + settings.bufferMin;
  const step = settings.slotInterval;

  const dayAppts = appointments.filter(
    a => a.date === date && (a.status === 'approved' || a.status === 'pending')
  );
  const dayBlocks = blocked.filter(b => b.date === date && b.startTime && b.endTime);

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const isToday = date === todayStr;

  const slots: { time: string; available: boolean }[] = [];
  for (let t = open; t + service.durationMin <= close; t += step) {
    const sStart = t;
    const sEnd = t + service.durationMin;
    let available = true;

    // break
    if (rule.breakStart && rule.breakEnd) {
      if (overlap(sStart, sEnd, toMin(rule.breakStart), toMin(rule.breakEnd))) available = false;
    }
    // appointment clash (use buffer on existing)
    for (const a of dayAppts) {
      const aS = toMin(a.startTime);
      const aE = toMin(a.endTime) + settings.bufferMin;
      if (overlap(sStart - settings.bufferMin, sEnd, aS, aE)) { available = false; break; }
    }
    // blocked windows
    for (const b of dayBlocks) {
      if (overlap(sStart, sEnd, toMin(b.startTime!), toMin(b.endTime!))) { available = false; break; }
    }
    // lead time for today
    if (isToday) {
      const slotDate = new Date(`${date}T${fromMin(sStart)}:00`);
      if (differenceInHours(slotDate, now) < settings.leadTimeHours) available = false;
    }
    // don't show past slots today
    if (isToday) {
      const slotDate = new Date(`${date}T${fromMin(sStart)}:00`);
      if (isBefore(slotDate, now)) continue;
    }

    slots.push({ time: fromMin(sStart), available });
    void dur;
  }
  return slots;
}

export function addMinutesToTime(time: string, min: number): string {
  const d = new Date(`2000-01-01T${time}:00`);
  return format(addMinutes(d, min), 'HH:mm');
}
