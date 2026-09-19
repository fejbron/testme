/** Create a demo course/cohort, enroll both students, assign Janus v1, and mint their instances. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const instructor = await prisma.profile.findUniqueOrThrow({ where: { email: "instructor@range.local" } });
  const students = await prisma.profile.findMany({ where: { email: { in: ["student1@range.local", "student2@range.local"] } } });

  const campaigns = await prisma.campaign.findMany({ where: { status: "PUBLISHED" }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });

  const course = await prisma.course.upsert({
    where: { id: "demo-course" },
    update: {},
    create: { id: "demo-course", name: "Advanced Systems Security", ownerId: instructor.id },
  });
  const cohort = await prisma.cohort.upsert({
    where: { id: "demo-cohort" },
    update: {},
    create: { id: "demo-cohort", courseId: course.id, name: "Autumn Cohort" },
  });
  for (const s of students) {
    await prisma.cohortMember.upsert({
      where: { cohortId_studentId: { cohortId: cohort.id, studentId: s.id } },
      update: {},
      create: { cohortId: cohort.id, studentId: s.id },
    });
  }
  for (const campaign of campaigns) {
    const version = campaign.versions[0];
    if (!version) continue;
    await prisma.assignment.upsert({
      where: { campaignVersionId_cohortId: { campaignVersionId: version.id, cohortId: cohort.id } },
      update: {},
      create: { campaignVersionId: version.id, cohortId: cohort.id },
    });
    for (const s of students) {
      await prisma.campaignInstance.upsert({
        where: { campaignVersionId_studentId: { campaignVersionId: version.id, studentId: s.id } },
        update: {},
        create: { campaignVersionId: version.id, studentId: s.id, status: "PENDING" },
      });
    }
    console.log(`assigned ${campaign.slug} v${version.version} to ${students.length} students`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
