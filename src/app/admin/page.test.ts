import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listUsers: vi.fn(),
  listCohorts: vi.fn(),
  listCampaigns: vi.fn(),
  listAvailablePackages: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/services/admin", () => ({
  listUsers: mocks.listUsers,
  listCohorts: mocks.listCohorts,
  listCampaigns: mocks.listCampaigns,
  listAvailablePackages: mocks.listAvailablePackages,
}));
vi.mock("@/components/TopBar", () => ({ default: function TopBar() { return null; } }));
vi.mock("./AdminConsole", () => ({ default: function AdminConsole() { return null; } }));

import AdminConsole from "./AdminConsole";
import AdminPage from "./page";

function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) return null;
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, type);
}

describe("AdminPage", () => {
  it("passes initial admin data into the client console without a loading waterfall", async () => {
    const sourceUsers = [{ id: "student-1", email: "student@example.test", displayName: "Student", role: "STUDENT", createdAt: new Date("2026-09-20T12:00:00Z") }];
    const users = [{ ...sourceUsers[0], createdAt: "2026-09-20T12:00:00.000Z" }];
    const courses = [{ id: "course-1", name: "Course", owner: "Admin", cohorts: [] }];
    const campaigns = [{ id: "campaign-1", slug: "bootcamp", name: "Boot Camp", difficulty: "beginner", status: "PUBLISHED", versions: [] }];
    const packages = [{ slug: "bootcamp" }];
    mocks.getSessionUser.mockResolvedValue({ profile: { id: "admin-1", displayName: "Admin", role: "ADMIN" } });
    mocks.listUsers.mockResolvedValue(sourceUsers);
    mocks.listCohorts.mockResolvedValue(courses);
    mocks.listCampaigns.mockResolvedValue(campaigns);
    mocks.listAvailablePackages.mockReturnValue(packages);

    const tree = await AdminPage();
    const consoleElement = findElement(tree, AdminConsole);

    expect(consoleElement?.props).toMatchObject({
      selfId: "admin-1",
      initialUsers: users,
      initialCourses: courses,
      initialCampaigns: campaigns,
      initialPackages: packages,
    });
  });
});
