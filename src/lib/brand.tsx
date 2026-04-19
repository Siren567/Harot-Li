const DEFAULT = "חרוטלי";

/** Renders the wordmark with accent on the second part when the title ends with "לי". */
export function BrandWordmark({
  title,
  fallback = DEFAULT,
  spanClassName,
}: {
  title?: string | null;
  fallback?: string;
  spanClassName?: string;
}) {
  const full = String(title ?? "").trim() || fallback;
  if (full.endsWith("לי") && full.length > 2) {
    return (
      <>
        {full.slice(0, -2)}
        <span className={spanClassName}>{full.slice(-2)}</span>
      </>
    );
  }
  return <>{full}</>;
}

export function siteTitleSuffix(): string {
  return DEFAULT;
}
