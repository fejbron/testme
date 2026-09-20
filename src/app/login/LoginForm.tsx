"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, EnvelopeSimple, Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { AuthNotice } from "@/app/auth/AuthShell";
import styles from "@/app/auth/auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field} htmlFor="login-email">
        <span className={styles.label}>Email</span>
        <span className={styles.control}>
          <EnvelopeSimple size={18} aria-hidden="true" />
          <input id="login-email" className={styles.input} type="email" autoComplete="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </span>
      </label>
      <label className={styles.field} htmlFor="login-password">
        <span className={styles.label}>Password</span>
        <span className={styles.control}>
          <LockKey size={18} aria-hidden="true" />
          <input id="login-password" className={styles.input} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className={styles.reveal} type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {err ? <AuthNotice tone="error">{err}</AuthNotice> : null}
      <button type="submit" disabled={busy} className={styles.submit}>
        {busy ? "Signing in…" : <>Sign in <ArrowRight size={17} /></>}
      </button>
    </form>
  );
}
