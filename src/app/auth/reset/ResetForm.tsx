"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginBottom: 12, background: "var(--panel)",
  border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontFamily: "inherit",
};
const button: React.CSSProperties = {
  width: "100%", padding: "11px", background: "var(--accent)", color: "#04110e",
  border: 0, borderRadius: 6, fontWeight: 700, cursor: "pointer",
};

export default function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link establishes a session (PASSWORD_RECOVERY). Confirm one exists.
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
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
    router.push("/dashboard");
  }

  if (!ready) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>Open this page from the reset link in your email. Waiting for a valid reset session…</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <input style={input} type="password" placeholder="new password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <input style={input} type="password" placeholder="confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      {err && <p style={{ color: "var(--danger)", fontSize: 13 }}>{err}</p>}
      <button type="submit" disabled={busy} style={button}>{busy ? "…" : "Set new password"}</button>
    </form>
  );
}
