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
      <TopBar userName={user.profile.displayName} roleLabel="Student" />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Assigned campaigns</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>Pick a campaign to start or resume your investigation.</p>
        <CampaignList />
      </main>
    </>
  );
}
