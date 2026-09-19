import Link from "next/link";

export default function TopBar({
  userName,
  roleLabel,
  role,
  right,
}: {
  userName: string;
  roleLabel?: string;
  role?: "STUDENT" | "INSTRUCTOR" | "AUTHOR" | "ADMIN";
  right?: React.ReactNode;
}) {
  const links: { href: string; label: string }[] = [];
  if (role) links.push({ href: "/dashboard", label: "Dashboard" });
  if (role === "INSTRUCTOR" || role === "ADMIN") links.push({ href: "/instructor", label: "Instructor" });
  if (role === "ADMIN") links.push({ href: "/admin", label: "Admin" });
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
        <span className="mono" style={{ color: "var(--fg-strong)", letterSpacing: "-0.02em", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>▚ testme</span>
        {roleLabel && <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{roleLabel}</span>}
        {links.length > 1 && (
          <nav style={{ display: "flex", gap: 12, marginLeft: 6 }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: "var(--muted)", fontSize: 13 }}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {right}
        <span style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{userName}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 6,
              background: "transparent",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
