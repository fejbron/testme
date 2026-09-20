import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importCampaign: vi.fn(),
  findCampaign: vi.fn(),
  findStudents: vi.fn(),
  createInstances: vi.fn(),
}));

vi.mock("node:fs", () => ({ readFileSync: vi.fn(() => "campaign yaml") }));
vi.mock("@/lib/campaign/import", () => ({ importCampaign: mocks.importCampaign }));
vi.mock("@/lib/campaigns/registry", () => ({ campaignRuntime: () => ({ generators: {} }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findUnique: mocks.findCampaign },
    profile: { findMany: mocks.findStudents },
    campaignInstance: { createMany: mocks.createInstances },
  },
}));
vi.mock("@/lib/auth/supabase-server", () => ({ createSupabaseServiceClient: vi.fn() }));

import { publishPackage } from "./admin";

describe("publishPackage default access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importCampaign.mockResolvedValue({
      slug: "fieldwork",
      name: "Field Work",
      version: 1,
      stageCount: 4,
      manifestHash: "hash",
      alreadyImported: false,
    });
    mocks.findCampaign.mockResolvedValue({ id: "campaign-1", versions: [{ id: "version-1" }] });
    mocks.findStudents.mockResolvedValue([{ id: "student-1" }, { id: "student-2" }]);
    mocks.createInstances.mockResolvedValue({ count: 2 });
  });

  it("grants a newly published campaign to every student who has never received it", async () => {
    await publishPackage("fieldwork", "admin-1");

    expect(mocks.findStudents).toHaveBeenCalledWith({
      where: {
        role: "STUDENT",
        campaignInstances: { none: { campaignVersion: { campaignId: "campaign-1" } } },
      },
      select: { id: true },
    });
    expect(mocks.createInstances).toHaveBeenCalledWith({
      data: [
        { studentId: "student-1", campaignVersionId: "version-1", status: "PENDING" },
        { studentId: "student-2", campaignVersionId: "version-1", status: "PENDING" },
      ],
      skipDuplicates: true,
    });
  });
});
