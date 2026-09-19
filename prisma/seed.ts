/**
 * Seeds Supabase auth users + Profile rows for the demo cohort.
 * Run: node scripts/prisma-env.mjs  (loads env)  — see package.json "db:seed" uses tsx.
 * Idempotent: re-running updates roles/passwords, never duplicates.
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

type SeedUser = { email: string; password: string; displayName: string; role: Role };

const USERS: SeedUser[] = [
  { email: "admin@range.local", password: "RangeAdmin!2026", displayName: "Range Admin", role: "ADMIN" },
  { email: "instructor@range.local", password: "RangeInstr!2026", displayName: "Dr. Vidal", role: "INSTRUCTOR" },
  { email: "student1@range.local", password: "RangeStud!2026", displayName: "Ada Okafor", role: "STUDENT" },
  { email: "student2@range.local", password: "RangeStud!2026", displayName: "Bo Nakamura", role: "STUDENT" },
];

async function findUserByEmail(email: string): Promise<string | null> {
  // paginate through users (demo scale is tiny)
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  for (const u of USERS) {
    let id = await findUserByEmail(u.email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.displayName },
      });
      if (error) throw error;
      id = data.user.id;
      console.log(`created auth user ${u.email} (${id})`);
    } else {
      await admin.auth.admin.updateUserById(id, { password: u.password, email_confirm: true });
      console.log(`updated auth user ${u.email} (${id})`);
    }
    await prisma.profile.upsert({
      where: { id },
      update: { role: u.role, displayName: u.displayName, email: u.email },
      create: { id, email: u.email, displayName: u.displayName, role: u.role },
    });
  }
  console.log("seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
