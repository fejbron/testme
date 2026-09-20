import { describe, expect, it } from "vitest";
import { validatePasswordPair } from "./auth-ui";

describe("validatePasswordPair", () => {
  it("rejects a password shorter than eight characters", () => {
    expect(validatePasswordPair("short", "short")).toBe("Password must be at least 8 characters.");
  });

  it("rejects mismatched passwords", () => {
    expect(validatePasswordPair("password1", "password2")).toBe("Passwords do not match.");
  });

  it("accepts a matching valid password", () => {
    expect(validatePasswordPair("password1", "password1")).toBeNull();
  });
});
