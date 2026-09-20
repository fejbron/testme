import { describe, expect, it } from "vitest";
import { campaignPaths } from "./marketing-data";

describe("campaignPaths", () => {
  it("keeps the learning path in beginner-to-expert order", () => {
    expect(campaignPaths.map((path) => path.title)).toEqual([
      "Boot Camp",
      "Field Work",
      "Project Janus",
      "The Gauntlet",
    ]);
  });

  it("keeps at least one skill tag on every campaign", () => {
    expect(campaignPaths.every((path) => path.tags.length > 0)).toBe(true);
  });
});
