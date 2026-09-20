import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findEnvironment: vi.fn(),
  upsertEnvironment: vi.fn(),
  updateEnvironment: vi.fn(),
  findCampaign: vi.fn(),
  upsertArtifact: vi.fn(),
  loadSeedContext: vi.fn(),
  campaignRuntime: vi.fn(),
  ensureBucket: vi.fn(),
  uploadArtifact: vi.fn(),
  providerProvision: vi.fn(),
  providerStart: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    environmentInstance: {
      findUnique: mocks.findEnvironment,
      upsert: mocks.upsertEnvironment,
      update: mocks.updateEnvironment,
    },
    campaignInstance: { findUniqueOrThrow: mocks.findCampaign },
    artifactInstance: { upsert: mocks.upsertArtifact },
  },
}));
vi.mock("@/lib/seed/context", () => ({ loadSeedContext: mocks.loadSeedContext }));
vi.mock("@/lib/campaigns/registry", () => ({ campaignRuntime: mocks.campaignRuntime }));
vi.mock("@/lib/storage", () => ({
  ensureBucket: mocks.ensureBucket,
  uploadArtifact: mocks.uploadArtifact,
  safeObjectKey: vi.fn((...parts: string[]) => parts.join("/")),
}));
vi.mock("@/lib/sandbox/provider", () => ({
  createSandboxProvider: () => ({ provision: mocks.providerProvision, start: mocks.providerStart }),
}));
vi.mock("@/lib/events/emit", () => ({ emitEvent: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ log: { warn: vi.fn() } }));

import { provisionEnvironment, startEnvironment } from "./provision";

describe("environment provisioning retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertEnvironment.mockResolvedValue({ id: "env-1" });
    mocks.findCampaign.mockResolvedValue({
      campaignVersion: { artifacts: [], campaign: { slug: "bootcamp" } },
    });
    mocks.loadSeedContext.mockResolvedValue({});
    mocks.campaignRuntime.mockReturnValue({ generators: {} });
    mocks.ensureBucket.mockResolvedValue(undefined);
    mocks.providerProvision.mockResolvedValue(undefined);
    mocks.updateEnvironment.mockResolvedValue(undefined);
  });

  it("reprovisions a failed environment instead of starting a stale sandbox reference", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env-1", externalRef: "stale-ref", status: "FAILED" });

    await startEnvironment("instance-1");

    expect(mocks.providerStart).not.toHaveBeenCalled();
    expect(mocks.providerProvision).toHaveBeenCalledTimes(1);
  });

  it("clears the sandbox reference when provisioning fails", async () => {
    mocks.providerProvision.mockRejectedValue(new Error("sandbox unavailable"));

    await provisionEnvironment("instance-1");

    expect(mocks.updateEnvironment).toHaveBeenLastCalledWith({
      where: { id: "env-1" },
      data: {
        status: "FAILED",
        externalRef: null,
        metadataJson: { note: "workstation unavailable; artifacts generated" },
      },
    });
  });
});
