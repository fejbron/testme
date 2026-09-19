import type { Profile } from "@prisma/client";

/**
 * Authorization policy functions. Every backend route must call one of these;
 * UI restrictions are never sufficient (spec §24).
 */

export function isAdmin(actor: Profile): boolean {
  return actor.role === "ADMIN";
}

export function isInstructorLike(actor: Profile): boolean {
  return actor.role === "INSTRUCTOR" || actor.role === "ADMIN";
}

export function isAuthorLike(actor: Profile): boolean {
  return actor.role === "AUTHOR" || actor.role === "ADMIN";
}

/** A student may only touch their own campaign instance. Instructors/admins may view. */
export function canViewCampaignInstance(actor: Profile, instanceStudentId: string): boolean {
  if (actor.id === instanceStudentId) return true;
  return isInstructorLike(actor);
}

export function canControlCampaignInstance(actor: Profile, instanceStudentId: string): boolean {
  // start/stop/submit/notebook — the owning student only.
  return actor.id === instanceStudentId;
}

export function canResetEnvironment(actor: Profile, instanceStudentId: string): boolean {
  // Student may reset their own environment; instructor may reset any (audited).
  return actor.id === instanceStudentId || isInstructorLike(actor);
}

export function canResetCampaignProgress(actor: Profile, _instanceStudentId: string): boolean {
  // Full progress reset is an instructor action only.
  return isInstructorLike(actor);
}

export function canGradeSubmission(actor: Profile): boolean {
  // Grading is a system action; only the platform (service role) or admins trigger it directly.
  return isAdmin(actor);
}

export function canAdjustScore(actor: Profile): boolean {
  return isInstructorLike(actor);
}

export function canViewInstructorDashboard(actor: Profile): boolean {
  return isInstructorLike(actor);
}

export function canPublishCampaign(actor: Profile): boolean {
  return isAuthorLike(actor);
}
