import type { ScoreEvent } from "@prisma/client";

/** Deterministic fold over immutable score events (spec §20). Total is never stored mutable. */
export function computeTotal(events: Pick<ScoreEvent, "delta">[]): number {
  return events.reduce((acc, e) => acc + e.delta, 0);
}

export interface CategoryBreakdown {
  category: string;
  total: number;
}

export function computeByCategory(events: Pick<ScoreEvent, "category" | "delta">[]): CategoryBreakdown[] {
  const map = new Map<string, number>();
  for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + e.delta);
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Given a stage's base points, applied hint penalties, and attempt count, produce the
 * net award for a successful completion. Deterministic and auditable.
 */
export function stageAward(params: {
  basePoints: number;
  hintPenalties: number[];
  attemptCount: number;
  attemptPenaltyPerFail?: number;
  evidenceMultiplier?: number;
}): number {
  const { basePoints, hintPenalties, attemptCount } = params;
  const attemptPenaltyPerFail = params.attemptPenaltyPerFail ?? 0;
  const evidenceMultiplier = params.evidenceMultiplier ?? 1;
  const hintTotal = hintPenalties.reduce((a, b) => a + b, 0);
  const failedAttempts = Math.max(0, attemptCount - 1);
  const raw = basePoints * evidenceMultiplier - hintTotal - failedAttempts * attemptPenaltyPerFail;
  return Math.max(0, Math.round(raw));
}
