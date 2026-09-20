import Link from "next/link";
import AuthShell from "@/app/auth/AuthShell";
import ForgotForm from "./ForgotForm";

export const runtime = "nodejs";

export default function ForgotPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Recover your access."
      description="Enter your account email and we will send a secure link to set a new password."
      footer={<><span>Remembered your password?</span><Link href="/login">Back to sign in</Link></>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
