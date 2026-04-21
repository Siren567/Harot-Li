import { useEffect, useMemo, useState } from "react";

type Kind = "success" | "failure" | "cancel";

type OrderStatus = {
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
};

const COPY: Record<Kind, { title: string; body: string; tone: string }> = {
  success: {
    title: "התשלום התקבל",
    body: "תודה! התשלום בוצע בהצלחה. האישור הסופי יעודכן ברגע שנקבל את הדיווח מחברת הסליקה — זה עשוי לקחת מספר שניות.",
    tone: "#0f7a3a",
  },
  failure: {
    title: "התשלום נכשל",
    body: "נראה שהתשלום לא הושלם. באפשרותך לנסות שוב מעמוד הקופה. אם החיוב כבר בוצע — נעדכן את סטטוס ההזמנה ברגע שנקבל אישור.",
    tone: "#b42318",
  },
  cancel: {
    title: "התשלום בוטל",
    body: "התשלום בוטל לפני ההשלמה. ההזמנה נשמרה במערכת ועדיין ניתן להשלים אותה.",
    tone: "#8a5a00",
  },
};

function getApiBase() {
  const metaEnv = (import.meta as any).env ?? {};
  return metaEnv.VITE_API_BASE_URL ?? "";
}

function useQueryParam(name: string) {
  return useMemo(() => new URLSearchParams(window.location.search).get(name), [name]);
}

/**
 * Informational return page shown after PayPlus redirects the customer back.
 * These pages never mark the order as paid — the server-side webhook is the
 * single source of truth. We merely poll the public payment-status endpoint
 * so the user sees the truth the moment it lands.
 */
export default function PayPlusReturnPage({ kind }: { kind: Kind }) {
  const orderId = useQueryParam("orderId");
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const apiBase = getApiBase();

    async function fetchOnce() {
      try {
        const res = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId!)}/payment-status`);
        if (!res.ok) throw new Error("NOT_OK");
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setError("לא ניתן לטעון את סטטוס ההזמנה כעת");
      }
    }

    fetchOnce();
    // Poll a few times so a slightly delayed webhook still updates the UI.
    const interval = window.setInterval(fetchOnce, 3000);
    const stop = window.setTimeout(() => window.clearInterval(interval), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [orderId]);

  const copy = COPY[kind];

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "#f7f7f7",
        fontFamily: "inherit",
      }}
    >
      <section
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: "2rem 1.75rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          textAlign: "right",
        }}
      >
        <h1 style={{ color: copy.tone, margin: 0, fontSize: "1.5rem" }}>{copy.title}</h1>
        <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#333" }}>{copy.body}</p>

        {orderId ? (
          <div style={{ marginTop: "1.25rem", fontSize: "0.95rem", color: "#555" }}>
            <div>
              <strong>מזהה הזמנה:</strong> {status?.orderNumber ?? orderId}
            </div>
            {status ? (
              <>
                <div style={{ marginTop: "0.35rem" }}>
                  <strong>סטטוס תשלום:</strong>{" "}
                  {status.paymentStatus === "paid"
                    ? "שולם"
                    : status.paymentStatus === "failed"
                      ? "נכשל"
                      : status.paymentStatus === "cancelled"
                        ? "בוטל"
                        : "ממתין לתשלום"}
                </div>
                <div style={{ marginTop: "0.35rem" }}>
                  <strong>סכום:</strong> {(status.total / 100).toFixed(2)} ₪
                </div>
              </>
            ) : error ? (
              <div style={{ marginTop: "0.35rem", color: "#b42318" }}>{error}</div>
            ) : (
              <div style={{ marginTop: "0.35rem", color: "#888" }}>טוען סטטוס עדכני…</div>
            )}
          </div>
        ) : (
          <p style={{ color: "#888" }}>חסר מזהה הזמנה בכתובת.</p>
        )}

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href="/"
            style={{
              padding: "0.6rem 1.1rem",
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              textDecoration: "none",
              fontSize: "0.95rem",
            }}
          >
            חזרה לדף הבית
          </a>
          {kind !== "success" ? (
            <a
              href="/studio"
              style={{
                padding: "0.6rem 1.1rem",
                borderRadius: 10,
                background: "#eee",
                color: "#111",
                textDecoration: "none",
                fontSize: "0.95rem",
              }}
            >
              לנסות שוב
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
