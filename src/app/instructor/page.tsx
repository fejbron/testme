import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";
import InstructorOverview from "./InstructorOverview";

export const runtime = "nodejs";

export default async function InstructorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.role !== "INSTRUCTOR" && user.profile.role !== "ADMIN") redirect("/dashboard");

  return (
    <>
      <TopBar userName={user.profile.displayName} roleLabel="Instructor" role={user.profile.role} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Cohort overview</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>Student progress across assigned campaigns.</p>
        <InstructorOverview />
      </main>
    </>
  );
}
