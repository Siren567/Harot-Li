import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          {title && <h3>{title}</h3>}
          <button className="btn-ghost" onClick={onClose} style={{ padding: 6, borderRadius: 8 }} aria-label="סגירה">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
