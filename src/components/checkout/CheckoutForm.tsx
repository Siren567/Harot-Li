import { memo, useState, type FormEvent } from "react";

export type PaymentMethod = "payplus";

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
  paymentMethod: PaymentMethod;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CheckoutForm({ onSubmit, paymentMethod, id, className, disabled }: CheckoutFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [notes, setNotes] = useState("");
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const n = fullName.trim();
    const p = phone.trim();
    const e = email.trim().toLowerCase();
    const c = city.trim();
    const a = address.trim();
    const nextInvalid: Record<string, boolean> = {
      fullName: !n,
      phone: !p,
      email: !e || !EMAIL_RE.test(e),
      city: !c,
      address: !a,
    };
    setInvalid(nextInvalid);
    if (nextInvalid.fullName || nextInvalid.phone || nextInvalid.email || nextInvalid.city || nextInvalid.address) {
      return;
    }
    setInvalid({});
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
        <input
          name="fullName"
          autoComplete="name"
          placeholder="ישראל ישראלי"
          value={fullName}
          onChange={(ev) => {
            setFullName(ev.target.value);
            setInvalid((prev) => ({ ...prev, fullName: false }));
          }}
          style={invalid.fullName ? { borderColor: "#c9372c", boxShadow: "0 0 0 1px rgba(201,55,44,0.18)" } : undefined}
        />
      </label>
      <label>
        טלפון
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="050-1234567"
          value={phone}
          onChange={(ev) => {
            setPhone(ev.target.value);
            setInvalid((prev) => ({ ...prev, phone: false }));
          }}
          style={invalid.phone ? { borderColor: "#c9372c", boxShadow: "0 0 0 1px rgba(201,55,44,0.18)" } : undefined}
        />
      </label>
      <label>
        אימייל
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="israel@example.com"
          value={email}
          onChange={(ev) => {
            setEmail(ev.target.value);
            setInvalid((prev) => ({ ...prev, email: false }));
          }}
          style={invalid.email ? { borderColor: "#c9372c", boxShadow: "0 0 0 1px rgba(201,55,44,0.18)" } : undefined}
        />
      </label>
      <label>
        עיר
        <input
          name="city"
          autoComplete="address-level2"
          placeholder="תל אביב"
          value={city}
          onChange={(ev) => {
            setCity(ev.target.value);
            setInvalid((prev) => ({ ...prev, city: false }));
          }}
          style={invalid.city ? { borderColor: "#c9372c", boxShadow: "0 0 0 1px rgba(201,55,44,0.18)" } : undefined}
        />
      </label>
      <label>
        כתובת
        <input
          name="address"
          autoComplete="street-address"
          placeholder="דיזינגוף 120, תל אביב"
          value={address}
          onChange={(ev) => {
            setAddress(ev.target.value);
            setInvalid((prev) => ({ ...prev, address: false }));
          }}
          style={invalid.address ? { borderColor: "#c9372c", boxShadow: "0 0 0 1px rgba(201,55,44,0.18)" } : undefined}
        />
      </label>
      <div className="studio-checkout-form-address-row">
        <label>
          קומה
          <input name="floor" autoComplete="off" placeholder="3" value={floor} onChange={(ev) => setFloor(ev.target.value)} />
        </label>
        <label>
          דירה
          <input name="apartment" autoComplete="off" placeholder="12" value={apartment} onChange={(ev) => setApartment(ev.target.value)} />
        </label>
        <label>
          מיקוד
          <input name="zipCode" autoComplete="postal-code" placeholder="אופציונלי" value={zipCode} onChange={(ev) => setZipCode(ev.target.value)} />
        </label>
      </div>
      <label className="studio-checkout-form-notes">
        הערות
        <textarea name="notes" rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="הערות נוספות למשלוח או ליצירה" />
      </label>
    </form>
  );
}

/** Avoid re-rendering while typing in sibling UI (e.g. coupon field in parent) so inputs keep focus. */
export default memo(CheckoutForm);
