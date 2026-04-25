import { useEffect, useState } from "react";

type A11yState = {
  largeText: boolean;
  highContrast: boolean;
  underlineLinks: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = "harotli_a11y_state";

function readInitialState(): A11yState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { largeText: false, highContrast: false, underlineLinks: false, reducedMotion: false };
    const parsed = JSON.parse(raw);
    return {
      largeText: Boolean(parsed.largeText),
      highContrast: Boolean(parsed.highContrast),
      underlineLinks: Boolean(parsed.underlineLinks),
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return { largeText: false, highContrast: false, underlineLinks: false, reducedMotion: false };
  }
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<A11yState>(readInitialState);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.a11yLargeText = state.largeText ? "on" : "off";
    root.dataset.a11yHighContrast = state.highContrast ? "on" : "off";
    root.dataset.a11yUnderlineLinks = state.underlineLinks ? "on" : "off";
    root.dataset.a11yReducedMotion = state.reducedMotion ? "on" : "off";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <div className="a11y-widget" dir="rtl">
      <button type="button" className="a11y-widget-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        נגישות
      </button>
      {open ? (
        <div className="a11y-widget-panel" role="dialog" aria-label="הגדרות נגישות">
          <button type="button" onClick={() => setState((s) => ({ ...s, largeText: !s.largeText }))}>
            {state.largeText ? "ביטול טקסט מוגדל" : "טקסט מוגדל"}
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, highContrast: !s.highContrast }))}>
            {state.highContrast ? "ביטול ניגודיות גבוהה" : "ניגודיות גבוהה"}
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, underlineLinks: !s.underlineLinks }))}>
            {state.underlineLinks ? "ביטול הדגשת קישורים" : "הדגשת קישורים"}
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, reducedMotion: !s.reducedMotion }))}>
            {state.reducedMotion ? "הפעלת אנימציות" : "צמצום אנימציות"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
