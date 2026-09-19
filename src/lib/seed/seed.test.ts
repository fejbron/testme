import { describe, expect, it } from "vitest";
import { createRootSeed, createSeedContext } from "./index";

const SALT = "manifest-hash-abc123";

describe("SeedContext determinism", () => {
  it("produces identical values for the same (rootSeed, salt) across two contexts", () => {
    const rootSeed = createRootSeed();

    const build = () =>
      createSeedContext(rootSeed, SALT)
        .namespace("campaign:janus")
        .namespace("stage:silent-relay")
        .namespace("artifact:pcap");

    const ctxA = build();
    const ctxB = build();

    expect(ctxA.int("port", 1000, 65535)).toBe(ctxB.int("port", 1000, 65535));
    expect(ctxA.hex("token", 16)).toBe(ctxB.hex("token", 16));
    expect(ctxA.bytes("blob", 24).equals(ctxB.bytes("blob", 24))).toBe(true);
    expect(ctxA.uuid("id")).toBe(ctxB.uuid("id"));
    expect(ctxA.pick("choice", ["a", "b", "c", "d"])).toBe(ctxB.pick("choice", ["a", "b", "c", "d"]));
    expect(ctxA.bool("flag")).toBe(ctxB.bool("flag"));
    expect(ctxA.shuffle("order", [1, 2, 3, 4, 5])).toEqual(ctxB.shuffle("order", [1, 2, 3, 4, 5]));
  });

  it("produces different values for a different rootSeed", () => {
    const rootA = createRootSeed();
    const rootB = createRootSeed();
    const ctxA = createSeedContext(rootA, SALT);
    const ctxB = createSeedContext(rootB, SALT);

    let diffCount = 0;
    for (let i = 0; i < 20; i++) {
      const label = `label-${i}`;
      if (ctxA.hex(label, 8) !== ctxB.hex(label, 8)) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(15);

    expect(ctxA.uuid("id")).not.toBe(ctxB.uuid("id"));
    expect(ctxA.int("n", 0, 1_000_000)).not.toBe(ctxB.int("n", 0, 1_000_000));
  });

  it("respects int bounds over 1000 labels and covers the range", () => {
    const rootSeed = createRootSeed();
    const ctx = createSeedContext(rootSeed, SALT);
    const min = 1;
    const max = 10;

    let observedMin = Infinity;
    let observedMax = -Infinity;

    for (let i = 0; i < 1000; i++) {
      const v = ctx.int(`label-${i}`, min, max);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      observedMin = Math.min(observedMin, v);
      observedMax = Math.max(observedMax, v);
    }

    expect(observedMin).toBeGreaterThanOrEqual(min);
    expect(observedMax).toBeLessThanOrEqual(max);
    expect(observedMin).toBeLessThan(observedMax);
  });

  it("isolates the same label under different namespaces", () => {
    const rootSeed = createRootSeed();
    const root = createSeedContext(rootSeed, SALT);
    const nsA = root.namespace("campaign:alpha");
    const nsB = root.namespace("campaign:beta");

    expect(nsA.hex("shared-label", 16)).not.toBe(nsB.hex("shared-label", 16));
    expect(nsA.int("shared-int", 0, 1_000_000)).not.toBe(nsB.int("shared-int", 0, 1_000_000));

    // Deeper paths also isolate.
    const deepA = root.namespace("campaign:janus").namespace("stage:one");
    const deepB = root.namespace("campaign:janus").namespace("stage:two");
    expect(deepA.hex("x", 16)).not.toBe(deepB.hex("x", 16));
  });

  it("produces RFC-4122 v4-shaped uuids", () => {
    const rootSeed = createRootSeed();
    const ctx = createSeedContext(rootSeed, SALT);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    for (let i = 0; i < 25; i++) {
      expect(ctx.uuid(`id-${i}`)).toMatch(uuidRegex);
    }
  });

  it("shuffle is a deterministic permutation of the input", () => {
    const rootSeed = createRootSeed();
    const ctx = createSeedContext(rootSeed, SALT);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const shuffled1 = ctx.shuffle("perm", arr);
    const shuffled2 = ctx.shuffle("perm", arr);

    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toBe(arr);
    expect([...shuffled1].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
  });
});
