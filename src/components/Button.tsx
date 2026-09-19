"use client";

type Variant = "primary" | "danger" | "ghost";

const BASE: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "opacity 0.15s ease",
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "#04110e", borderColor: "var(--accent)" },
  danger: { background: "transparent", color: "var(--danger)", borderColor: "var(--danger)" },
  ghost: { background: "transparent", color: "var(--fg)", borderColor: "var(--border)" },
};

export default function Button({
  variant = "ghost",
  busy,
  children,
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  const disabled = rest.disabled || busy;
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
