"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Books,
  CaretRight,
  Check,
  Flag,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  Trash,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusPill from "@/components/StatusPill";
import { filterAdminUsers, getInitials } from "./admin-ui";
import styles from "./admin.module.css";

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

const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  users: { title: "Users", description: "Manage your team, set roles, and review access." },
  cohorts: { title: "Cohorts", description: "Organize students into courses and custom groups." },
  campaigns: { title: "Campaigns", description: "Publish challenge packages and assign releases." },
};

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

export default function AdminConsole({
  selfId,
  initialUsers,
  initialCourses,
  initialCampaigns,
  initialPackages,
}: {
  selfId: string;
  initialUsers: AdminUser[];
  initialCourses: Course[];
  initialCampaigns: Campaign[];
  initialPackages: Package[];
}) {
  const [tab, setTab] = useState<Tab>("users");

  const [users, setUsers] = useState<AdminUser[] | null>(initialUsers);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  const [courses, setCourses] = useState<Course[] | null>(initialCourses);
  const [cohortsError, setCohortsError] = useState<string | null>(null);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(initialCampaigns);
  const [packages, setPackages] = useState<Package[]>(initialPackages);
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

  const navItems = [
    { id: "users" as const, label: "Users", icon: UsersThree },
    { id: "cohorts" as const, label: "Cohorts", icon: Books },
    { id: "campaigns" as const, label: "Campaigns", icon: Flag },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="Admin sections">
        <div className={styles.railLabel}>Admin</div>
        <nav className={styles.nav}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? styles.navActive : styles.navItem}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              {tab === id && <motion.span layoutId="admin-nav-indicator" className={styles.navIndicator} />}
              <Icon size={20} weight={tab === id ? "fill" : "regular"} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.railMeta}>
          <span className={styles.statusDot} />
          System online
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.workspaceHeader}>
          <div>
            <div className={styles.breadcrumb}>ADMIN / {tab.toUpperCase()}</div>
            <h1>{TAB_COPY[tab].title}</h1>
            <p>{TAB_COPY[tab].description}</p>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={styles.tabPanel}
          >
            {tab === "users" && (
              <UsersWorkspace
                selfId={selfId}
                users={users}
                courses={courses}
                loading={usersLoading}
                error={usersError}
                reload={loadUsers}
              />
            )}
            {tab === "cohorts" && (
              <div className={styles.legacyContent}>
                <CohortsTab
                  courses={courses}
                  users={users}
                  loading={cohortsLoading}
                  error={cohortsError}
                  reload={loadCohorts}
                />
              </div>
            )}
            {tab === "campaigns" && (
              <div className={styles.legacyContent}>
                <CampaignsTab
                  campaigns={campaigns}
                  packages={packages}
                  courses={courses}
                  loading={campaignsLoading}
                  error={campaignsError}
                  reload={loadCampaigns}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function UsersWorkspace({
  selfId,
  users,
  courses,
  loading,
  error,
  reload,
}: {
  selfId: string;
  users: AdminUser[] | null;
  courses: Course[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(users?.[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const visibleUsers = useMemo(() => filterAdminUsers(users ?? [], query), [users, query]);
  const selectedUser = (users ?? []).find((user) => user.id === selectedId) ?? visibleUsers[0] ?? null;
  const memberships = useMemo(
    () => (courses ?? []).flatMap((course) =>
      course.cohorts
        .filter((cohort) => cohort.members.some((member) => member.id === selectedUser?.id))
        .map((cohort) => `${course.name} / ${cohort.name}`)
    ),
    [courses, selectedUser?.id]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiRequest("/api/admin/users", "POST", { email, password, displayName, role });
      const createdName = displayName;
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("STUDENT");
      await reload();
      setShowCreate(false);
      setNotice(`${createdName} was created.`);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(user: AdminUser, newRole: Role) {
    if (newRole === user.role) return;
    if ((newRole === "ADMIN" || user.role === "ADMIN") && !window.confirm(`Change ${user.email}'s role from ${user.role} to ${newRole}?`)) return;
    setBusyRowId(user.id);
    setRowError(null);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "PATCH", { role: newRole });
      await reload();
      setNotice(`${user.displayName}'s role was updated.`);
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : "Failed to update role.");
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.id === selfId || !window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    setBusyRowId(user.id);
    setRowError(null);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "DELETE");
      await reload();
      setSelectedId("");
      setNotice(`${user.displayName} was deleted.`);
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : "Failed to delete user.");
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <div className={styles.userLayout}>
      <section className={styles.directory}>
        <div className={styles.directoryToolbar}>
          <label className={styles.searchBox}>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <span className={styles.srOnly}>Search users</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users by name, email, or role…" />
          </label>
          <motion.button type="button" className={styles.primaryButton} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate((current) => !current)}>
            {showCreate ? <X size={17} /> : <Plus size={17} weight="bold" />}{showCreate ? "Close" : "Create user"}
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {showCreate && (
            <motion.form className={styles.createForm} onSubmit={handleCreate} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
              <label>Display name<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
              <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <label>Role<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <button type="submit" disabled={creating}>{creating ? <SpinnerGap className="icon-spin" size={17} /> : <Plus size={17} />}Create</button>
              {createError && <p className={styles.inlineError}>{createError}</p>}
            </motion.form>
          )}
        </AnimatePresence>

        {(error || rowError) && <div className={styles.errorBanner}>{error || rowError}</div>}
        <div className={styles.tableFrame}>
          <div className={styles.tableHeader}><span>Name</span><span>Email</span><span>Role</span><span>Created</span><span /></div>
          <div className={styles.userRows}>
            {visibleUsers.map((user) => {
              const active = selectedUser?.id === user.id;
              return (
                <motion.button layout type="button" key={user.id} className={active ? styles.userRowActive : styles.userRow} onClick={() => setSelectedId(user.id)} whileHover={{ x: 2 }}>
                  <span className={styles.userIdentity}><span className={styles.avatarSmall}>{getInitials(user.displayName)}</span><strong>{user.displayName}</strong></span>
                  <span className={styles.userEmail}>{user.email}</span>
                  <span className={styles.roleBadge}>{user.role.toLocaleLowerCase()}</span>
                  <span className={styles.createdAt}>{new Date(user.createdAt).toLocaleDateString()}</span>
                  <CaretRight size={16} aria-hidden="true" />
                </motion.button>
              );
            })}
            {!loading && visibleUsers.length === 0 && <div className={styles.emptyState}>No users match your search.</div>}
            {loading && <div className={styles.loadingState}><SpinnerGap className="icon-spin" size={18} />Refreshing directory…</div>}
          </div>
        </div>
        <div className={styles.tableFooter}>{visibleUsers.length} of {(users ?? []).length} users</div>
      </section>

      <AnimatePresence mode="wait">
        {selectedUser ? (
          <motion.aside key={selectedUser.id} className={styles.inspector} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            <div className={styles.inspectorProfile}>
              <div className={styles.avatarLarge}>{getInitials(selectedUser.displayName)}</div>
              <div><h2>{selectedUser.displayName}</h2><p>{selectedUser.email}</p></div>
              <span className={styles.activeStatus}><span />Active</span>
            </div>
            <div className={styles.inspectorSection}>
              <div className={styles.sectionTitle}><span>User details</span><UserCircle size={18} /></div>
              <dl className={styles.detailList}>
                <div><dt>Full name</dt><dd>{selectedUser.displayName}</dd></div>
                <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                <div><dt>Joined</dt><dd>{new Date(selectedUser.createdAt).toLocaleDateString()}</dd></div>
              </dl>
            </div>
            <div className={styles.inspectorSection}>
              <div className={styles.sectionTitle}><span>Role</span></div>
              <p className={styles.sectionHelp}>Controls what this user can access.</p>
              <select className={styles.inspectorSelect} value={selectedUser.role} disabled={busyRowId === selectedUser.id} onChange={(event) => handleRoleChange(selectedUser, event.target.value as Role)}>
                {ROLES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className={styles.inspectorSection}>
              <div className={styles.sectionTitle}><span>Cohort memberships</span><span className={styles.count}>{memberships.length}</span></div>
              <div className={styles.memberships}>{memberships.map((membership) => <span key={membership}>{membership}</span>)}{memberships.length === 0 && <p>Not assigned to a custom cohort.</p>}</div>
            </div>
            <div className={styles.dangerZone}>
              <div><Trash size={19} /><strong>Delete user</strong></div>
              <p>This permanently removes the account and its access. This action cannot be undone.</p>
              <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={selectedUser.id === selfId || busyRowId === selectedUser.id} onClick={() => handleDelete(selectedUser)}>
                {busyRowId === selectedUser.id ? <SpinnerGap className="icon-spin" size={16} /> : <Trash size={16} />}{selectedUser.id === selfId ? "Current account" : "Delete user"}
              </motion.button>
            </div>
          </motion.aside>
        ) : <aside className={styles.inspectorEmpty}>Select a user to inspect their access.</aside>}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.button type="button" className={styles.toast} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} onClick={() => setNotice(null)}>
            <Check size={18} weight="bold" /><span>{notice}</span><X size={15} />
          </motion.button>
        )}
      </AnimatePresence>
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
