export default function Panel({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        ...style,
      }}
    >
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          {title && <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: 0 }}>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
