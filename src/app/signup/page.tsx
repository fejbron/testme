import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/app/auth/AuthShell";
import { getSessionUser } from "@/lib/auth/session";
import SignupForm from "./SignupForm";

export const runtime = "nodejs";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.role === "STUDENT" ? "/dashboard" : "/instructor");

  return (
    <AuthShell
      eyebrow="Start training"
      title="Create your account."
      description="Join the range and begin with every campaign available from fundamentals to advanced."
      footer={<><span>Already have an account?</span><Link href="/login">Sign in</Link></>}
    >
      <SignupForm />
    </AuthShell>
  );
}
