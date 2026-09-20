import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  loadControllableInstance: vi.fn(),
  startCampaignInstance: vi.fn(),
  startEnvironment: vi.fn(),
  audit: vi.fn(),
  kickDrain: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/api/access", () => ({ loadControllableInstance: mocks.loadControllableInstance }));
vi.mock("@/lib/campaign/bootstrap", () => ({ startCampaignInstance: mocks.startCampaignInstance }));
vi.mock("@/lib/environment/provision", () => ({ startEnvironment: mocks.startEnvironment }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/events/kick", () => ({ kickDrain: mocks.kickDrain }));

import { POST } from "./route";

describe("start environment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({
      id: "student-1",
      email: "student@example.test",
      profile: { id: "student-1", role: "STUDENT" },
    });
    mocks.loadControllableInstance.mockResolvedValue({ id: "instance-1", status: "PENDING" });
  });

  it("initializes a pending campaign before provisioning its environment", async () => {
    const response = await POST(new Request("http://localhost/api/campaign-instances/instance-1/environment/start", { method: "POST" }), {
      params: Promise.resolve({ id: "instance-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.startCampaignInstance).toHaveBeenCalledWith("instance-1");
    expect(mocks.startCampaignInstance.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startEnvironment.mock.invocationCallOrder[0],
    );
  });
});
