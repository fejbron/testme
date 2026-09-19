import { describe, expect, it } from "vitest";
import { parseManifest } from "./load";
import { manifestHash } from "./hash";

const MANIFEST_A = `
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
    description: Discover the entry point.
    points: 50
    estimatedMinutes: 30
    completion:
      type: value
    visibility:
      default: true
`;

// Same content as MANIFEST_A but with keys reordered at every nesting level.
const MANIFEST_A_REORDERED = `
apiVersion: cyberrange/v1
environment:
  workstation:
    image: vercel/sandbox/universal
campaign:
  difficulty: advanced
  estimatedHours: 12
  description: A covert relay campaign.
  name: Project Janus
  slug: janus
stages:
  - title: First Light
    id: first-light
    completion:
      type: value
    estimatedMinutes: 30
    points: 50
    description: Discover the entry point.
    visibility:
      default: true
`;

const MANIFEST_B_DIFFERENT_POINTS = `
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
    description: Discover the entry point.
    points: 999
    estimatedMinutes: 30
    completion:
      type: value
    visibility:
      default: true
`;

describe("manifestHash", () => {
  it("is identical for manifests that differ only in key order", () => {
    const a = parseManifest(MANIFEST_A);
    const aReordered = parseManifest(MANIFEST_A_REORDERED);
    expect(manifestHash(a)).toBe(manifestHash(aReordered));
  });

  it("changes when a stage's point value changes", () => {
    const a = parseManifest(MANIFEST_A);
    const b = parseManifest(MANIFEST_B_DIFFERENT_POINTS);
    expect(manifestHash(a)).not.toBe(manifestHash(b));
  });

  it("is a 64-character hex sha256 digest", () => {
    const a = parseManifest(MANIFEST_A);
    const hash = manifestHash(a);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
