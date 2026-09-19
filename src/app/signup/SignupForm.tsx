"use client";
import { useState } from "react";
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

export default function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");
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
      // Email confirmation disabled — the user is signed in immediately.
      router.refresh();
      router.push("/dashboard");
    } else {
      setNotice("Account created. Check your email to confirm, then sign in.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input style={input} type="text" placeholder="display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input style={input} type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input style={input} type="password" placeholder="password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <input style={input} type="password" placeholder="confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      {err && <p style={{ color: "var(--danger)", fontSize: 13 }}>{err}</p>}
      {notice && <p style={{ color: "var(--accent)", fontSize: 13 }}>{notice}</p>}
      <button type="submit" disabled={busy} style={button}>{busy ? "…" : "Create account"}</button>
    </form>
  );
}
