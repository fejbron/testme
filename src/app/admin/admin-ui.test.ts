import { describe, expect, it } from "vitest";
import { filterAdminUsers, getInitials } from "./admin-ui";

const users = [
  { id: "1", displayName: "Neil Armstrong", email: "neil@example.test", role: "STUDENT" as const },
  { id: "2", displayName: "Ama Mensah", email: "ama@umat.edu.gh", role: "INSTRUCTOR" as const },
];

describe("admin user directory helpers", () => {
  it("filters users by name, email, or role without case sensitivity", () => {
    expect(filterAdminUsers(users, "NEIL")).toEqual([users[0]]);
    expect(filterAdminUsers(users, "umat.edu")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "instructor")).toEqual([users[1]]);
  });

  it("returns every user when the search is blank", () => {
    expect(filterAdminUsers(users, "   ")).toEqual(users);
  });

  it("creates compact initials for the inspector avatar", () => {
    expect(getInitials("Neil Armstrong")).toBe("NA");
    expect(getInitials("Neil")).toBe("N");
  });
});
