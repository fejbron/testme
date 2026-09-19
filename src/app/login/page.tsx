import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const runtime = "nodejs";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.role === "STUDENT" ? "/dashboard" : "/instructor");
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "80px 24px" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.18em" }}>▚ TESTME</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 24px" }}>Sign in</h1>
      <LoginForm />
      <div style={{ marginTop: 18, fontSize: 13, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
        <Link href="/signup">Create an account</Link>
        <Link href="/forgot">Forgot password?</Link>
      </div>
    </main>
  );
}
