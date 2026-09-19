import Link from "next/link";
import ForgotForm from "./ForgotForm";

export const runtime = "nodejs";

export default function ForgotPage() {
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "80px 24px" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.18em" }}>▚ TESTME</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 8px" }}>Reset password</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Enter your email and we will send a link to set a new password.
      </p>
      <ForgotForm />
      <p style={{ marginTop: 18, fontSize: 13, color: "var(--muted)" }}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
