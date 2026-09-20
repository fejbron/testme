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
      <main>
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
