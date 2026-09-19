import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";
import StudentDetail from "./StudentDetail";

export const runtime = "nodejs";

export default async function StudentDetailPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.role !== "INSTRUCTOR" && user.profile.role !== "ADMIN") redirect("/dashboard");
  const { instanceId } = await params;

  return (
    <>
      <TopBar userName={user.profile.displayName} roleLabel="Instructor" />
      <StudentDetail instanceId={instanceId} />
    </>
  );
}
