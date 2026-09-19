"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusPill from "@/components/StatusPill";
import {
  apiFetch,
  type ArtifactRow,
  type CodeLanguage,
  type HintRow,
  type StageView,
  type SubmissionView,
} from "@/components/api-types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--fg)",
  fontFamily: "inherit",
  fontSize: 13,
};

const SUGGESTED_FINDING_KEYS = ["lengthFieldOffset", "lengthFieldWidth", "lengthFieldEndian", "msgTypeOffset", "seqOffset", "checksumKind"];

type KVRow = { key: string; value: string };

function KeyValueEditor({ rows, onChange, suggestions }: { rows: KVRow[]; onChange: (rows: KVRow[]) => void; suggestions?: string[] }) {
  function update(i: number, patch: Partial<KVRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      {suggestions && suggestions.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>Suggested keys: {suggestions.join(", ")}</p>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input style={inputStyle} placeholder="key" value={r.key} onChange={(e) => update(i, { key: e.target.value })} />
          <input style={inputStyle} placeholder="value" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
          <Button variant="ghost" onClick={() => remove(i)} type="button">
            ×
          </Button>
        </div>
      ))}
      <Button variant="ghost" type="button" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        + Add field
      </Button>
    </div>
  );
}

export default function StagePanel({
  instanceId,
  stage,
  onGraded,
  onOpenNotebook,
}: {
  instanceId: string;
  stage: StageView;
  onGraded: () => void;
  onOpenNotebook: () => void;
}) {
  const cid = stage.challengeInstanceId;

  const [artifacts, setArtifacts] = useState<ArtifactRow[] | null>(null);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [hints, setHints] = useState<HintRow[] | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState<string | null>(null);

  const [valueInput, setValueInput] = useState("");
  const [fieldRows, setFieldRows] = useState<KVRow[]>([{ key: "", value: "" }]);
  const [codeText, setCodeText] = useState("");
  const [codeLang, setCodeLang] = useState<CodeLanguage>("python");
  const [entrypoint, setEntrypoint] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<SubmissionView | null>(null);

  const [findingType, setFindingType] = useState("");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingExplanation, setFindingExplanation] = useState("");
  const [findingConfidence, setFindingConfidence] = useState("MEDIUM");
  const [findingRows, setFindingRows] = useState<KVRow[]>([{ key: "", value: "" }]);
  const [findingBusy, setFindingBusy] = useState(false);
  const [findingMsg, setFindingMsg] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    setValueInput("");
    setFieldRows([{ key: "", value: "" }]);
    setCodeText("");
    setEntrypoint("");
    setLastSubmission(null);
    setSubmitError(null);
    setArtifacts(null);
    setHints(null);
    setFindingMsg(null);

    if (cid) {
      apiFetch<{ artifacts: ArtifactRow[] }>(`/api/challenge-instances/${cid}/artifacts`)
        .then((d) => !cancelled.current && setArtifacts(d.artifacts))
        .catch((e: Error) => !cancelled.current && setArtifactsError(e.message));
      apiFetch<{ hints: HintRow[] }>(`/api/challenge-instances/${cid}/hints`)
        .then((d) => !cancelled.current && setHints(d.hints))
        .catch((e: Error) => !cancelled.current && setHintError(e.message));
    }
    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [cid]);

  function pollSubmission(id: string) {
    apiFetch<SubmissionView>(`/api/submissions/${id}`)
      .then((s) => {
        if (cancelled.current) return;
        setLastSubmission(s);
        if (s.status === "PENDING" || s.status === "GRADING") {
          pollTimer.current = setTimeout(() => pollSubmission(id), 1500);
        } else {
          setSubmitting(false);
          onGraded();
        }
      })
      .catch((e: Error) => {
        if (cancelled.current) return;
        setSubmitError(e.message);
        setSubmitting(false);
      });
  }

  function startSubmit(body: { submissionId: string } | Promise<{ submissionId: string }>) {
    setSubmitting(true);
    setSubmitError(null);
    setLastSubmission(null);
    Promise.resolve(body)
      .then((res) => pollSubmission(res.submissionId))
      .catch((e: Error) => {
        setSubmitError(e.message);
        setSubmitting(false);
      });
  }

  async function reveal(hint: HintRow) {
    if (!cid) return;
    if (!window.confirm(`Reveal hint L${hint.level} for -${hint.penalty} pts?`)) return;
    setRevealBusy(hint.id);
    try {
      await apiFetch<{ content: string; penaltyApplied: number; alreadyUsed: boolean }>(`/api/challenge-instances/${cid}/hints/${hint.id}/use`, {
        method: "POST",
      });
      const d = await apiFetch<{ hints: HintRow[] }>(`/api/challenge-instances/${cid}/hints`);
      setHints(d.hints);
    } catch (e) {
      setHintError(e instanceof Error ? e.message : "failed to reveal hint");
    } finally {
      setRevealBusy(null);
    }
  }

  async function submitFinding() {
    if (!cid) return;
    setFindingBusy(true);
    setFindingMsg(null);
    try {
      const structuredData: Record<string, string> = {};
      for (const r of findingRows) if (r.key.trim()) structuredData[r.key.trim()] = r.value;
      await apiFetch(`/api/challenge-instances/${cid}/findings`, {
        method: "POST",
        body: JSON.stringify({
          findingType: findingType || "OBSERVATION",
          title: findingTitle || "Untitled finding",
          structuredData,
          explanation: findingExplanation,
          confidence: findingConfidence,
        }),
      });
      setFindingMsg("Finding saved.");
      setFindingType("");
      setFindingTitle("");
      setFindingExplanation("");
      setFindingRows([{ key: "", value: "" }]);
    } catch (e) {
      setFindingMsg(e instanceof Error ? e.message : "failed to save finding");
    } finally {
      setFindingBusy(false);
    }
  }

  if (!cid) {
    return (
      <Panel>
        <p style={{ color: "var(--muted)", margin: 0 }}>This stage is locked.</p>
      </Panel>
    );
  }

  const feedback = lastSubmission?.feedback;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Panel
        title="Stage"
        right={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <StatusPill status={stage.status} />
            {stage.points !== null && <span style={{ fontSize: 12, color: "var(--muted)" }}>{stage.points} pts</span>}
          </div>
        }
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{stage.title}</h3>
        {stage.description && <p style={{ margin: "0 0 6px", fontSize: 13, lineHeight: 1.5 }}>{stage.description}</p>}
        {stage.completionType && (
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
            Completion type: <strong>{stage.completionType}</strong> · Score awarded: {stage.scoreAwarded}
          </p>
        )}
      </Panel>

      <Panel title="Artifacts">
        {artifactsError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{artifactsError}</p>}
        {!artifacts ? (
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Loading…</p>
        ) : artifacts.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>No artifacts for this stage.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {artifacts.map((a) => (
              <div
                key={a.slug}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div>
                    <strong>{a.slug}</strong> <span style={{ color: "var(--muted)" }}>({a.kind})</span>
                  </div>
                  {a.ready ? (
                    <div style={{ color: "var(--muted)" }}>
                      {a.sizeBytes} bytes · {a.sha256?.slice(0, 12)}…
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>Not ready yet — try refreshing shortly.</div>
                  )}
                </div>
                {a.ready && a.id ? (
                  <a href={`/api/artifacts/${a.id}/download`} style={{ fontSize: 12 }}>
                    Download
                  </a>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      apiFetch<{ artifacts: ArtifactRow[] }>(`/api/challenge-instances/${cid}/artifacts`).then((d) => setArtifacts(d.artifacts))
                    }
                  >
                    Refresh
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Submission">
        {stage.completionType === "VALUE" && (
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} placeholder="answer value" value={valueInput} onChange={(e) => setValueInput(e.target.value)} />
            <Button
              variant="primary"
              busy={submitting}
              onClick={() =>
                startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/value`, { method: "POST", body: JSON.stringify({ value: valueInput }) }))
              }
            >
              Submit
            </Button>
          </div>
        )}

        {stage.completionType === "FINDING" && (
          <div>
            <KeyValueEditor rows={fieldRows} onChange={setFieldRows} suggestions={SUGGESTED_FINDING_KEYS} />
            <div style={{ marginTop: 10 }}>
              <Button
                variant="primary"
                busy={submitting}
                onClick={() => {
                  const fields: Record<string, string> = {};
                  for (const r of fieldRows) if (r.key.trim()) fields[r.key.trim()] = r.value;
                  startSubmit(
                    apiFetch(`/api/challenge-instances/${cid}/submissions/finding`, { method: "POST", body: JSON.stringify({ fields }) }),
                  );
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        )}

        {stage.completionType === "CODE" && (
          <div>
            <select style={{ ...inputStyle, width: "auto", marginBottom: 8 }} value={codeLang} onChange={(e) => setCodeLang(e.target.value as CodeLanguage)}>
              <option value="python">python</option>
              <option value="c">c</option>
              <option value="javascript">javascript</option>
            </select>
            <textarea
              style={{ ...inputStyle, minHeight: 200, fontSize: 12, resize: "vertical", marginBottom: 8 }}
              placeholder="source code"
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
            />
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="entrypoint (optional)"
              value={entrypoint}
              onChange={(e) => setEntrypoint(e.target.value)}
            />
            <Button
              variant="primary"
              busy={submitting}
              onClick={() =>
                startSubmit(
                  apiFetch(`/api/challenge-instances/${cid}/submissions/code`, {
                    method: "POST",
                    body: JSON.stringify({ language: codeLang, sourceText: codeText, entrypoint: entrypoint || undefined }),
                  }),
                )
              }
            >
              Submit
            </Button>
          </div>
        )}

        {stage.completionType === "ENVIRONMENT_STATE" && (
          <Button
            variant="primary"
            busy={submitting}
            onClick={() => startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/environment-check`, { method: "POST" }))}
          >
            Run environment check
          </Button>
        )}

        {submitError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{submitError}</p>}

        {lastSubmission && (
          <div style={{ marginTop: 12, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <StatusPill status={lastSubmission.status} />
              {typeof lastSubmission.scoreAwarded === "number" && <span style={{ fontSize: 12, color: "var(--muted)" }}>score: {lastSubmission.scoreAwarded}</span>}
            </div>
            {feedback && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {feedback.summary && <p style={{ margin: "0 0 6px" }}>{feedback.summary}</p>}
                {typeof feedback.score === "number" && typeof feedback.maxScore === "number" && (
                  <p style={{ margin: "0 0 6px" }}>
                    {feedback.score}/{feedback.maxScore}
                  </p>
                )}
                {feedback.categories && Object.keys(feedback.categories).length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {Object.entries(feedback.categories).map(([k, v]) => (
                      <li key={k}>
                        {k}: {String(v)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Hints">
        {hintError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{hintError}</p>}
        {!hints ? (
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Loading…</p>
        ) : hints.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>No hints for this stage.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hints.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div>
                    L{h.level} · −{h.penalty} pts
                  </div>
                  {h.used && h.content && <div style={{ color: "var(--muted)", marginTop: 4 }}>{h.content}</div>}
                </div>
                {!h.used && (
                  <Button variant="ghost" busy={revealBusy === h.id} onClick={() => reveal(h)}>
                    Reveal (−{h.penalty})
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Add finding"
        right={
          <Button variant="ghost" onClick={onOpenNotebook}>
            Open notebook
          </Button>
        }
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input style={inputStyle} placeholder="finding type" value={findingType} onChange={(e) => setFindingType(e.target.value)} />
          <input style={inputStyle} placeholder="title" value={findingTitle} onChange={(e) => setFindingTitle(e.target.value)} />
          <select style={{ ...inputStyle, width: 130 }} value={findingConfidence} onChange={(e) => setFindingConfidence(e.target.value)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <textarea
          style={{ ...inputStyle, minHeight: 60, marginBottom: 8 }}
          placeholder="explanation"
          value={findingExplanation}
          onChange={(e) => setFindingExplanation(e.target.value)}
        />
        <KeyValueEditor rows={findingRows} onChange={setFindingRows} />
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="primary" busy={findingBusy} onClick={submitFinding}>
            Save finding
          </Button>
          {findingMsg && <span style={{ fontSize: 12, color: "var(--muted)" }}>{findingMsg}</span>}
        </div>
      </Panel>
    </div>
  );
}
