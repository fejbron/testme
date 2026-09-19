import { listUsers, listCohorts, listCampaigns, listAvailablePackages } from "../src/lib/services/admin";
async function main() {
  const users = await listUsers();
  console.log("users:", users.length, users.map((u) => `${u.email}:${u.role}`).join(", "));
  const courses = await listCohorts();
  console.log("courses:", courses.length, "cohorts:", courses.flatMap((c) => c.cohorts).length);
  const camps = await listCampaigns();
  console.log("campaigns:", camps.map((c) => `${c.slug}(v${c.versions[0]?.version ?? "-"},${c.versions[0]?.assignments ?? 0}a)`).join(", "));
  console.log("packages on disk:", listAvailablePackages().map((p) => p.slug).join(", "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
