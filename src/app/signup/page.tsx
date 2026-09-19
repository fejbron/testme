import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import SignupForm from "./SignupForm";

export const runtime = "nodejs";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.role === "STUDENT" ? "/dashboard" : "/instructor");
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "80px 24px" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.18em" }}>▚ TESTME</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 24px" }}>Create account</h1>
      <SignupForm />
      <p style={{ marginTop: 18, fontSize: 13, color: "var(--muted)" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
