import { statusLabel } from '../data/mockData';
import type { AppointmentStatus } from '../types';

const map: Record<AppointmentStatus, string> = {
  pending: 'badge badge-pending',
  approved: 'badge badge-approved',
  rejected: 'badge badge-rejected',
  completed: 'badge badge-completed',
  canceled: 'badge badge-canceled',
  no_show: 'badge badge-noshow',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={map[status]}>{statusLabel[status]}</span>;
}
