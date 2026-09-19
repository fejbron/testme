import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { canViewCampaignInstance, canControlCampaignInstance } from "@/lib/auth/policies";
import { ApiError } from "./handler";

/** Load a campaign instance and assert the actor may VIEW it (owner or instructor/admin). */
export async function loadViewableInstance(user: SessionUser, campaignInstanceId: string) {
  const instance = await prisma.campaignInstance.findUnique({ where: { id: campaignInstanceId } });
  if (!instance) throw new ApiError(404, "campaign instance not found");
  if (!canViewCampaignInstance(user.profile, instance.studentId)) throw new ApiError(403, "forbidden");
  return instance;
}

/** Load a campaign instance and assert the actor may CONTROL it (owning student only). */
export async function loadControllableInstance(user: SessionUser, campaignInstanceId: string) {
  const instance = await prisma.campaignInstance.findUnique({ where: { id: campaignInstanceId } });
  if (!instance) throw new ApiError(404, "campaign instance not found");
  if (!canControlCampaignInstance(user.profile, instance.studentId)) throw new ApiError(403, "forbidden");
  return instance;
}

/** Load a challenge instance (with its parent) and assert control; also require it be unlocked. */
export async function loadControllableChallenge(user: SessionUser, challengeInstanceId: string, opts: { requireUnlocked?: boolean } = {}) {
  const challenge = await prisma.challengeInstance.findUnique({
    where: { id: challengeInstanceId },
    include: { campaignInstance: true, stage: true },
  });
  if (!challenge) throw new ApiError(404, "challenge not found");
  if (!canControlCampaignInstance(user.profile, challenge.campaignInstance.studentId)) throw new ApiError(403, "forbidden");
  if (opts.requireUnlocked && challenge.status === "LOCKED") throw new ApiError(403, "stage is locked");
  return challenge;
}

/** Viewable challenge (owner or instructor). Locked stages are hidden from students. */
export async function loadViewableChallenge(user: SessionUser, challengeInstanceId: string) {
  const challenge = await prisma.challengeInstance.findUnique({
    where: { id: challengeInstanceId },
    include: { campaignInstance: true, stage: true },
  });
  if (!challenge) throw new ApiError(404, "challenge not found");
  const isOwner = user.profile.id === challenge.campaignInstance.studentId;
  if (!canViewCampaignInstance(user.profile, challenge.campaignInstance.studentId)) throw new ApiError(403, "forbidden");
  if (isOwner && challenge.status === "LOCKED") throw new ApiError(403, "stage is locked");
  return challenge;
}
