import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="icon-wrap">{icon ?? <Inbox size={24} />}</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {body && <p className="text-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
