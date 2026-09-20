"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChartLineUp, ShieldCheck, SquaresFour, TerminalWindow } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./auth.module.css";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

const accessSteps = [
  { icon: ShieldCheck, title: "Secure platform", detail: "Your account and training record stay protected." },
  { icon: TerminalWindow, title: "Practical access", detail: "Launch hands-on challenges directly in your browser." },
  { icon: ChartLineUp, title: "Real progress", detail: "Return to your campaigns exactly where you left off." },
];

export function AuthNotice({ tone, children }: { tone: "error" | "success" | "waiting"; children: ReactNode }) {
  return (
    <motion.div
      className={`${styles.notice} ${styles[`notice_${tone}`]}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {children}
    </motion.div>
  );
}

export default function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="TestMe home">
          <SquaresFour size={19} weight="fill" aria-hidden="true" />
          <span>testme</span>
        </Link>
        <Link href="/" className={styles.backLink}>Back to home</Link>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.context} aria-label="Platform benefits">
          <div className={styles.contextLead}>
            <span className={styles.contextLabel}>Access protocol</span>
            <p>Train.<br />Practice.<br />Defend.</p>
          </div>
          <ol className={styles.steps}>
            {accessSteps.map(({ icon: Icon, title: stepTitle, detail }, index) => (
              <li key={stepTitle} className={styles.step}>
                <span className={styles.stepMarker}><Icon size={18} aria-hidden="true" /></span>
                <span>
                  <strong>{stepTitle}</strong>
                  <small>{detail}</small>
                </span>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </li>
            ))}
          </ol>
          <p className={styles.contextNote}>Real skills. A safer world.</p>
        </aside>

        <motion.section
          className={styles.panel}
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className={styles.heading}>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
            <span>{description}</span>
          </div>
          {children}
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </motion.section>
      </div>
    </main>
  );
}
