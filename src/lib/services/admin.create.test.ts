import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthUser: vi.fn(),
  upsertProfile: vi.fn(),
  updateProfile: vi.fn(),
  findCampaigns: vi.fn(),
  createInstances: vi.fn(),
}));

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServiceClient: () => ({ auth: { admin: { createUser: mocks.createAuthUser } } }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { upsert: mocks.upsertProfile, update: mocks.updateProfile },
    campaign: { findMany: mocks.findCampaigns },
    campaignInstance: { createMany: mocks.createInstances },
  },
}));

import { createUser, setUserRole } from "./admin";

describe("createUser default access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthUser.mockResolvedValue({ data: { user: { id: "student-1" } }, error: null });
    mocks.upsertProfile.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      displayName: "Student One",
      role: "STUDENT",
    });
    mocks.findCampaigns.mockResolvedValue([{ id: "bootcamp", versions: [{ id: "bootcamp-v1" }] }]);
    mocks.createInstances.mockResolvedValue({ count: 1 });
    mocks.updateProfile.mockResolvedValue({ id: "student-1", role: "STUDENT" });
  });

  it("grants the published catalog to a student created by an administrator", async () => {
    await createUser({
      email: "student@example.test",
      password: "password123",
      displayName: "Student One",
      role: "STUDENT",
    });

    expect(mocks.createInstances).toHaveBeenCalledWith({
      data: [{ studentId: "student-1", campaignVersionId: "bootcamp-v1", status: "PENDING" }],
      skipDuplicates: true,
    });
  });

  it("does not grant student campaigns to an instructor", async () => {
    mocks.createAuthUser.mockResolvedValue({ data: { user: { id: "instructor-1" } }, error: null });
    mocks.upsertProfile.mockResolvedValue({
      id: "instructor-1",
      email: "instructor@example.test",
      displayName: "Instructor One",
      role: "INSTRUCTOR",
    });

    await createUser({
      email: "instructor@example.test",
      password: "password123",
      displayName: "Instructor One",
      role: "INSTRUCTOR",
    });

    expect(mocks.findCampaigns).not.toHaveBeenCalled();
    expect(mocks.createInstances).not.toHaveBeenCalled();
  });

  it("grants the catalog when an existing account becomes a student", async () => {
    await setUserRole("student-1", "STUDENT", "admin-1");

    expect(mocks.createInstances).toHaveBeenCalledWith({
      data: [{ studentId: "student-1", campaignVersionId: "bootcamp-v1", status: "PENDING" }],
      skipDuplicates: true,
    });
  });
});
