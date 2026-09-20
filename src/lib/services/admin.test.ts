import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  deleteProfile: vi.fn(),
  deleteSubmissions: vi.fn(),
  deleteFindings: vi.fn(),
  deleteEvidence: vi.fn(),
  deleteNotebookEntries: vi.fn(),
  deleteHintUsages: vi.fn(),
  deleteCohortMemberships: vi.fn(),
  deleteCampaignInstances: vi.fn(),
  transaction: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: mocks.findUnique,
      delete: mocks.deleteProfile,
    },
    auditLog: { updateMany: mocks.updateMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { deleteUser: mocks.deleteAuthUser } },
  }),
}));

import { ApiError } from "@/lib/api/handler";
import { deleteUser } from "./admin";

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn) =>
      fn({
        auditLog: { updateMany: mocks.updateMany },
        submission: { deleteMany: mocks.deleteSubmissions },
        finding: { deleteMany: mocks.deleteFindings },
        evidence: { deleteMany: mocks.deleteEvidence },
        notebookEntry: { deleteMany: mocks.deleteNotebookEntries },
        hintUsage: { deleteMany: mocks.deleteHintUsages },
        cohortMember: { deleteMany: mocks.deleteCohortMemberships },
        campaignInstance: { deleteMany: mocks.deleteCampaignInstances },
        profile: { delete: mocks.deleteProfile },
      }),
    );
    mocks.deleteProfile.mockResolvedValue({ id: "student-id" });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.deleteSubmissions.mockResolvedValue({ count: 0 });
    mocks.deleteFindings.mockResolvedValue({ count: 0 });
    mocks.deleteEvidence.mockResolvedValue({ count: 0 });
    mocks.deleteNotebookEntries.mockResolvedValue({ count: 0 });
    mocks.deleteHintUsages.mockResolvedValue({ count: 0 });
    mocks.deleteCohortMemberships.mockResolvedValue({ count: 0 });
    mocks.deleteCampaignInstances.mockResolvedValue({ count: 0 });
    mocks.deleteAuthUser.mockResolvedValue({ data: {}, error: null });
  });

  it("rejects deletion of a user who owns courses instead of reporting success", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "owner-id",
      _count: { coursesOwned: 1, campaignsAuthored: 0 },
    });

    await expect(deleteUser("owner-id", "admin-id")).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<ApiError>);
  });

  it("removes an ordinary user while retaining anonymized audit history", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "student-id",
      _count: { coursesOwned: 0, campaignsAuthored: 0 },
    });

    await expect(deleteUser("student-id", "admin-id")).resolves.toEqual({ ok: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { actorId: "student-id" },
      data: { actorId: null },
    });
    expect(mocks.deleteSubmissions).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteFindings).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteEvidence).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteNotebookEntries).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteHintUsages).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteCohortMemberships).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteCampaignInstances).toHaveBeenCalledWith({ where: { studentId: "student-id" } });
    expect(mocks.deleteProfile).toHaveBeenCalledWith({ where: { id: "student-id" } });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("student-id");
  });

  it("surfaces an auth deletion failure instead of reporting success", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "student-id",
      _count: { coursesOwned: 0, campaignsAuthored: 0 },
    });
    mocks.deleteAuthUser.mockResolvedValue({
      data: {},
      error: { message: "auth service unavailable" },
    });

    await expect(deleteUser("student-id", "admin-id")).rejects.toMatchObject({
      status: 502,
      message: "Could not delete the authentication account. Try again.",
    } satisfies Partial<ApiError>);
  });

  it("surfaces a database refusal instead of reporting success", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "student-id",
      _count: { coursesOwned: 0, campaignsAuthored: 0 },
    });
    mocks.deleteProfile.mockRejectedValue(new Error("foreign key constraint"));

    await expect(deleteUser("student-id", "admin-id")).rejects.toMatchObject({
      status: 409,
      message: "User could not be deleted because related records still reference it.",
    } satisfies Partial<ApiError>);
  });
});
