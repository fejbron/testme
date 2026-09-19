import { describe, expect, it } from "vitest";
import { parseManifest } from "./load";
import { validateCampaign } from "./validate";

function codes(issues: { code: string }[]): string[] {
  return issues.map((i) => i.code);
}

describe("validateCampaign", () => {
  it("accepts a fully valid 3-stage campaign with ok:true and no errors", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: janus
  name: Project Janus
  description: A covert relay campaign.
  estimatedHours: 12
  difficulty: advanced
environment:
  workstation:
    image: vercel/sandbox/universal
stages:
  - id: first-light
    title: First Light
    description: Discover the network entry point.
    points: 50
    estimatedMinutes: 30
    completion:
      type: value
    visibility:
      default: true
    onComplete:
      - unlock: silent-relay
  - id: silent-relay
    title: Silent Relay
    description: Decode the relay protocol.
    points: 100
    estimatedMinutes: 60
    completion:
      type: code
      grader: relay-decoder
    requires:
      - first-light
    artifacts:
      - id: traffic
        type: pcap
        generator: traffic
    hints:
      - level: 1
        penalty: 5
        content: Check packet timing carefully.
    onComplete:
      - unlock: archive-node
  - id: archive-node
    title: Archive Node
    description: Recover the archive.
    points: 150
    estimatedMinutes: 90
    completion:
      type: finding
      grader: archive-grader
    requires:
      - silent-relay
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest, {
      knownGraders: ["relay-decoder", "archive-grader"],
      knownGenerators: ["traffic"],
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("flags duplicate stage ids", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: dup
  name: Dup
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
  - id: alpha
    title: Alpha Again
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain("duplicate_stage_id");
  });

  it("flags dangling requires and onComplete.unlock references", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: dangling
  name: Dangling
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
    requires:
      - ghost-stage
    onComplete:
      - unlock: another-ghost
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    const refErrors = result.errors.filter((e) => e.code === "unknown_stage_reference");
    expect(refErrors.length).toBe(2);
  });

  it("flags an unreachable stage with no path from any visible stage", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: unreachable
  name: Unreachable
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
  - id: orphan
    title: Orphan
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: false
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    const unreachable = result.errors.find((e) => e.code === "unreachable_stage");
    expect(unreachable?.stage).toBe("orphan");
  });

  it("flags a requires-cycle", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: cycle
  name: Cycle
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
  - id: beta
    title: Beta
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    requires:
      - gamma
  - id: gamma
    title: Gamma
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    requires:
      - beta
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain("requires_cycle");
  });

  it("flags a missing grader for a graded completion type", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: nograder
  name: NoGrader
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: code
    visibility:
      default: true
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.code === "missing_grader");
    expect(err?.stage).toBe("alpha");
  });

  it("flags an unknown grader when knownGraders is provided", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: badgrader
  name: BadGrader
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: code
      grader: not-registered
    visibility:
      default: true
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest, { knownGraders: ["relay-decoder"] });
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain("unknown_grader");
  });

  it("flags duplicate artifact ids and unknown generators within a stage", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: artifacts
  name: Artifacts
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
    artifacts:
      - id: dump
        type: memory_dump
        generator: mem-gen
      - id: dump
        type: disk_image
        generator: unregistered-gen
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest, { knownGenerators: ["mem-gen"] });
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain("duplicate_artifact_id");
    expect(codes(result.errors)).toContain("unknown_generator");
  });

  it("flags no visible-by-default stage", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: hidden
  name: Hidden
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(false);
    expect(codes(result.errors)).toContain("no_visible_stage");
  });

  it("warns when a description or hint appears to leak an answer", () => {
    const yaml = `
apiVersion: cyberrange/v1
campaign:
  slug: leaky
  name: Leaky
  description: d
  estimatedHours: 1
  difficulty: beginner
environment:
  workstation:
    image: img
stages:
  - id: alpha
    title: Alpha
    description: d
    points: 10
    estimatedMinutes: 5
    completion:
      type: value
    visibility:
      default: true
    hints:
      - level: 1
        penalty: 5
        content: "Answer: it's flag{oops_leaked}"
`;
    const manifest = parseManifest(yaml);
    const result = validateCampaign(manifest);
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain("possible_answer_leak");
    expect(result.warnings[0]?.stage).toBe("alpha");
  });
});
