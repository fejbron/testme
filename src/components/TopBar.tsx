export default function TopBar({
  userName,
  roleLabel,
  right,
}: {
  userName: string;
  roleLabel?: string;
  right?: React.ReactNode;
}) {
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
        <span style={{ color: "var(--accent)", letterSpacing: 3, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>CYBER RANGE</span>
        {roleLabel && <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{roleLabel}</span>}
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
