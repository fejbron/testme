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
      <main>
        <InstructorOverview />
      </main>
    </>
  );
}
