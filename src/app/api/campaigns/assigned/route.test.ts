import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: { campaignInstance: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

describe("assigned campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      profile: { id: "student-1", role: "STUDENT" },
    });
    mocks.findMany.mockResolvedValue([
      {
        id: "instance-1",
        status: "PENDING",
        campaignVersion: {
          version: 1,
          campaign: { name: "Boot Camp" },
          stages: [{ id: "stage-1" }],
        },
        challengeInstances: [],
        scoreEvents: [],
      },
    ]);
  });

  it("exposes a pending assignment as not started to the dashboard", async () => {
    const response = await GET(new Request("http://localhost/api/campaigns/assigned"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      campaigns: [{ id: "instance-1", status: "NOT_STARTED", progress: { completed: 0, total: 1 } }],
    });
  });
});
