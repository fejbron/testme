export * from "./types";
export * from "./value";
export * from "./finding";
export * from "./file";
export * from "./code";
export * from "./environment-state";

import { gradeValue } from "./value";
import { gradeFinding } from "./finding";
import { gradeFile } from "./file";
import { gradeCode } from "./code";
import { gradeEnvironmentState } from "./environment-state";

/**
 * Registry of grader "kinds" used by the Janus campaign, keyed by the
 * grader name referenced from challenge manifests. Each entry carries a
 * `kind` discriminant plus the underlying grade function; the spec/inputs
 * for a given challenge are passed at call time by campaign code, not
 * baked into the registry.
 */
export const GRADER_REGISTRY = {
  "marker-check": { kind: "value", grade: gradeValue },
  "protocol-class": { kind: "finding", grade: gradeFinding },
  "frame-fields": { kind: "finding", grade: gradeFinding },
  decoder: { kind: "code", grade: gradeCode },
  "archive-fragment": { kind: "value", grade: gradeValue },
  "patch-regression": { kind: "code", grade: gradeCode },
  "config-open": { kind: "value", grade: gradeValue },
  "cluster-health": { kind: "environment-state", grade: gradeEnvironmentState },
} as const;

export type GraderName = keyof typeof GRADER_REGISTRY;
