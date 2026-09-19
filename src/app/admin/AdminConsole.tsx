"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusPill from "@/components/StatusPill";

type Role = "STUDENT" | "INSTRUCTOR" | "AUTHOR" | "ADMIN";
const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "AUTHOR", "ADMIN"];

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
};

type CohortMember = { id: string; name: string; email: string };

type Cohort = {
  id: string;
  name: string;
  assignments: number;
  members: CohortMember[];
};

type Course = {
  id: string;
  name: string;
  owner: string;
  cohorts: Cohort[];
};

type CampaignVersion = {
  id: string;
  version: number;
  stages: number;
  instances: number;
  assignments: number;
  publishedAt: string | null;
};

type Campaign = {
  id: string;
  slug: string;
  name: string;
  difficulty: string;
  status: string;
  versions: CampaignVersion[];
};

type Package = { slug: string };

type Tab = "users" | "cohorts" | "campaigns";

async function apiRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{message}</div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  color: "var(--fg)",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "var(--muted)",
};

export default function AdminConsole({ selfId }: { selfId: string }) {
  const [tab, setTab] = useState<Tab>("users");

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [cohortsError, setCohortsError] = useState<string | null>(null);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await apiRequest<{ users: AdminUser[] }>("/api/admin/users", "GET");
      setUsers(data.users);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadCohorts() {
    setCohortsLoading(true);
    setCohortsError(null);
    try {
      const data = await apiRequest<{ courses: Course[] }>("/api/admin/cohorts", "GET");
      setCourses(data.courses);
    } catch (e) {
      setCohortsError(e instanceof Error ? e.message : "Failed to load cohorts.");
    } finally {
      setCohortsLoading(false);
    }
  }

  async function loadCampaigns() {
    setCampaignsLoading(true);
    setCampaignsError(null);
    try {
      const data = await apiRequest<{ campaigns: Campaign[]; packages: Package[] }>("/api/admin/campaigns", "GET");
      setCampaigns(data.campaigns);
      setPackages(data.packages);
    } catch (e) {
      setCampaignsError(e instanceof Error ? e.message : "Failed to load campaigns.");
    } finally {
      setCampaignsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadCohorts();
    loadCampaigns();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {(["users", "cohorts", "campaigns"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--fg-strong)" : "2px solid transparent",
              color: tab === t ? "var(--fg-strong)" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTab
          selfId={selfId}
          users={users}
          loading={usersLoading}
          error={usersError}
          reload={loadUsers}
        />
      )}
      {tab === "cohorts" && (
        <CohortsTab
          courses={courses}
          users={users}
          loading={cohortsLoading}
          error={cohortsError}
          reload={loadCohorts}
        />
      )}
      {tab === "campaigns" && (
        <CampaignsTab
          campaigns={campaigns}
          packages={packages}
          courses={courses}
          loading={campaignsLoading}
          error={campaignsError}
          reload={loadCampaigns}
        />
      )}
    </div>
  );
}

function UsersTab({
  selfId,
  users,
  loading,
  error,
  reload,
}: {
  selfId: string;
  users: AdminUser[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiRequest("/api/admin/users", "POST", { email, password, displayName, role });
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("STUDENT");
      await reload();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(user: AdminUser, newRole: Role) {
    if (newRole === user.role) return;
    if (newRole === "ADMIN" || user.role === "ADMIN") {
      const ok = window.confirm(`Change ${user.email}'s role from ${user.role} to ${newRole}?`);
      if (!ok) return;
    }
    setBusyRowId(user.id);
    setRowError(null);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "PATCH", { role: newRole });
      await reload();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to update role.");
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.id === selfId) return;
    const ok = window.confirm(`Delete user ${user.email}? This cannot be undone.`);
    if (!ok) return;
    setBusyRowId(user.id);
    setRowError(null);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "DELETE");
      await reload();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to delete user.");
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Panel title="Create user">
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label style={labelStyle}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, minWidth: 200 }}
            />
          </label>
          <label style={labelStyle}>
            Display name
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ ...inputStyle, minWidth: 160 }}
            />
          </label>
          <label style={labelStyle}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, minWidth: 160 }}
            />
          </label>
          <label style={labelStyle}>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary" busy={creating}>
            Create
          </Button>
        </form>
        <ErrorLine message={createError} />
      </Panel>

      <Panel title="Users" right={loading ? <span style={{ color: "var(--muted)", fontSize: 12 }}>working…</span> : undefined}>
        <ErrorLine message={error} />
        <ErrorLine message={rowError} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Email", "Display name", "Role", "Created", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      color: "var(--muted)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      padding: "8px 8px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 8px" }}>{u.email}</td>
                  <td style={{ padding: "8px 8px" }}>{u.displayName}</td>
                  <td style={{ padding: "8px 8px" }}>
                    <select
                      value={u.role}
                      disabled={busyRowId === u.id}
                      onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                      style={inputStyle}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "8px 8px", color: "var(--muted)" }} className="mono">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 8px" }}>
                    <Button
                      variant="danger"
                      busy={busyRowId === u.id}
                      disabled={u.id === selfId}
                      onClick={() => handleDelete(u)}
                      title={u.id === selfId ? "You cannot delete yourself" : undefined}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {users && users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "12px 8px", color: "var(--muted)" }}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function CohortsTab({
  courses,
  users,
  loading,
  error,
  reload,
}: {
  courses: Course[] | null;
  users: AdminUser[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const [courseName, setCourseName] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [cohortCourseId, setCohortCourseId] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [creatingCohort, setCreatingCohort] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);

  const [memberCohortId, setMemberCohortId] = useState("");
  const [memberStudentId, setMemberStudentId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [busyMemberKey, setBusyMemberKey] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const allCohorts = (courses ?? []).flatMap((c) =>
    c.cohorts.map((co) => ({ ...co, courseName: c.name }))
  );
  const students = (users ?? []).filter((u) => u.role === "STUDENT");

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCourse(true);
    setCourseError(null);
    try {
      await apiRequest("/api/admin/courses", "POST", { name: courseName });
      setCourseName("");
      await reload();
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Failed to create course.");
    } finally {
      setCreatingCourse(false);
    }
  }

  async function handleCreateCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!cohortCourseId) {
      setCohortError("Select a course.");
      return;
    }
    setCreatingCohort(true);
    setCohortError(null);
    try {
      await apiRequest("/api/admin/cohorts", "POST", { courseId: cohortCourseId, name: cohortName });
      setCohortName("");
      await reload();
    } catch (e) {
      setCohortError(e instanceof Error ? e.message : "Failed to create cohort.");
    } finally {
      setCreatingCohort(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberCohortId || !memberStudentId) {
      setMemberError("Select a cohort and a student.");
      return;
    }
    setAddingMember(true);
    setMemberError(null);
    try {
      await apiRequest(`/api/admin/cohorts/${memberCohortId}/members`, "POST", { studentId: memberStudentId });
      setMemberStudentId("");
      await reload();
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(cohortId: string, studentId: string) {
    const key = `${cohortId}:${studentId}`;
    setBusyMemberKey(key);
    setRemoveError(null);
    try {
      await apiRequest(`/api/admin/cohorts/${cohortId}/members/${studentId}`, "DELETE");
      await reload();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Failed to remove member.");
    } finally {
      setBusyMemberKey(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="New course" style={{ flex: "1 1 260px" }}>
          <form onSubmit={handleCreateCourse} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
              Name
              <input
                type="text"
                required
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <Button type="submit" variant="primary" busy={creatingCourse}>
              Create
            </Button>
          </form>
          <ErrorLine message={courseError} />
        </Panel>

        <Panel title="New cohort" style={{ flex: "1 1 260px" }}>
          <form onSubmit={handleCreateCohort} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={labelStyle}>
              Course
              <select value={cohortCourseId} onChange={(e) => setCohortCourseId(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: 140 }}>
              Name
              <input
                type="text"
                required
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <Button type="submit" variant="primary" busy={creatingCohort}>
              Create
            </Button>
          </form>
          <ErrorLine message={cohortError} />
        </Panel>

        <Panel title="Add member to cohort" style={{ flex: "1 1 260px" }}>
          <form onSubmit={handleAddMember} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={labelStyle}>
              Cohort
              <select value={memberCohortId} onChange={(e) => setMemberCohortId(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {allCohorts.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.courseName} / {co.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Student
              <select value={memberStudentId} onChange={(e) => setMemberStudentId(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email})
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary" busy={addingMember}>
              Add
            </Button>
          </form>
          <ErrorLine message={memberError} />
        </Panel>
      </div>

      <Panel title="Courses & cohorts" right={loading ? <span style={{ color: "var(--muted)", fontSize: 12 }}>working…</span> : undefined}>
        <ErrorLine message={error} />
        <ErrorLine message={removeError} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(courses ?? []).map((c) => (
            <div key={c.id} className="card" style={{ borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 14, margin: 0 }}>{c.name}</h3>
                <span style={{ color: "var(--muted)", fontSize: 12 }} className="mono">
                  owner: {c.owner}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {c.cohorts.map((co) => (
                  <div key={co.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--fg-strong)" }}>{co.name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{co.assignments} assignment(s)</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {co.members.length === 0 && (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>No members yet.</span>
                      )}
                      {co.members.map((m) => {
                        const key = `${co.id}:${m.id}`;
                        return (
                          <span
                            key={m.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              padding: "3px 8px",
                              borderRadius: 999,
                              border: "1px solid var(--border)",
                              color: "var(--fg)",
                            }}
                            title={m.email}
                          >
                            {m.name}
                            <button
                              onClick={() => handleRemoveMember(co.id, m.id)}
                              disabled={busyMemberKey === key}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--muted)",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: 12,
                                lineHeight: 1,
                              }}
                              aria-label={`Remove ${m.name}`}
                            >
                              {busyMemberKey === key ? "…" : "✕"}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {c.cohorts.length === 0 && (
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>No cohorts yet.</span>
                )}
              </div>
            </div>
          ))}
          {courses && courses.length === 0 && (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>No courses yet.</span>
          )}
        </div>
      </Panel>
    </div>
  );
}

function CampaignsTab({
  campaigns,
  packages,
  courses,
  loading,
  error,
  reload,
}: {
  campaigns: Campaign[] | null;
  packages: Package[];
  courses: Course[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const [publishSlug, setPublishSlug] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const [assignVersionId, setAssignVersionId] = useState("");
  const [assignCohortId, setAssignCohortId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  const allCohorts = (courses ?? []).flatMap((c) =>
    c.cohorts.map((co) => ({ ...co, courseName: c.name }))
  );

  const versionOptions = (campaigns ?? []).flatMap((c) =>
    c.versions.map((v) => ({
      id: v.id,
      label: `${c.slug} v${v.version}`,
    }))
  );

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!publishSlug) {
      setPublishError("Select a package.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    try {
      const res = await apiRequest<{
        slug: string;
        name: string;
        version: number;
        stageCount: number;
        alreadyImported: boolean;
      }>("/api/admin/campaigns/publish", "POST", { slug: publishSlug });
      setPublishResult(
        `${res.name} (${res.slug}) → v${res.version}, ${res.stageCount} stage(s)${
          res.alreadyImported ? " — already imported" : " — imported"
        }`
      );
      await reload();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Failed to publish campaign.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignVersionId || !assignCohortId) {
      setAssignError("Select a campaign version and a cohort.");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    setAssignResult(null);
    try {
      const res = await apiRequest<{ assigned: number }>("/api/admin/assignments", "POST", {
        campaignVersionId: assignVersionId,
        cohortId: assignCohortId,
      });
      setAssignResult(`Assigned to ${res.assigned} student(s).`);
      await reload();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign campaign.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="Publish / re-import" style={{ flex: "1 1 300px" }}>
          <form onSubmit={handlePublish} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
              Package
              <select value={publishSlug} onChange={(e) => setPublishSlug(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {packages.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.slug}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary" busy={publishing}>
              Publish
            </Button>
          </form>
          <ErrorLine message={publishError} />
          {publishResult && <div className="mono" style={{ fontSize: 12, color: "var(--fg)", marginTop: 8 }}>{publishResult}</div>}
        </Panel>

        <Panel title="Assign to cohort" style={{ flex: "1 1 300px" }}>
          <form onSubmit={handleAssign} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
              Campaign version
              <select value={assignVersionId} onChange={(e) => setAssignVersionId(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {versionOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
              Cohort
              <select value={assignCohortId} onChange={(e) => setAssignCohortId(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {allCohorts.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.courseName} / {co.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary" busy={assigning}>
              Assign
            </Button>
          </form>
          <ErrorLine message={assignError} />
          {assignResult && <div className="mono" style={{ fontSize: 12, color: "var(--fg)", marginTop: 8 }}>{assignResult}</div>}
        </Panel>
      </div>

      <Panel title="Campaigns" right={loading ? <span style={{ color: "var(--muted)", fontSize: 12 }}>working…</span> : undefined}>
        <ErrorLine message={error} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Slug", "Name", "Difficulty", "Status", "Latest version", "Stages", "Instances", "Assignments", "Published"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      color: "var(--muted)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      padding: "8px 8px",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(campaigns ?? []).map((c) => {
                const latest = c.versions[0];
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="mono" style={{ padding: "8px 8px" }}>{c.slug}</td>
                    <td style={{ padding: "8px 8px" }}>{c.name}</td>
                    <td style={{ padding: "8px 8px" }}>{c.difficulty}</td>
                    <td style={{ padding: "8px 8px" }}>
                      <StatusPill status={c.status} />
                    </td>
                    <td className="mono" style={{ padding: "8px 8px" }}>{latest ? `v${latest.version}` : "—"}</td>
                    <td style={{ padding: "8px 8px" }}>{latest ? latest.stages : "—"}</td>
                    <td style={{ padding: "8px 8px" }}>{latest ? latest.instances : "—"}</td>
                    <td style={{ padding: "8px 8px" }}>{latest ? latest.assignments : "—"}</td>
                    <td style={{ padding: "8px 8px", color: "var(--muted)" }}>
                      {latest?.publishedAt ? new Date(latest.publishedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
              {campaigns && campaigns.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "12px 8px", color: "var(--muted)" }}>
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
