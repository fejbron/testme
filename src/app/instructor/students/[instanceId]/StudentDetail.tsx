"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusPill from "@/components/StatusPill";
import { apiFetch, type StudentDetailView } from "@/components/api-types";

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--fg)",
  fontFamily: "inherit",
  fontSize: 12,
};

function ScoreAdjustForm({ submissionId, onDone }: { submissionId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Adjust score
      </Button>
    );
  }

  async function submit() {
    const n = Number(delta);
    if (!Number.isInteger(n) || !reason.trim()) {
      setError("delta must be an integer and reason is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/instructor/submissions/${submissionId}/score-adjustment`, {
        method: "POST",
        body: JSON.stringify({ delta: n, reason }),
      });
      setOpen(false);
      setDelta("0");
      setReason("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to adjust score");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
      <input style={{ ...inputStyle, width: 70 }} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="delta" />
      <input style={{ ...inputStyle, width: 200 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" />
      <Button variant="primary" busy={busy} onClick={submit}>
        Apply
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function StudentDetail({ instanceId }: { instanceId: string }) {
  const [data, setData] = useState<StudentDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [stageSlug, setStageSlug] = useState("");

  function load() {
    apiFetch<StudentDetailView>(`/api/instructor/instances/${instanceId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [instanceId]);

  async function doReset(mode: "environment" | "stage" | "progress") {
    if (mode === "stage" && !stageSlug) {
      setResetError("select a stage first");
      return;
    }
    if (!window.confirm(`Reset ${mode} for this student? This cannot be undone.`)) return;
    setResetBusy(mode);
    setResetError(null);
    try {
      await apiFetch(`/api/instructor/campaign-instances/${instanceId}/reset`, {
        method: "POST",
        body: JSON.stringify({ mode, stageSlug: mode === "stage" ? stageSlug : undefined }),
      });
      load();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : `failed to reset ${mode}`);
    } finally {
      setResetBusy(null);
    }
  }

  if (error) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "16px" }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/instructor" style={{ fontSize: 12 }}>
          ← Back to cohort
        </Link>
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 19 }}>{data.student.name}</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{data.student.email}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13 }}>
            {data.campaign} <StatusPill status={data.status} />
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Score: <strong style={{ color: "var(--fg)" }}>{data.score}</strong>
          </p>
        </div>
      </div>

      <Panel title="Environment" style={{ marginBottom: 12 }}>
        <StatusPill status={data.environment?.status ?? "PENDING"} />
        {data.environment?.ref && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{data.environment.ref}</span>}
      </Panel>

      {data.byCategory.length > 0 && (
        <Panel title="Score by category" style={{ marginBottom: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            {data.byCategory.map((c) => (
              <li key={c.category}>
                {c.category}: {c.total}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Reset controls" style={{ marginBottom: 12 }}>
        {resetError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{resetError}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="danger" busy={resetBusy === "environment"} onClick={() => doReset("environment")}>
            Reset environment
          </Button>
          <select style={inputStyle} value={stageSlug} onChange={(e) => setStageSlug(e.target.value)}>
            <option value="">select stage…</option>
            {data.stages.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.slug}
              </option>
            ))}
          </select>
          <Button variant="danger" busy={resetBusy === "stage"} onClick={() => doReset("stage")}>
            Reset stage
          </Button>
          <Button variant="danger" busy={resetBusy === "progress"} onClick={() => doReset("progress")}>
            Reset progress
          </Button>
        </div>
      </Panel>

      <Panel title="Stages" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.stages.map((s) => (
            <div key={s.slug} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8, flexWrap: "wrap" }}>
              <span>{s.title}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusPill status={s.status} />
                <span style={{ color: "var(--muted)" }}>score {s.score}</span>
                <span style={{ color: "var(--muted)" }}>{s.attempts} attempts</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Submissions" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.submissions.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>No submissions.</p>}
          {data.submissions.map((s) => (
            <div key={s.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                <span>
                  {s.type} <StatusPill status={s.status} />
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {s.score ?? "—"} pts · {new Date(s.at).toLocaleString()}
                </span>
              </div>
              {s.feedback?.summary && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{s.feedback.summary}</p>}
              <ScoreAdjustForm submissionId={s.id} onDone={load} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Notebook" style={{ marginBottom: 12 }}>
        {data.notebook.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>No notebook entries.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.notebook.map((n) => (
              <div key={n.id} style={{ fontSize: 13 }}>
                <strong>{n.title}</strong> <span style={{ color: "var(--muted)" }}>({n.type})</span>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12, whiteSpace: "pre-wrap" }}>{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Findings" style={{ marginBottom: 12 }}>
        {data.findings.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>No findings.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.findings.map((f) => (
              <div key={f.id} style={{ fontSize: 13 }}>
                <strong>{f.title}</strong> <span style={{ color: "var(--muted)" }}>({f.findingType})</span>
                {f.explanation && <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>{f.explanation}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Evidence" style={{ marginBottom: 12 }}>
        {data.evidence.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>No evidence recorded.</p>
        ) : (
          <pre style={{ margin: 0, fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(data.evidence, null, 2)}
          </pre>
        )}
      </Panel>

      <Panel title="Timeline">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.timeline.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>No events yet.</p>}
          {data.timeline.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
              <span>{e.type.replace(/_/g, " ")}</span>
              <span style={{ color: "var(--muted)" }}>{new Date(e.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Panel>
    </main>
  );
}
