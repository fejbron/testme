"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { AuthNotice } from "@/app/auth/AuthShell";
import { validatePasswordPair } from "@/app/auth/auth-ui";
import styles from "@/app/auth/auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const validationError = validatePasswordPair(password, confirm);
    if (validationError) return setErr(validationError);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
    router.push("/dashboard");
  }

  if (!ready) {
    return <AuthNotice tone="waiting">Open this page from the reset link in your email. Waiting for a valid reset session…</AuthNotice>;
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field} htmlFor="reset-password">
        <span className={styles.label}>New password</span>
        <span className={styles.fieldHint}>Minimum 8 characters</span>
        <span className={styles.control}>
          <LockKey size={18} aria-hidden="true" />
          <input id="reset-password" className={styles.input} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Create a secure password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className={styles.reveal} type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide passwords" : "Show passwords"}>{showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      <label className={styles.field} htmlFor="reset-confirm">
        <span className={styles.label}>Confirm new password</span>
        <span className={styles.control}><LockKey size={18} aria-hidden="true" /><input id="reset-confirm" className={styles.input} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></span>
      </label>
      {err ? <AuthNotice tone="error">{err}</AuthNotice> : null}
      <button type="submit" disabled={busy} className={styles.submit}>{busy ? "Updating password…" : <>Set new password <ArrowRight size={17} /></>}</button>
    </form>
  );
}
