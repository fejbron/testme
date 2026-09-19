import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSupabaseServiceClient } from "@/lib/auth/supabase-server";
import { parseManifest } from "@/lib/campaign/load";
import { importCampaign, type ImportResult } from "@/lib/campaign/import";
import { campaignRuntime } from "@/lib/campaigns/registry";
import { ApiError } from "@/lib/api/handler";

/* ------------------------------------------------------------------ users */

export async function listUsers() {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "asc" } });
  return profiles.map((p) => ({ id: p.id, email: p.email, displayName: p.displayName, role: p.role, createdAt: p.createdAt }));
}

export async function createUser(params: { email: string; password: string; displayName: string; role: Role }) {
  const admin = createSupabaseServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { display_name: params.displayName },
  });
  if (error || !data.user) throw new ApiError(400, error?.message ?? "could not create auth user");
  const profile = await prisma.profile.upsert({
    where: { id: data.user.id },
    update: { role: params.role, displayName: params.displayName, email: params.email },
    create: { id: data.user.id, email: params.email, displayName: params.displayName, role: params.role },
  });
  return { id: profile.id, email: profile.email, displayName: profile.displayName, role: profile.role };
}

export async function setUserRole(id: string, role: Role, actorId: string) {
  if (id === actorId && role !== "ADMIN") throw new ApiError(400, "you cannot remove your own admin role");
  const profile = await prisma.profile.update({ where: { id }, data: { role } });
  return { id: profile.id, role: profile.role };
}

export async function deleteUser(id: string, actorId: string) {
  if (id === actorId) throw new ApiError(400, "you cannot delete your own account");
  const admin = createSupabaseServiceClient();
  await admin.auth.admin.deleteUser(id).catch(() => {}); // may already be gone
  await prisma.profile.delete({ where: { id } }).catch(() => {});
  return { ok: true };
}

/* ---------------------------------------------------------------- cohorts */

export async function listCohorts() {
  const courses = await prisma.course.findMany({
    include: {
      owner: true,
      cohorts: { include: { members: { include: { student: true } }, _count: { select: { assignments: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.owner.displayName,
    cohorts: c.cohorts.map((h) => ({
      id: h.id,
      name: h.name,
      assignments: h._count.assignments,
      members: h.members.map((m) => ({ id: m.student.id, name: m.student.displayName, email: m.student.email })),
    })),
  }));
}

export async function createCourse(name: string, ownerId: string) {
  return prisma.course.create({ data: { name, ownerId } });
}

export async function createCohort(courseId: string, name: string) {
  return prisma.cohort.create({ data: { courseId, name } });
}

export async function addCohortMember(cohortId: string, studentId: string) {
  const student = await prisma.profile.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(404, "student not found");
  await prisma.cohortMember.upsert({
    where: { cohortId_studentId: { cohortId, studentId } },
    update: {},
    create: { cohortId, studentId },
  });
  return { ok: true };
}

export async function removeCohortMember(cohortId: string, studentId: string) {
  await prisma.cohortMember.deleteMany({ where: { cohortId, studentId } });
  return { ok: true };
}

/* -------------------------------------------------------------- campaigns */

export async function listCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      versions: { orderBy: { version: "desc" }, include: { _count: { select: { stages: true, instances: true, assignments: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return campaigns.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    difficulty: c.difficulty,
    status: c.status,
    versions: c.versions.map((v) => ({
      id: v.id,
      version: v.version,
      stages: v._count.stages,
      instances: v._count.instances,
      assignments: v._count.assignments,
      publishedAt: v.publishedAt,
    })),
  }));
}

/** Campaign packages present on disk that can be published (have a runtime + campaign.yaml). */
export function listAvailablePackages(): { slug: string }[] {
  return ["bootcamp", "fieldwork", "janus", "gauntlet"]
    .map((dir) => {
      try {
        const yamlText = readFileSync(join(process.cwd(), "challenges", dir, "campaign.yaml"), "utf8");
        return { slug: parseManifest(yamlText).campaign.slug };
      } catch {
        return null;
      }
    })
    .filter((x): x is { slug: string } => x !== null);
}

const DIR_BY_SLUG: Record<string, string> = {
  bootcamp: "bootcamp",
  fieldwork: "fieldwork",
  "project-janus": "janus",
  gauntlet: "gauntlet",
};

export async function publishPackage(slug: string, authorId: string): Promise<ImportResult> {
  const dir = DIR_BY_SLUG[slug];
  if (!dir) throw new ApiError(404, `no package on disk for "${slug}"`);
  const yamlText = readFileSync(join(process.cwd(), "challenges", dir, "campaign.yaml"), "utf8");
  const knownGenerators = Object.keys(campaignRuntime(slug).generators);
  return importCampaign(prisma, { yamlText, authorId, knownGenerators });
}

/** Assign a campaign version to a cohort and mint a pending instance for each member. */
export async function assignVersionToCohort(campaignVersionId: string, cohortId: string) {
  const members = await prisma.cohortMember.findMany({ where: { cohortId } });
  await prisma.$transaction(async (tx) => {
    await tx.assignment.upsert({
      where: { campaignVersionId_cohortId: { campaignVersionId, cohortId } },
      update: {},
      create: { campaignVersionId, cohortId },
    });
    for (const m of members) {
      await tx.campaignInstance.upsert({
        where: { campaignVersionId_studentId: { campaignVersionId, studentId: m.studentId } },
        update: {},
        create: { campaignVersionId, studentId: m.studentId, status: "PENDING" },
      });
    }
  });
  return { assigned: members.length };
}
