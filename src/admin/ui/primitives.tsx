"use client";

import { Search } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--foreground)" }}>{title}</h1>
        {subtitle ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.6 }}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  padding = 16,
  radius = 14,
}: {
  children: React.ReactNode;
  padding?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: radius,
        padding,
      }}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>{title}</div>
      {subtitle ? (
        <div style={{ marginTop: 2, fontSize: 12, color: "var(--muted-foreground)" }}>{subtitle}</div>
      ) : null}
      <div style={{ marginTop: 12 }}>{children}</div>
    </Card>
  );
}

export function InputGroup({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <div style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-foreground)" }}>{label}</div>
        {required ? <span style={{ color: "var(--destructive)", fontWeight: 900 }}>*</span> : null}
      </div>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: "var(--input)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 12px",
        color: "var(--foreground)",
        outline: "none",
        fontSize: 13,
        ...(props.style ?? {}),
      }}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        background: "var(--input)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 12px",
        color: "var(--foreground)",
        outline: "none",
        fontSize: 13,
        appearance: "none",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        background: "var(--primary)",
        border: "1px solid rgba(201,169,110,0.35)",
        color: "var(--primary-foreground)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 900,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...(props.style ?? {}),
      }}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        background: "var(--input)",
        border: "1px solid var(--border)",
        color: "var(--foreground-secondary)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 900,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...(props.style ?? {}),
      }}
    />
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <Search
        size={16}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }}
      />
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingRight: 38 }} />
    </div>
  );
}

