import Link from "next/link";
import AuthShell from "../AuthShell";
import ResetForm from "./ResetForm";

export const runtime = "nodejs";

export default function ResetPage() {
  return (
    <AuthShell
      eyebrow="Recovery session"
      title="Set a new password."
      description="Choose a secure password with at least eight characters to restore account access."
      footer={<Link href="/login">Return to sign in</Link>}
    >
      <ResetForm />
    </AuthShell>
  );
}
