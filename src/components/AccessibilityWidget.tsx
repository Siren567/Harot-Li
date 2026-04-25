import { useEffect, useState } from "react";

type A11yState = {
  largeText: boolean;
  highContrast: boolean;
  underlineLinks: boolean;
  reducedMotion: boolean;
  readableFont: boolean;
  grayscale: boolean;
  biggerCursor: boolean;
};

const STORAGE_KEY = "harotli_a11y_state";

function readInitialState(): A11yState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { largeText: false, highContrast: false, underlineLinks: false, reducedMotion: false, readableFont: false, grayscale: false, biggerCursor: false };
    const parsed = JSON.parse(raw);
    return {
      largeText: Boolean(parsed.largeText),
      highContrast: Boolean(parsed.highContrast),
      underlineLinks: Boolean(parsed.underlineLinks),
      reducedMotion: Boolean(parsed.reducedMotion),
      readableFont: Boolean(parsed.readableFont),
      grayscale: Boolean(parsed.grayscale),
      biggerCursor: Boolean(parsed.biggerCursor),
    };
  } catch {
    return { largeText: false, highContrast: false, underlineLinks: false, reducedMotion: false, readableFont: false, grayscale: false, biggerCursor: false };
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
    root.dataset.a11yReadableFont = state.readableFont ? "on" : "off";
    root.dataset.a11yGrayscale = state.grayscale ? "on" : "off";
    root.dataset.a11yBiggerCursor = state.biggerCursor ? "on" : "off";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function resetAccessibility() {
    setState({
      largeText: false,
      highContrast: false,
      underlineLinks: false,
      reducedMotion: false,
      readableFont: false,
      grayscale: false,
      biggerCursor: false,
    });
  }

  return (
    <div className="a11y-widget" dir="rtl">
      <button type="button" className="a11y-widget-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden="true" className="a11y-widget-trigger-icon">♿</span>
        <span>נגישות</span>
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
          <button type="button" onClick={() => setState((s) => ({ ...s, readableFont: !s.readableFont }))}>
            {state.readableFont ? "ביטול פונט קריא" : "פונט קריא"}
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, grayscale: !s.grayscale }))}>
            {state.grayscale ? "ביטול גווני אפור" : "גווני אפור"}
          </button>
          <button type="button" onClick={() => setState((s) => ({ ...s, biggerCursor: !s.biggerCursor }))}>
            {state.biggerCursor ? "סמן רגיל" : "סמן גדול"}
          </button>
          <button type="button" onClick={resetAccessibility}>
            איפוס הגדרות נגישות
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            סגור
          </button>
        </div>
      ) : null}
    </div>
  );
}
