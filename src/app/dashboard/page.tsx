import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";
import CampaignList from "./CampaignList";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.role !== "STUDENT") redirect("/instructor");

  return (
    <>
      <TopBar userName={user.profile.displayName} roleLabel="Mission Control" role={user.profile.role} />
      <main className="mission-shell">
        <CampaignList />
      </main>
    </>
  );
}
