import { prisma } from "@/lib/db";

/** Append-only audit log for security-sensitive actions (spec §22). */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metaJson: (params.meta ?? {}) as object,
    },
  });
}
