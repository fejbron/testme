import ResetForm from "./ResetForm";

export const runtime = "nodejs";

export default function ResetPage() {
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "80px 24px" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.18em" }}>▚ TESTME</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 24px" }}>Set a new password</h1>
      <ResetForm />
    </main>
  );
}
