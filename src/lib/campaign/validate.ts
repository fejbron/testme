import type { Manifest, StageManifest } from "./schema";

export interface ValidationIssue {
  code: string;
  message: string;
  stage?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidateCampaignOptions {
  knownGraders?: string[];
  knownGenerators?: string[];
}

const GRADED_COMPLETION_TYPES = new Set(["code", "environment_state", "file", "finding"]);

const LEAK_PATTERNS: RegExp[] = [
  /answer\s*:/i,
  /flag\{/i,
  /the key is/i,
  /password is/i,
];

function scanForLeaks(text: string): boolean {
  return LEAK_PATTERNS.some((re) => re.test(text));
}

/**
 * Validate a parsed campaign Manifest for structural and referential
 * integrity beyond what the zod schema can express: duplicate ids,
 * dangling references, unlock-graph reachability, requires-cycles,
 * grader/generator presence, and a heuristic answer-leak scan.
 */
export function validateCampaign(m: Manifest, opts: ValidateCampaignOptions = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const stages = m.stages;

  // 1. Duplicate stage ids.
  const idCounts = new Map<string, number>();
  for (const stage of stages) {
    idCounts.set(stage.id, (idCounts.get(stage.id) ?? 0) + 1);
  }
  const duplicateIds = new Set<string>();
  for (const [id, count] of idCounts) {
    if (count > 1) {
      duplicateIds.add(id);
      errors.push({
        code: "duplicate_stage_id",
        message: `Stage id "${id}" appears ${count} times; stage ids must be unique.`,
        stage: id,
      });
    }
  }

  const knownStageIds = new Set(stages.map((s) => s.id));

  // 2. Dangling references: requires + onComplete.unlock.
  for (const stage of stages) {
    for (const req of stage.requires ?? []) {
      if (!knownStageIds.has(req)) {
        errors.push({
          code: "unknown_stage_reference",
          message: `Stage "${stage.id}" requires unknown stage "${req}".`,
          stage: stage.id,
        });
      }
    }
    for (const action of stage.onComplete ?? []) {
      if (action.unlock !== undefined && !knownStageIds.has(action.unlock)) {
        errors.push({
          code: "unknown_stage_reference",
          message: `Stage "${stage.id}" onComplete.unlock references unknown stage "${action.unlock}".`,
          stage: stage.id,
        });
      }
    }
  }

  // 3. Reachability graph: edges from requires (required -> stage) and
  //    unlock (stage -> unlocked). Seed set = stages visible by default.
  const reachabilityEdges = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    if (!reachabilityEdges.has(from)) reachabilityEdges.set(from, new Set());
    reachabilityEdges.get(from)!.add(to);
  };
  for (const stage of stages) {
    for (const req of stage.requires ?? []) {
      if (knownStageIds.has(req)) addEdge(req, stage.id);
    }
    for (const action of stage.onComplete ?? []) {
      if (action.unlock !== undefined && knownStageIds.has(action.unlock)) {
        addEdge(stage.id, action.unlock);
      }
    }
  }

  const visibleByDefault = stages.filter((s) => s.visibility.default).map((s) => s.id);
  const reachable = new Set<string>(visibleByDefault);
  const queue = [...visibleByDefault];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = reachabilityEdges.get(current);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  for (const stage of stages) {
    if (!reachable.has(stage.id)) {
      errors.push({
        code: "unreachable_stage",
        message: `Stage "${stage.id}" is not visible by default and has no unlock/requires path from any visible stage.`,
        stage: stage.id,
      });
    }
  }

  // 4. Requires-cycle detection (DFS over requires edges: stage -> required).
  const requiresEdges = new Map<string, string[]>();
  for (const stage of stages) {
    requiresEdges.set(
      stage.id,
      (stage.requires ?? []).filter((req) => knownStageIds.has(req)),
    );
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const stage of stages) color.set(stage.id, WHITE);
  const cyclesReported = new Set<string>();

  function dfs(stageId: string, stack: string[]): void {
    color.set(stageId, GRAY);
    stack.push(stageId);
    for (const dep of requiresEdges.get(stageId) ?? []) {
      const depColor = color.get(dep);
      if (depColor === GRAY) {
        const cycleStart = stack.indexOf(dep);
        const cyclePath = [...stack.slice(cycleStart), dep];
        const cycleKey = [...new Set(cyclePath)].sort().join(",");
        if (!cyclesReported.has(cycleKey)) {
          cyclesReported.add(cycleKey);
          errors.push({
            code: "requires_cycle",
            message: `Cycle detected in "requires" graph: ${cyclePath.join(" -> ")}.`,
            stage: stageId,
          });
        }
      } else if (depColor === WHITE) {
        dfs(dep, stack);
      }
    }
    stack.pop();
    color.set(stageId, BLACK);
  }
  for (const stage of stages) {
    if (color.get(stage.id) === WHITE) dfs(stage.id, []);
  }

  // 5. Grader presence/validity for graded completion types.
  for (const stage of stages) {
    const { type, grader } = stage.completion;
    if (GRADED_COMPLETION_TYPES.has(type)) {
      if (!grader) {
        errors.push({
          code: "missing_grader",
          message: `Stage "${stage.id}" has completion type "${type}" which requires a grader.`,
          stage: stage.id,
        });
      } else if (opts.knownGraders && !opts.knownGraders.includes(grader)) {
        errors.push({
          code: "unknown_grader",
          message: `Stage "${stage.id}" references unknown grader "${grader}".`,
          stage: stage.id,
        });
      }
    }
  }

  // 6. Artifact generator validity + duplicate artifact ids per stage.
  for (const stage of stages) {
    const artifactIds = new Map<string, number>();
    for (const artifact of stage.artifacts ?? []) {
      artifactIds.set(artifact.id, (artifactIds.get(artifact.id) ?? 0) + 1);
      if (opts.knownGenerators && !opts.knownGenerators.includes(artifact.generator)) {
        errors.push({
          code: "unknown_generator",
          message: `Stage "${stage.id}" artifact "${artifact.id}" references unknown generator "${artifact.generator}".`,
          stage: stage.id,
        });
      }
    }
    for (const [id, count] of artifactIds) {
      if (count > 1) {
        errors.push({
          code: "duplicate_artifact_id",
          message: `Stage "${stage.id}" has duplicate artifact id "${id}" (${count} occurrences).`,
          stage: stage.id,
        });
      }
    }
  }

  // 7. Hidden-answer leak scan (warning only).
  function checkLeak(stage: StageManifest, text: string, where: string) {
    if (scanForLeaks(text)) {
      warnings.push({
        code: "possible_answer_leak",
        message: `Stage "${stage.id}" ${where} appears to contain a leaked answer/flag hint.`,
        stage: stage.id,
      });
    }
  }
  for (const stage of stages) {
    checkLeak(stage, stage.description, "description");
    for (const hint of stage.hints ?? []) {
      checkLeak(stage, hint.content, `hint (level ${hint.level})`);
    }
  }

  // 8. At least one stage visible by default.
  if (visibleByDefault.length === 0) {
    errors.push({
      code: "no_visible_stage",
      message: "No stage is visible by default; nothing would ever unlock.",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
