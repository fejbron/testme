import type { GraderFeedback } from "./types";

const MAX_SCORE = 100;

/** One required field in a finding submission: either an exact expected value, or a numeric tolerance/range. */
export interface FindingField {
  key: string;
  label: string;
  expected?: string | number;
  /** Numeric tolerance around `expected` (only meaningful when `expected` is a number). */
  tolerance?: number;
  min?: number;
  max?: number;
}

export interface FindingSpec {
  fields: FindingField[];
}

function normalizeString(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : String(v);
}

function fieldPasses(value: unknown, field: FindingField): boolean {
  if (value === undefined || value === null) return false;

  if (field.min !== undefined || field.max !== undefined) {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return false;
    if (field.min !== undefined && num < field.min) return false;
    if (field.max !== undefined && num > field.max) return false;
    return true;
  }

  if (typeof field.expected === "number") {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return false;
    const tolerance = field.tolerance ?? 0;
    return Math.abs(num - field.expected) <= tolerance;
  }

  if (typeof field.expected === "string") {
    return normalizeString(value) === normalizeString(field.expected);
  }

  // No expected/min/max given: nothing to check against, treat as pass
  // as long as a value was supplied.
  return true;
}

/**
 * Grades a "finding" submission: a set of named fields, each checked
 * pass/fail against an exact expected value or a numeric tolerance/range.
 * Score is the fraction of fields correct. Categories show per-field
 * PASS/FAIL only — the expected value is never revealed.
 */
export function gradeFinding(submitted: Record<string, unknown>, spec: FindingSpec): GraderFeedback {
  const categories: Record<string, string> = {};
  let correct = 0;

  for (const field of spec.fields) {
    const ok = fieldPasses(submitted[field.key], field);
    categories[field.label] = ok ? "PASS" : "FAIL";
    if (ok) correct += 1;
  }

  const total = spec.fields.length;
  const fraction = total === 0 ? 0 : correct / total;
  const score = Math.round(fraction * MAX_SCORE);
  const passed = total > 0 && correct === total;

  return {
    passed,
    score,
    maxScore: MAX_SCORE,
    categories,
    summary: `${correct}/${total} fields correct.`,
  };
}
