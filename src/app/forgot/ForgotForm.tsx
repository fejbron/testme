"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginBottom: 12, background: "var(--panel)",
  border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontFamily: "inherit",
};
const button: React.CSSProperties = {
  width: "100%", padding: "11px", background: "var(--accent)", color: "#04110e",
  border: 0, borderRadius: 6, fontWeight: 700, cursor: "pointer",
};

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
    return <p style={{ color: "var(--accent)", fontSize: 14 }}>If an account exists for {email}, a reset link is on its way. Check your inbox.</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <input style={input} type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {err && <p style={{ color: "var(--danger)", fontSize: 13 }}>{err}</p>}
      <button type="submit" disabled={busy} style={button}>{busy ? "…" : "Send reset link"}</button>
    </form>
  );
}
