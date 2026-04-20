import { memo, useState, type FormEvent } from "react";

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
