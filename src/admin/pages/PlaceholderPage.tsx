export function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "3px" }}>{subtitle}</p>}
      </div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "18px",
          color: "var(--muted-foreground)",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        זהו מסך בסיס שנוצר לפי מבנה האדמין הקיים. כאן נוסיף את טבלאות/פילטרים/פעולות בדיוק באותו סטייל כשהנתונים יחוברו.
      </div>
    </div>
  );
}

