import { useEffect, useState, type FormEvent } from "react";

export type CheckoutFormData = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
};

type CheckoutFormProps = {
  onSubmit: (data: CheckoutFormData) => void | Promise<void>;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckoutForm({ onSubmit, id, className, disabled }: CheckoutFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[mount] CheckoutForm");
    return () => console.log("[unmount] CheckoutForm");
  }, []);

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
    onSubmit({ fullName: n, phone: p, email: e, city: c, address: a });
  }

  return (
    <form id={id} className={className} onSubmit={handleSubmit} noValidate>
      <label>
        שם מלא
        <input name="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label>
        טלפון
        <input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        אימייל
        <input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        עיר
        <input name="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <label>
        כתובת
        <input name="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      {error ? (
        <p role="alert" style={{ color: "#b42318", fontSize: "0.85rem", margin: 0, gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
