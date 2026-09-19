import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { ManifestSchema } from "./schema";

const VALID_YAML = `
apiVersion: cyberrange/v1
campaign:
  slug: janus
  name: Project Janus
  description: A campaign about intercepting a covert relay network.
  estimatedHours: 12
  difficulty: advanced
environment:
  workstation:
    image: vercel/sandbox/universal
    services:
      - name: relay
        startsLockedUntil: transcriber
stages:
  - id: first-light
    title: First Light
    description: Discover the entry point into the network.
    points: 50
    estimatedMinutes: 30
    completion:
      type: value
    visibility:
      default: true
  - id: silent-relay
    title: Silent Relay
    description: Decode the relay's protocol.
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
        content: "Check the timing between packets."
    onComplete:
      - unlock: archive-node
      - emit: relay.protocol.recovered
      - startService: relay
`;

describe("ManifestSchema", () => {
  it("parses a valid campaign manifest", () => {
    const raw = parseYaml(VALID_YAML);
    const result = ManifestSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaign.slug).toBe("janus");
      expect(result.data.stages).toHaveLength(2);
      expect(result.data.stages[0]?.visibility.default).toBe(true);
      expect(result.data.stages[1]?.completion.grader).toBe("relay-decoder");
    }
  });

  it("rejects a manifest missing apiVersion", () => {
    const raw = parseYaml(VALID_YAML) as Record<string, unknown>;
    delete raw.apiVersion;
    const result = ManifestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects a manifest with an unknown apiVersion value", () => {
    const raw = parseYaml(VALID_YAML) as Record<string, unknown>;
    raw.apiVersion = "cyberrange/v2";
    const result = ManifestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects a stage with a bad completion type", () => {
    const raw = parseYaml(VALID_YAML) as {
      stages: Array<{ completion: { type: string } }>;
    };
    raw.stages[0]!.completion.type = "not-a-real-type";
    const result = ManifestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate hint levels within a single stage", () => {
    const raw = parseYaml(VALID_YAML) as {
      stages: Array<{ hints?: Array<{ level: number; penalty: number; content: string }> }>;
    };
    raw.stages[1]!.hints = [
      { level: 1, penalty: 5, content: "First hint." },
      { level: 1, penalty: 10, content: "Duplicate level hint." },
    ];
    const result = ManifestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});
