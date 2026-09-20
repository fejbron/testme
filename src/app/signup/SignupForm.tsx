"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, EnvelopeSimple, Eye, EyeSlash, LockKey, User } from "@phosphor-icons/react";
import { AuthNotice } from "@/app/auth/AuthShell";
import { validatePasswordPair } from "@/app/auth/auth-ui";
import styles from "@/app/auth/auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    const validationError = validatePasswordPair(password, confirm);
    if (validationError) return setErr(validationError);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data.session) {
      router.refresh();
      router.push("/dashboard");
    } else {
      setNotice("Account created. Check your email to confirm, then sign in.");
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field} htmlFor="signup-name">
        <span className={styles.label}>Display name</span>
        <span className={styles.control}><User size={18} aria-hidden="true" /><input id="signup-name" className={styles.input} type="text" autoComplete="name" placeholder="How should we address you?" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></span>
      </label>
      <label className={styles.field} htmlFor="signup-email">
        <span className={styles.label}>Email</span>
        <span className={styles.control}><EnvelopeSimple size={18} aria-hidden="true" /><input id="signup-email" className={styles.input} type="email" autoComplete="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></span>
      </label>
      <label className={styles.field} htmlFor="signup-password">
        <span className={styles.label}>Password</span>
        <span className={styles.fieldHint}>Minimum 8 characters</span>
        <span className={styles.control}>
          <LockKey size={18} aria-hidden="true" />
          <input id="signup-password" className={styles.input} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Create a secure password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className={styles.reveal} type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide passwords" : "Show passwords"}>{showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      <label className={styles.field} htmlFor="signup-confirm">
        <span className={styles.label}>Confirm password</span>
        <span className={styles.control}><LockKey size={18} aria-hidden="true" /><input id="signup-confirm" className={styles.input} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></span>
      </label>
      {err ? <AuthNotice tone="error">{err}</AuthNotice> : null}
      {notice ? <AuthNotice tone="success">{notice}</AuthNotice> : null}
      <button type="submit" disabled={busy} className={styles.submit}>{busy ? "Creating account…" : <>Create account <ArrowRight size={17} /></>}</button>
    </form>
  );
}
