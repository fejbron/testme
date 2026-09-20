import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findMany: vi.fn(),
  submissionCount: vi.fn(),
  hintCount: vi.fn(),
  findEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    campaignInstance: { findMany: mocks.findMany },
    submission: { count: mocks.submissionCount },
    hintUsage: { count: mocks.hintCount },
    domainEvent: { findFirst: mocks.findEvent },
  },
}));

import { GET } from "./route";

describe("instructor overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({
      id: "instructor-id",
      email: "instructor@example.test",
      profile: { id: "instructor-id", role: "INSTRUCTOR" },
    });
    mocks.findMany.mockResolvedValue([
      {
        id: "instance-1",
        status: "ACTIVE",
        createdAt: new Date("2026-09-20T12:00:00Z"),
        student: { id: "student-1", displayName: "Student One", email: "student@example.test" },
        campaignVersion: { campaign: { name: "Boot Camp" }, _count: { stages: 2 } },
        challengeInstances: [
          { status: "COMPLETED", _count: { submissions: 2, hintUsages: 1 } },
          { status: "AVAILABLE", _count: { submissions: 1, hintUsages: 0 } },
        ],
        environment: { status: "RUNNING" },
        scoreEvents: [{ delta: 100 }],
        domainEvents: [{ createdAt: new Date("2026-09-20T13:00:00Z") }],
      },
    ]);
    mocks.submissionCount.mockRejectedValue(new Error("N+1 query should not run"));
    mocks.hintCount.mockRejectedValue(new Error("N+1 query should not run"));
    mocks.findEvent.mockRejectedValue(new Error("N+1 query should not run"));
  });

  it("returns all overview aggregates from one campaign-instance query", async () => {
    const response = await GET(new Request("http://localhost/api/instructor/overview"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      students: [
        {
          instanceId: "instance-1",
          student: { id: "student-1", name: "Student One", email: "student@example.test" },
          campaign: "Boot Camp",
          status: "ACTIVE",
          score: 100,
          progress: { completed: 1, total: 2 },
          environment: "RUNNING",
          hintsUsed: 1,
          failedSubmissions: 3,
          lastActivity: "2026-09-20T13:00:00.000Z",
        },
      ],
    });
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.submissionCount).not.toHaveBeenCalled();
    expect(mocks.hintCount).not.toHaveBeenCalled();
    expect(mocks.findEvent).not.toHaveBeenCalled();
  });
});
