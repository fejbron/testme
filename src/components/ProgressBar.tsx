"use client";

import { motion, useReducedMotion } from "motion/react";

export default function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const reduceMotion = useReducedMotion();
  return (
    <div className="progress">
      {label && <div className="progress__label">{label}</div>}
      <div className="progress__track">
        <motion.div
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="progress__fill"
        />
      </div>
    </div>
  );
}
