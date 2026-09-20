import { describe, expect, it } from "vitest";
import { filterOverviewRows, needsAttention } from "./instructor-ui";

const rows = [
  { student: { name: "Neil Armstrong", email: "neil@testme.io" }, campaign: "Boot Camp", environment: "RUNNING", hintsUsed: 0, failedSubmissions: 0 },
  { student: { name: "Kwame Owusu", email: "kwame@testme.io" }, campaign: "Fieldwork", environment: "ERROR", hintsUsed: 2, failedSubmissions: 4 },
];

describe("instructor overview helpers", () => {
  it("filters by student identity and campaign", () => {
    expect(filterOverviewRows(rows, "NEIL", "all")).toEqual([rows[0]]);
    expect(filterOverviewRows(rows, "", "Fieldwork")).toEqual([rows[1]]);
  });

  it("identifies attention from environment, hints, or failures", () => {
    expect(needsAttention(rows[0])).toBe(false);
    expect(needsAttention(rows[1])).toBe(true);
  });
});
