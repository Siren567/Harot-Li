import { memo, useState, type FormEvent } from "react";

export type PaymentMethod = "cash" | "payplus";

export type CheckoutFormData = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  floor: string;
  apartment: string;
  zipCode: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

type CheckoutFormProps = {
  onSubmit: (data: CheckoutFormData) => void | Promise<void>;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CheckoutForm({ onSubmit, id, className, disabled }: CheckoutFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const n = fullName.trim();
    const p = phone.trim();
    const e = email.trim().toLowerCase();
    const c = city.trim();
    const a = address.trim();
    if (!n || !p || !e) {
      setError("נא למלא שם מלא, טלפון ואימייל");
      return;
    }
    if (!EMAIL_RE.test(e)) {
      setError("כתובת אימייל אינה תקינה");
      return;
    }
    setError(null);
    onSubmit({
      fullName: n,
      phone: p,
      email: e,
      city: c,
      address: a,
      floor: floor.trim(),
      apartment: apartment.trim(),
      zipCode: zipCode.trim(),
      notes: notes.trim(),
      paymentMethod,
    });
  }

  return (
    <form id={id} className={className} onSubmit={handleSubmit} noValidate>
      <label>
        שם מלא
        <input name="fullName" autoComplete="name" value={fullName} onChange={(ev) => setFullName(ev.target.value)} />
      </label>
      <label>
        טלפון
        <input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} />
      </label>
      <label>
        אימייל
        <input name="email" type="email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
      </label>
      <label>
        עיר
        <input name="city" autoComplete="address-level2" value={city} onChange={(ev) => setCity(ev.target.value)} />
      </label>
      <label>
        כתובת
        <input name="address" autoComplete="street-address" value={address} onChange={(ev) => setAddress(ev.target.value)} />
      </label>
      <div className="studio-checkout-form-address-row">
        <label>
          קומה
          <input name="floor" autoComplete="off" value={floor} onChange={(ev) => setFloor(ev.target.value)} />
        </label>
        <label>
          דירה
          <input name="apartment" autoComplete="off" value={apartment} onChange={(ev) => setApartment(ev.target.value)} />
        </label>
        <label>
          מיקוד
          <input name="zipCode" autoComplete="postal-code" value={zipCode} onChange={(ev) => setZipCode(ev.target.value)} />
        </label>
      </div>
      <label className="studio-checkout-form-notes">
        הערות
        <textarea name="notes" rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="הערות נוספות למשלוח או ליצירה" />
      </label>
      <fieldset
        className="studio-checkout-form-payment"
        style={{ gridColumn: "1 / -1", border: "none", padding: 0, margin: 0 }}
      >
        <legend style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>אמצעי תשלום</legend>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {(
            [
              { value: "cash" as const, label: "מזומן", icon: "💵" },
              { value: "payplus" as const, label: "כרטיס אשראי (PayPlus)", icon: "💳" },
            ]
          ).map((opt) => {
            const selected = paymentMethod === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  flex: "1 1 160px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.7rem 0.9rem",
                  borderRadius: 10,
                  border: `1.5px solid ${selected ? "#111" : "#d9d9d9"}`,
                  background: selected ? "#f5f5f5" : "#fff",
                  cursor: "pointer",
                  transition: "border-color .15s ease, background .15s ease",
                  fontSize: "0.95rem",
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setPaymentMethod(opt.value)}
                  style={{ accentColor: "#111" }}
                />
                <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" style={{ color: "#b42318", fontSize: "0.85rem", margin: 0, gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Avoid re-rendering while typing in sibling UI (e.g. coupon field in parent) so inputs keep focus. */
export default memo(CheckoutForm);
