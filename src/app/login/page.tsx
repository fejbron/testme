import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/app/auth/AuthShell";
import { getSessionUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const runtime = "nodejs";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.role === "STUDENT" ? "/dashboard" : "/instructor");

  return (
    <AuthShell
      eyebrow="Member access"
      title="Sign in to continue."
      description="Access your training, active campaigns, and progress record."
      footer={<><span>New to TestMe?</span><Link href="/signup">Create an account</Link><Link href="/forgot">Forgot password?</Link></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
