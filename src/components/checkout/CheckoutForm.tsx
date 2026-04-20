import { useState, type FormEvent, type ReactNode } from "react";

export type CheckoutFormData = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
};

type CheckoutFormProps = {
  onSubmit: (data: CheckoutFormData) => void | Promise<void>;
  initialValues?: Partial<CheckoutFormData>;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Optional content rendered inside the inputs column, below the fields. */
  extras?: ReactNode;
  /** Optional content rendered as a sibling to the inputs column (e.g. order summary aside). */
  aside?: ReactNode;
};

const EMPTY: CheckoutFormData = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  address: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckoutForm({
  onSubmit,
  initialValues,
  id,
  className,
  disabled,
  extras,
  aside,
}: CheckoutFormProps) {
  const [form, setForm] = useState<CheckoutFormData>({ ...EMPTY, ...initialValues });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim().toLowerCase();
    const city = form.city.trim();
    const address = form.address.trim();
    if (!fullName || !phone || !email) {
      setError("נא למלא שם מלא, טלפון ואימייל");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("כתובת אימייל אינה תקינה");
      return;
    }
    setError(null);
    onSubmit({ fullName, phone, email, city, address });
  }

  return (
    <form id={id} className={className} onSubmit={handleSubmit} noValidate>
      <div className="studio-checkout-form">
        <label>
          שם מלא
          <input
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          />
        </label>
        <label>
          טלפון
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </label>
        <label>
          אימייל
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label>
          עיר
          <input
            name="city"
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
        </label>
        <label>
          כתובת
          <input
            name="address"
            autoComplete="street-address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </label>
        {error ? (
          <p role="alert" style={{ color: "#b42318", fontSize: "0.85rem", margin: 0 }}>
            {error}
          </p>
        ) : null}
        {extras}
      </div>
      {aside}
    </form>
  );
}
