"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react";
import { AuthNotice } from "@/app/auth/AuthShell";
import styles from "@/app/auth/auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.successPanel}>
        <AuthNotice tone="success">If an account exists for {email}, a reset link is on its way. Check your inbox.</AuthNotice>
        <Link href="/login">Return to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="recovery-email">Email</label>
        <span className={styles.control}><EnvelopeSimple size={18} aria-hidden="true" /><input id="recovery-email" className={styles.input} type="email" autoComplete="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></span>
      </div>
      {err ? <AuthNotice tone="error">{err}</AuthNotice> : null}
      <button type="submit" disabled={busy} className={styles.submit}>{busy ? "Sending link…" : <>Send reset link <ArrowRight size={17} /></>}</button>
    </form>
  );
}
