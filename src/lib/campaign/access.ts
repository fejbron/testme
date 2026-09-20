import { prisma } from "@/lib/db";

/** Grant a student the latest version of every published campaign they have never received. */
export async function grantDefaultCampaignAccess(studentId: string): Promise<number> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "PUBLISHED",
      versions: { none: { instances: { some: { studentId } } } },
    },
    select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } } },
  });
  const data = campaigns.flatMap((campaign) =>
    campaign.versions.map((version) => ({
      studentId,
      campaignVersionId: version.id,
      status: "PENDING" as const,
    })),
  );
  if (data.length === 0) return 0;
  const result = await prisma.campaignInstance.createMany({ data, skipDuplicates: true });
  return result.count;
}

/** Grant one published campaign to students who do not already have any version of it. */
export async function grantCampaignToAllStudents(campaignSlug: string): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { slug: campaignSlug },
    select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } } },
  });
  const version = campaign?.versions[0];
  if (!campaign || !version) return 0;

  const students = await prisma.profile.findMany({
    where: {
      role: "STUDENT",
      campaignInstances: { none: { campaignVersion: { campaignId: campaign.id } } },
    },
    select: { id: true },
  });
  if (students.length === 0) return 0;

  const result = await prisma.campaignInstance.createMany({
    data: students.map((student) => ({
      studentId: student.id,
      campaignVersionId: version.id,
      status: "PENDING" as const,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
