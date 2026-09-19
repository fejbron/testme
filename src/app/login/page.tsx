import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const runtime = "nodejs";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.role === "STUDENT" ? "/dashboard" : "/instructor");
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "80px 24px" }}>
      <p style={{ color: "var(--accent)", letterSpacing: 4, fontSize: 12 }}>TESTME</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 24px" }}>Sign in</h1>
      <LoginForm />
    </main>
  );
}
