import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";
import { listAvailablePackages, listCampaigns, listCohorts, listUsers } from "@/lib/services/admin";
import AdminConsole from "./AdminConsole";

export const runtime = "nodejs";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.role !== "ADMIN") redirect("/dashboard");

  const [users, courses, campaigns] = await Promise.all([listUsers(), listCohorts(), listCampaigns()]);
  const initialUsers = users.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }));
  const initialCampaigns = campaigns.map((campaign) => ({
    ...campaign,
    versions: campaign.versions.map((version) => ({
      ...version,
      publishedAt: version.publishedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <>
      <TopBar userName={user.profile.displayName} roleLabel="Admin" role={user.profile.role} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Admin console</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>
          Manage users, cohorts, and campaigns.
        </p>
        <AdminConsole
          selfId={user.profile.id}
          initialUsers={initialUsers}
          initialCourses={courses}
          initialCampaigns={initialCampaigns}
          initialPackages={listAvailablePackages()}
        />
      </main>
    </>
  );
}
