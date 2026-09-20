import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  it("runs functions close to the eu-west-1 database", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      regions?: string[];
    };

    expect(config.regions).toEqual(["dub1"]);
  });
});
