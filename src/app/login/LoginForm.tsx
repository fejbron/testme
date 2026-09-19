"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginBottom: 12, background: "var(--panel)",
  border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontFamily: "inherit",
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form onSubmit={onSubmit}>
      <input style={input} type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input style={input} type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <p style={{ color: "var(--danger)", fontSize: 13 }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ width: "100%", padding: "11px", background: "var(--accent)", color: "#04110e", border: 0, borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
        {busy ? "…" : "Sign in"}
      </button>
    </form>
  );
}
