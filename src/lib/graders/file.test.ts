import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gradeFile, type FileSpec } from "./file";

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("gradeFile", () => {
  it("passes when sha256 matches", () => {
    const bytes = Buffer.from("hello world");
    const spec: FileSpec = { sha256: sha256Hex(bytes) };
    const result = gradeFile(bytes, spec);
    expect(result.passed).toBe(true);
    expect(result.categories.Checksum).toBe("PASS");
  });

  it("fails when sha256 mismatches", () => {
    const bytes = Buffer.from("hello world");
    const spec: FileSpec = { sha256: "0".repeat(64) };
    const result = gradeFile(bytes, spec);
    expect(result.passed).toBe(false);
    expect(result.categories.Checksum).toBe("FAIL");
  });

  it("checks mustContain substrings (utf8)", () => {
    const bytes = Buffer.from("the secret token is XYZ789 inside this file");
    const spec: FileSpec = { mustContain: ["XYZ789"] };
    const result = gradeFile(bytes, spec);
    expect(result.passed).toBe(true);
  });

  it("checks mustContain substrings (hex tolerant)", () => {
    const bytes = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const spec: FileSpec = { mustContain: ["deadbeef"] };
    const result = gradeFile(bytes, spec);
    expect(result.passed).toBe(true);
  });

  it("fails mustContain when substring is absent", () => {
    const bytes = Buffer.from("nothing to see here");
    const spec: FileSpec = { mustContain: ["NOPE"] };
    const result = gradeFile(bytes, spec);
    expect(result.passed).toBe(false);
    expect(result.categories["Contains 1"]).toBe("FAIL");
  });

  it("detects pcap magic bytes, big-endian", () => {
    const bytes = Buffer.from([0xa1, 0xb2, 0xc3, 0xd4, 0, 0, 0, 0]);
    const result = gradeFile(bytes, { parser: "pcap" });
    expect(result.categories.Format).toBe("PASS");
  });

  it("detects pcap magic bytes, little-endian", () => {
    const bytes = Buffer.from([0xd4, 0xc3, 0xb2, 0xa1, 0, 0, 0, 0]);
    const result = gradeFile(bytes, { parser: "pcap" });
    expect(result.categories.Format).toBe("PASS");
  });

  it("rejects non-pcap magic bytes", () => {
    const bytes = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = gradeFile(bytes, { parser: "pcap" });
    expect(result.categories.Format).toBe("FAIL");
  });

  it("accepts valid json", () => {
    const bytes = Buffer.from(JSON.stringify({ a: 1 }));
    const result = gradeFile(bytes, { parser: "json" });
    expect(result.categories.Format).toBe("PASS");
  });

  it("rejects invalid json", () => {
    const bytes = Buffer.from("{not json");
    const result = gradeFile(bytes, { parser: "json" });
    expect(result.categories.Format).toBe("FAIL");
  });

  it("does not consider a filename at all (bytes-only signature)", () => {
    // gradeFile has no filename parameter; this test documents that
    // guarantee by construction — passing arbitrary bytes still works.
    const bytes = Buffer.from("data");
    const result = gradeFile(bytes, {});
    expect(result.maxScore).toBe(100);
  });
});
