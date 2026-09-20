"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";

type Variant = "primary" | "danger" | "ghost";

const BASE: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: "10px 16px",
  borderRadius: 7,
  cursor: "pointer",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)" },
  danger: { background: "transparent", color: "var(--danger)", borderColor: "var(--danger)" },
  ghost: { background: "transparent", color: "var(--fg)", borderColor: "var(--border)" },
};

export default function Button({
  variant = "ghost",
  busy,
  children,
  style,
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant; busy?: boolean }) {
  const disabled = Boolean(rest.disabled || busy);
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      {...rest}
      disabled={disabled}
      whileHover={disabled || reduceMotion ? undefined : { y: -1 }}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.98, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {busy ? <CircleNotch className="icon-spin" size={16} aria-label="Working" /> : children}
    </motion.button>
  );
}
