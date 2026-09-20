import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findProfile: vi.fn(),
  upsertProfile: vi.fn(),
  findCampaigns: vi.fn(),
  createInstances: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("./supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findUnique: mocks.findProfile, upsert: mocks.upsertProfile },
    campaign: { findMany: mocks.findCampaigns },
    campaignInstance: { createMany: mocks.createInstances },
  },
}));

import { getSessionUser } from "./session";

describe("getSessionUser default campaign access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "student-1",
          email: "student@example.test",
          user_metadata: { display_name: "Student One" },
        },
      },
    });
    mocks.findProfile.mockResolvedValue(null);
    mocks.upsertProfile.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      displayName: "Student One",
      role: "STUDENT",
    });
    mocks.findCampaigns.mockResolvedValue([
      { id: "bootcamp", versions: [{ id: "bootcamp-v2" }] },
      { id: "fieldwork", versions: [{ id: "fieldwork-v1" }] },
    ]);
    mocks.createInstances.mockResolvedValue({ count: 2 });
  });

  it("grants every published campaign's latest version when a student profile is first created", async () => {
    await getSessionUser();

    expect(mocks.findCampaigns).toHaveBeenCalledWith({
      where: {
        status: "PUBLISHED",
        versions: { none: { instances: { some: { studentId: "student-1" } } } },
      },
      select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } } },
    });
    expect(mocks.createInstances).toHaveBeenCalledWith({
      data: [
        { studentId: "student-1", campaignVersionId: "bootcamp-v2", status: "PENDING" },
        { studentId: "student-1", campaignVersionId: "fieldwork-v1", status: "PENDING" },
      ],
      skipDuplicates: true,
    });
  });

  it("does not repeat catalog access work for an existing profile", async () => {
    mocks.findProfile.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      displayName: "Student One",
      role: "STUDENT",
    });

    await getSessionUser();

    expect(mocks.findCampaigns).not.toHaveBeenCalled();
    expect(mocks.createInstances).not.toHaveBeenCalled();
  });
});
