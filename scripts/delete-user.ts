import { createClient } from "@supabase/supabase-js";
async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const target = process.argv[2];
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const u = data.users.find((x) => x.email?.toLowerCase() === target.toLowerCase());
  if (!u) { console.log("not found:", target); return; }
  await admin.auth.admin.deleteUser(u.id);
  console.log("deleted", target, u.id);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
