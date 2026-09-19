import { describe, expect, it } from "vitest";
import { gradeFinding, type FindingSpec } from "./finding";

describe("gradeFinding", () => {
  it("passes when all fields are correct", () => {
    const s: FindingSpec = {
      fields: [
        { key: "protocol", label: "Protocol", expected: "TCP" },
        { key: "port", label: "Port", expected: 443 },
      ],
    };
    const result = gradeFinding({ protocol: "tcp", port: 443 }, s);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(result.maxScore);
    expect(result.categories.Protocol).toBe("PASS");
    expect(result.categories.Port).toBe("PASS");
  });

  it("gives partial score when one field is wrong", () => {
    const s: FindingSpec = {
      fields: [
        { key: "protocol", label: "Protocol", expected: "TCP" },
        { key: "port", label: "Port", expected: 443 },
      ],
    };
    const result = gradeFinding({ protocol: "UDP", port: 443 }, s);
    expect(result.passed).toBe(false);
    expect(result.categories.Protocol).toBe("FAIL");
    expect(result.categories.Port).toBe("PASS");
    expect(result.score).toBe(50);
  });

  it("respects numeric tolerance", () => {
    const s: FindingSpec = {
      fields: [{ key: "latencyMs", label: "Latency", expected: 100, tolerance: 5 }],
    };
    const within = gradeFinding({ latencyMs: 103 }, s);
    const outside = gradeFinding({ latencyMs: 110 }, s);
    expect(within.categories.Latency).toBe("PASS");
    expect(outside.categories.Latency).toBe("FAIL");
  });

  it("respects a min/max range", () => {
    const s: FindingSpec = {
      fields: [{ key: "ttl", label: "TTL", min: 60, max: 64 }],
    };
    const within = gradeFinding({ ttl: 62 }, s);
    const outside = gradeFinding({ ttl: 128 }, s);
    expect(within.categories.TTL).toBe("PASS");
    expect(outside.categories.TTL).toBe("FAIL");
  });

  it("never includes the expected value in categories", () => {
    const s: FindingSpec = {
      fields: [{ key: "protocol", label: "Protocol", expected: "TOPSECRETPROTO" }],
    };
    const result = gradeFinding({ protocol: "wrong" }, s);
    const serialized = JSON.stringify(result.categories);
    expect(serialized).not.toContain("TOPSECRETPROTO");
  });
});
