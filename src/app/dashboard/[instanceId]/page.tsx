import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";
import InstanceView from "./InstanceView";

export const runtime = "nodejs";

export default async function InstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.role !== "STUDENT") redirect("/instructor");
  const { instanceId } = await params;

  return (
    <>
      <TopBar userName={user.profile.displayName} roleLabel="Student" />
      <InstanceView instanceId={instanceId} />
    </>
  );
}
