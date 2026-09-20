"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, FileText, Lightbulb, Minus, Notebook, Plus } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

const SUGGESTED_FINDING_KEYS = ["lengthFieldOffset", "lengthFieldWidth", "lengthFieldEndian", "msgTypeOffset", "seqOffset", "checksumKind"];
type KVRow = { key: string; value: string };

function KeyValueEditor({ rows, onChange, suggestions }: { rows: KVRow[]; onChange: (rows: KVRow[]) => void; suggestions?: string[] }) {
  function update(index: number, patch: Partial<KVRow>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="field-editor">
      {suggestions?.length ? <p>Suggested keys: {suggestions.join(", ")}</p> : null}
      {rows.map((row, index) => (
        <div className="field-editor__row" key={index}>
          <input className="challenge-input" placeholder="key" value={row.key} onChange={(event) => update(index, { key: event.target.value })} />
          <input className="challenge-input" placeholder="value" value={row.value} onChange={(event) => update(index, { value: event.target.value })} />
          <Button variant="ghost" aria-label="Remove field" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} type="button">
            <Minus size={14} />
          </Button>
        </div>
      ))}
      <Button variant="ghost" type="button" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus size={14} /> Add field
      </Button>
    </div>
  );
}

export default function StagePanel({
  instanceId,
  stage,
  onGraded,
  onOpenNotebook,
  compact = false,
  position,
  total,
}: {
  instanceId: string;
  stage: StageView;
  onGraded: () => void;
  onOpenNotebook: () => void;
  compact?: boolean;
  position?: number;
  total?: number;
}) {
  const cid = stage.challengeInstanceId;
  const reduceMotion = useReducedMotion();
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
        .then((data) => !cancelled.current && setArtifacts(data.artifacts))
        .catch((error: Error) => !cancelled.current && setArtifactsError(error.message));
      apiFetch<{ hints: HintRow[] }>(`/api/challenge-instances/${cid}/hints`)
        .then((data) => !cancelled.current && setHints(data.hints))
        .catch((error: Error) => !cancelled.current && setHintError(error.message));
    }
    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [cid]);

  function pollSubmission(id: string) {
    apiFetch<SubmissionView>(`/api/submissions/${id}`)
      .then((submission) => {
        if (cancelled.current) return;
        setLastSubmission(submission);
        if (submission.status === "PENDING" || submission.status === "GRADING") {
          pollTimer.current = setTimeout(() => pollSubmission(id), 1500);
        } else {
          setSubmitting(false);
          onGraded();
        }
      })
      .catch((error: Error) => {
        if (cancelled.current) return;
        setSubmitError(error.message);
        setSubmitting(false);
      });
  }

  function startSubmit(body: { submissionId: string } | Promise<{ submissionId: string }>) {
    setSubmitting(true);
    setSubmitError(null);
    setLastSubmission(null);
    Promise.resolve(body)
      .then((result) => pollSubmission(result.submissionId))
      .catch((error: Error) => {
        setSubmitError(error.message);
        setSubmitting(false);
      });
  }

  async function reveal(hint: HintRow) {
    if (!cid || !window.confirm(`Reveal hint L${hint.level} for -${hint.penalty} pts?`)) return;
    setRevealBusy(hint.id);
    try {
      await apiFetch(`/api/challenge-instances/${cid}/hints/${hint.id}/use`, { method: "POST" });
      const data = await apiFetch<{ hints: HintRow[] }>(`/api/challenge-instances/${cid}/hints`);
      setHints(data.hints);
    } catch (error) {
      setHintError(error instanceof Error ? error.message : "Failed to reveal hint");
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
      for (const row of findingRows) if (row.key.trim()) structuredData[row.key.trim()] = row.value;
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
    } catch (error) {
      setFindingMsg(error instanceof Error ? error.message : "Failed to save finding");
    } finally {
      setFindingBusy(false);
    }
  }

  if (!cid) return <div className="campaign-empty">This stage is locked.</div>;
  const feedback = lastSubmission?.feedback;
  const nextHint = hints?.find((hint) => !hint.used);

  return (
    <motion.article
      className={`challenge-pane${compact ? " challenge-pane--compact" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <header className="challenge-header">
        <div>
          <p className="challenge-eyebrow">Stage {position ?? "—"}{total ? ` of ${total}` : ""}</p>
          <h2>{stage.title}</h2>
          {stage.description && <p>{stage.description}</p>}
        </div>
        <div className="challenge-score"><span>Stage score</span><strong>{stage.points ?? 0}</strong></div>
      </header>

      <section className="challenge-section">
        <h3>Objective</h3>
        <p>{stage.description || "Complete the required task and submit your result for grading."}</p>
      </section>

      <section className="challenge-section">
        <h3>Artifacts</h3>
        {artifactsError && <p className="challenge-message challenge-message--error">{artifactsError}</p>}
        {!artifacts ? <div className="challenge-skeleton" /> : artifacts.length === 0 ? (
          <p className="challenge-muted">No artifacts are required for this stage.</p>
        ) : (
          <div className="artifact-list">
            {artifacts.map((artifact) => (
              <div className="artifact-row" key={artifact.slug}>
                <span className="artifact-icon" aria-hidden="true"><FileText size={18} /></span>
                <div><strong>{artifact.slug}</strong><span>{artifact.ready ? `${artifact.sizeBytes} bytes · ${artifact.kind}` : "Preparing artifact…"}</span></div>
                {artifact.ready && artifact.id ? (
                  <a className="artifact-download" href={`/api/artifacts/${artifact.id}/download`}><DownloadSimple size={16} /> Download</a>
                ) : (
                  <Button variant="ghost" onClick={() => apiFetch<{ artifacts: ArtifactRow[] }>(`/api/challenge-instances/${cid}/artifacts`).then((data) => setArtifacts(data.artifacts))}>Refresh</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {nextHint && (
        <section className="challenge-hint">
          <div><Lightbulb size={18} /><p><strong>Need a hint?</strong><span>Reveal level {nextHint.level} for −{nextHint.penalty} points.</span></p></div>
          <Button variant="ghost" busy={revealBusy === nextHint.id} onClick={() => reveal(nextHint)}>Show hint</Button>
        </section>
      )}

      <section className="challenge-section challenge-submit">
        <h3>Your submission</h3>
        {stage.completionType === "VALUE" && (
          <div className="submit-row">
            <input className="challenge-input" placeholder="Enter your answer…" value={valueInput} onChange={(event) => setValueInput(event.target.value)} />
            <Button variant="primary" busy={submitting} onClick={() => startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/value`, { method: "POST", body: JSON.stringify({ value: valueInput }) }))}>Submit answer</Button>
          </div>
        )}
        {stage.completionType === "FINDING" && (
          <div><KeyValueEditor rows={fieldRows} onChange={setFieldRows} suggestions={SUGGESTED_FINDING_KEYS} /><Button variant="primary" busy={submitting} onClick={() => {
            const fields: Record<string, string> = {};
            for (const row of fieldRows) if (row.key.trim()) fields[row.key.trim()] = row.value;
            startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/finding`, { method: "POST", body: JSON.stringify({ fields }) }));
          }}>Submit findings</Button></div>
        )}
        {stage.completionType === "CODE" && (
          <div className="code-submit">
            <select className="challenge-input" value={codeLang} onChange={(event) => setCodeLang(event.target.value as CodeLanguage)}><option value="python">Python</option><option value="c">C</option><option value="javascript">JavaScript</option></select>
            <textarea className="challenge-input challenge-code" placeholder="Source code" value={codeText} onChange={(event) => setCodeText(event.target.value)} />
            <input className="challenge-input" placeholder="Entrypoint (optional)" value={entrypoint} onChange={(event) => setEntrypoint(event.target.value)} />
            <Button variant="primary" busy={submitting} onClick={() => startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/code`, { method: "POST", body: JSON.stringify({ language: codeLang, sourceText: codeText, entrypoint: entrypoint || undefined }) }))}>Submit code</Button>
          </div>
        )}
        {stage.completionType === "ENVIRONMENT_STATE" && <Button variant="primary" busy={submitting} onClick={() => startSubmit(apiFetch(`/api/challenge-instances/${cid}/submissions/environment-check`, { method: "POST" }))}>Run environment check</Button>}
        {submitError && <p className="challenge-message challenge-message--error" role="alert">{submitError}</p>}
        <AnimatePresence>
          {lastSubmission && (
            <motion.div className="submission-result" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }}>
              <div><StatusPill status={lastSubmission.status} />{typeof lastSubmission.scoreAwarded === "number" && <span>Score {lastSubmission.scoreAwarded}</span>}</div>
              {feedback?.summary && <p>{feedback.summary}</p>}
              {typeof feedback?.score === "number" && typeof feedback.maxScore === "number" && <p>{feedback.score}/{feedback.maxScore}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <details className="challenge-details">
        <summary>All hints <span>{hints?.filter((hint) => hint.used).length ?? 0}/{hints?.length ?? 0} used</span></summary>
        {hintError && <p className="challenge-message challenge-message--error">{hintError}</p>}
        {!hints ? <div className="challenge-skeleton" /> : hints.length === 0 ? <p className="challenge-muted">No hints for this stage.</p> : hints.map((hint) => (
          <div className="hint-row" key={hint.id}><div><strong>Level {hint.level}</strong><span>−{hint.penalty} points</span>{hint.used && hint.content && <p>{hint.content}</p>}</div>{!hint.used && <Button variant="ghost" busy={revealBusy === hint.id} onClick={() => reveal(hint)}>Reveal</Button>}</div>
        ))}
      </details>

      <details className="challenge-details">
        <summary>Record a finding <span>Save evidence to your case notes</span></summary>
        <div className="finding-form">
          <div className="finding-form__row"><input className="challenge-input" placeholder="Finding type" value={findingType} onChange={(event) => setFindingType(event.target.value)} /><input className="challenge-input" placeholder="Title" value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} /><select className="challenge-input" value={findingConfidence} onChange={(event) => setFindingConfidence(event.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
          <textarea className="challenge-input" placeholder="Explanation" value={findingExplanation} onChange={(event) => setFindingExplanation(event.target.value)} />
          <KeyValueEditor rows={findingRows} onChange={setFindingRows} />
          <div className="finding-form__actions"><Button variant="primary" busy={findingBusy} onClick={submitFinding}>Save finding</Button><Button variant="ghost" onClick={onOpenNotebook}><Notebook size={15} /> Open notebook</Button>{findingMsg && <span>{findingMsg}</span>}</div>
        </div>
      </details>
    </motion.article>
  );
}
