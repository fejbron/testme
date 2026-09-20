import { cache } from "react";
import type { Profile, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { grantDefaultCampaignAccess } from "@/lib/campaign/access";
import { createSupabaseServerClient } from "./supabase-server";

export type SessionUser = { id: string; email: string; profile: Profile };

/** Resolve the authenticated Supabase user and their platform profile, or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Ensure a Profile row exists (first login provisions it as STUDENT).
  const email = user.email ?? `${user.id}@no-email.local`;
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? email.split("@")[0];
  const existing = await prisma.profile.findUnique({ where: { id: user.id } });
  if (existing) return { id: user.id, email, profile: existing };

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email, displayName, role: "STUDENT" },
  });
  await grantDefaultCampaignAccess(profile.id);
  return { id: user.id, email, profile };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("UNAUTHENTICATED", "Sign in required.");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.profile.role)) throw new AuthError("FORBIDDEN", "Insufficient role.");
  return u;
}

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
