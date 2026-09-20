import { describe, expect, it } from "vitest";
import { orderStagesByManifest } from "./stage-order";

describe("orderStagesByManifest", () => {
  it("uses campaign manifest order instead of alphabetical slug order", () => {
    const databaseStages = [
      { slug: "count", title: "Head Count" },
      { slug: "decode-1", title: "First Contact" },
      { slug: "decode-2", title: "Wheel Lock" },
    ];
    const manifest = {
      stages: [
        { id: "decode-1" },
        { id: "decode-2" },
        { id: "count" },
      ],
    };

    expect(orderStagesByManifest(databaseStages, manifest).map((stage) => stage.slug)).toEqual([
      "decode-1",
      "decode-2",
      "count",
    ]);
  });

  it("keeps unknown stages at the end without dropping them", () => {
    const stages = [{ slug: "known" }, { slug: "legacy" }];
    expect(orderStagesByManifest(stages, { stages: [{ id: "known" }] }).map((stage) => stage.slug)).toEqual([
      "known",
      "legacy",
    ]);
  });
});
