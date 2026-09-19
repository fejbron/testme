type Tone = "neutral" | "good" | "bad" | "warn" | "muted";

const GOOD = new Set(["COMPLETED", "PASSED", "RUNNING", "READY", "SUCCEEDED", "ACTIVE"]);
const BAD = new Set(["FAILED", "ERROR", "STOPPED", "REJECTED"]);
const WARN = new Set(["IN_PROGRESS", "STARTING", "STOPPING", "PENDING", "AVAILABLE", "GRADING"]);
const MUTED = new Set(["LOCKED", "NOT_STARTED", "IDLE"]);

function toneFor(status: string): Tone {
  const s = status.toUpperCase();
  if (GOOD.has(s)) return "good";
  if (BAD.has(s)) return "bad";
  if (WARN.has(s)) return "warn";
  if (MUTED.has(s)) return "muted";
  return "neutral";
}

const TONE_STYLES: Record<Tone, React.CSSProperties> = {
  good: { color: "#04110e", background: "var(--accent)", borderColor: "var(--accent)" },
  bad: { color: "#2a0808", background: "var(--danger)", borderColor: "var(--danger)" },
  warn: { color: "#241a04", background: "#e0a63e", borderColor: "#e0a63e" },
  muted: { color: "var(--muted)", background: "transparent", borderColor: "var(--border)" },
  neutral: { color: "var(--fg)", background: "transparent", borderColor: "var(--border)" },
};

export default function StatusPill({ status, label, tone }: { status: string; label?: string; tone?: Tone }) {
  const t = tone ?? toneFor(status);
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...TONE_STYLES[t],
      }}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
