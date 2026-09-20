"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Books,
  Check,
  CheckCircle,
  Circle,
  ClockCounterClockwise,
  FileText,
  Flag,
  Gauge,
  NotePencil,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Warning,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import StatusPill from "@/components/StatusPill";
import { apiFetch, type StudentDetailView } from "@/components/api-types";
import { type ResetMode, type StudentSectionId, validateReset, validateScoreAdjustment } from "./student-detail-ui";
import styles from "./student-detail.module.css";

type RefreshHandler = (message: string) => void;

const sections: { id: StudentSectionId; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "stages", label: "Stages", icon: Flag },
  { id: "submissions", label: "Submissions", icon: FileText },
  { id: "notes", label: "Notes & findings", icon: NotePencil },
  { id: "timeline", label: "Timeline", icon: ClockCounterClockwise },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
}

function EmptyState({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>;
}

function StudentHeader({ data }: { data: StudentDetailView }) {
  const completed = data.stages.filter((stage) => /complete|passed/i.test(stage.status)).length;
  const percent = data.stages.length ? Math.round((completed / data.stages.length) * 100) : 0;

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.identity}>
          <div className={styles.avatar}>{initials(data.student.name)}</div>
          <div>
            <h1>{data.student.name}<span className={styles.active}><Circle size={8} weight="fill" /> {data.status}</span></h1>
            <p>{data.student.email} · Student record</p>
          </div>
        </div>
        <div className={styles.progress}>
          <span>{completed} / {data.stages.length} stages</span>
          <div className={styles.progressTrack} aria-label={`${percent}% complete`}><i style={{ width: `${percent}%` }} /></div>
          <span>{percent}%</span>
        </div>
      </div>
      <div className={styles.summary}>
        <div><span>Campaign</span><strong>{data.campaign}</strong></div>
        <div><span>Score</span><strong>{data.score}</strong></div>
        <div><span>Environment</span><strong>{data.environment?.status ?? "PENDING"}</strong></div>
      </div>
    </header>
  );
}

function StudentSectionNav({ active, onChange }: { active: StudentSectionId; onChange: (section: StudentSectionId) => void }) {
  return (
    <nav className={styles.nav} role="tablist" aria-label="Student record sections">
      {sections.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" id={`student-tab-${id}`} aria-selected={active === id} aria-controls={`student-panel-${id}`} onClick={() => onChange(id)}>
          <Icon size={16} aria-hidden="true" /> {label}
        </button>
      ))}
    </nav>
  );
}

function OverviewSection({ data }: { data: StudentDetailView }) {
  return (
    <>
      <div className={styles.sectionTitle}><div><span className={styles.sectionEyebrow}>Current state</span><h2>Campaign overview</h2></div><span>{data.stages.length} stages recorded</span></div>
      <div className={styles.overviewGrid}>
        <section className={styles.infoBlock}>
          <div className={styles.statusLine}><ShieldCheck size={17} /> Environment {data.environment?.status ?? "PENDING"}</div>
          <h3>{data.environment?.ref || "Environment reference pending"}</h3>
          <p>The current execution environment and campaign workspace assigned to this learner.</p>
        </section>
        <section className={styles.infoBlock}>
          <span className={styles.metricLabel}>Score by category</span>
          {data.byCategory.length ? <ul className={styles.categoryList}>{data.byCategory.map((item) => <li key={item.category}><span>{item.category}</span><b>{item.total}</b></li>)}</ul> : <EmptyState>No category scores recorded yet.</EmptyState>}
        </section>
        <section className={styles.infoBlock}>
          <span className={styles.metricLabel}>Record coverage</span>
          <h3>{data.submissions.length} submissions</h3>
          <p>{data.notebook.length} notes · {data.findings.length} findings · {data.evidence.length} evidence records</p>
        </section>
        <section className={styles.infoBlock}>
          <span className={styles.metricLabel}>Campaign status</span>
          <h3><StatusPill status={data.status} /></h3>
          <p>Use the record sections to inspect learner work, stage history, and instructor actions.</p>
        </section>
      </div>
    </>
  );
}

function StagesSection({ data }: { data: StudentDetailView }) {
  return (
    <>
      <div className={styles.sectionTitle}><div><span className={styles.sectionEyebrow}>Progress</span><h2>Stage record</h2></div><span>{data.stages.length} total</span></div>
      {data.stages.length ? (
        <div className={styles.list}>
          <div className={styles.tableHead}><span>No.</span><span>Stage</span><span>Status</span><span>Score</span><span>Attempts</span></div>
          {data.stages.map((stage, index) => (
            <div className={styles.stageRow} key={stage.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.stageTitle}><strong>{stage.title}</strong><small>{stage.slug}</small></div>
              <span className={styles.statusText}>{/complete|passed/i.test(stage.status) ? <CheckCircle size={16} weight="fill" /> : <Circle size={16} />} {stage.status.toLowerCase().replaceAll("_", " ")}</span>
              <span>{stage.score}</span>
              <span>{stage.attempts}</span>
            </div>
          ))}
        </div>
      ) : <EmptyState>No stages are available for this campaign instance.</EmptyState>}
    </>
  );
}

function ScoreAdjustForm({ submissionId, onDone }: { submissionId: string; onDone: RefreshHandler }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const result = validateScoreAdjustment(delta, reason);
    if ("error" in result) return setError(result.error);
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/instructor/submissions/${submissionId}/score-adjustment`, {
        method: "POST",
        body: JSON.stringify({ delta: result.delta, reason }),
      });
      setOpen(false);
      setDelta("0");
      setReason("");
      onDone("Score adjustment saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to adjust score.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" className={styles.adjustToggle} onClick={() => setOpen(true)}><SlidersHorizontal size={14} /> Adjust score</button>;

  return (
    <div className={styles.adjustForm}>
      <input className={styles.input} value={delta} onChange={(event) => setDelta(event.target.value)} inputMode="numeric" aria-label="Score delta" placeholder="Delta" />
      <input className={styles.input} value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Adjustment reason" placeholder="Reason for this adjustment" />
      <button type="button" className={styles.applyButton} disabled={busy} onClick={submit}>{busy ? "Applying…" : "Apply"}</button>
      <button type="button" className={styles.ghostButton} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      {error ? <p className={styles.actionError} role="alert">{error}</p> : null}
    </div>
  );
}

function SubmissionsSection({ data, onDone }: { data: StudentDetailView; onDone: RefreshHandler }) {
  return (
    <>
      <div className={styles.sectionTitle}><div><span className={styles.sectionEyebrow}>Review queue</span><h2>Submissions</h2></div><span>{data.submissions.length} recorded</span></div>
      {data.submissions.length ? (
        <div className={styles.list}>{data.submissions.map((submission) => (
          <article className={styles.submission} key={submission.id}>
            <div className={styles.submissionTop}>
              <div><strong>{submission.type}</strong> <StatusPill status={submission.status} /></div>
              <div className={styles.submissionMeta}>{submission.score ?? "—"} pts · {new Date(submission.at).toLocaleString()}</div>
            </div>
            {submission.feedback?.summary ? <p className={styles.feedback}>{submission.feedback.summary}</p> : null}
            <ScoreAdjustForm submissionId={submission.id} onDone={onDone} />
          </article>
        ))}</div>
      ) : <EmptyState>No submissions have been recorded for this learner.</EmptyState>}
    </>
  );
}

function NotesSection({ data }: { data: StudentDetailView }) {
  return (
    <>
      <div className={styles.sectionTitle}><div><span className={styles.sectionEyebrow}>Investigation record</span><h2>Notes, findings & evidence</h2></div></div>
      <div className={styles.notesGrid}>
        <section><header className={styles.subsectionHeader}><h3>Notebook</h3><span>{data.notebook.length}</span></header>{data.notebook.length ? data.notebook.map((note) => <article className={styles.noteItem} key={note.id}><strong>{note.title}</strong><small>{note.type}</small><p>{note.content}</p></article>) : <EmptyState>No notebook entries yet.</EmptyState>}</section>
        <section><header className={styles.subsectionHeader}><h3>Findings</h3><span>{data.findings.length}</span></header>{data.findings.length ? data.findings.map((finding) => <article className={styles.noteItem} key={finding.id}><strong>{finding.title}</strong><small>{finding.findingType}</small>{finding.explanation ? <p>{finding.explanation}</p> : null}</article>) : <EmptyState>No findings recorded yet.</EmptyState>}</section>
        <section><header className={styles.subsectionHeader}><h3>Evidence</h3><span>{data.evidence.length}</span></header>{data.evidence.length ? <pre className={styles.evidence}>{JSON.stringify(data.evidence, null, 2)}</pre> : <EmptyState>No evidence recorded yet.</EmptyState>}</section>
      </div>
    </>
  );
}

function TimelineSection({ data }: { data: StudentDetailView }) {
  return (
    <>
      <div className={styles.sectionTitle}><div><span className={styles.sectionEyebrow}>Audit trail</span><h2>Timeline</h2></div><span>{data.timeline.length} events</span></div>
      {data.timeline.length ? <ol className={styles.timeline}>{data.timeline.map((event, index) => <li key={`${event.at}-${index}`}><ClockCounterClockwise size={18} weight="fill" /><strong>{event.type.replaceAll("_", " ").toLowerCase()}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ol> : <EmptyState>No timeline events are available yet.</EmptyState>}
    </>
  );
}

function ResetControls({ instanceId, stages, onDone }: { instanceId: string; stages: StudentDetailView["stages"]; onDone: RefreshHandler }) {
  const [stageSlug, setStageSlug] = useState("");
  const [busy, setBusy] = useState<ResetMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset(mode: ResetMode) {
    const validationError = validateReset(mode, stageSlug);
    if (validationError) return setError(validationError);
    if (!window.confirm(`Reset ${mode} for this student? This cannot be undone.`)) return;
    setBusy(mode);
    setError(null);
    try {
      await apiFetch(`/api/instructor/campaign-instances/${instanceId}/reset`, {
        method: "POST",
        body: JSON.stringify({ mode, stageSlug: mode === "stage" ? stageSlug : undefined }),
      });
      onDone(`${mode[0].toUpperCase()}${mode.slice(1)} reset completed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to reset ${mode}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.danger}>
      <span className={styles.dangerLabel}>Danger area</span>
      <h2>Reset controls</h2>
      <p>Each reset is permanent and requires explicit confirmation.</p>
      <div className={styles.resetGroup}>
        <button type="button" className={styles.dangerButton} disabled={Boolean(busy)} onClick={() => reset("environment")}><Warning size={14} /> {busy === "environment" ? "Resetting…" : "Reset environment"}</button>
        <select className={styles.select} value={stageSlug} onChange={(event) => setStageSlug(event.target.value)} aria-label="Stage to reset"><option value="">Select stage…</option>{stages.map((stage) => <option key={stage.slug} value={stage.slug}>{stage.title}</option>)}</select>
        <button type="button" className={styles.dangerButton} disabled={Boolean(busy)} onClick={() => reset("stage")}><Warning size={14} /> {busy === "stage" ? "Resetting…" : "Reset selected stage"}</button>
        <button type="button" className={styles.dangerButton} disabled={Boolean(busy)} onClick={() => reset("progress")}><Warning size={14} /> {busy === "progress" ? "Resetting…" : "Reset all progress"}</button>
      </div>
      {error ? <p className={styles.resetError} role="alert">{error}</p> : null}
    </section>
  );
}

export default function StudentDetail({ instanceId }: { instanceId: string }) {
  const [data, setData] = useState<StudentDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<StudentSectionId>("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<StudentDetailView>(`/api/instructor/instances/${instanceId}`);
      setData(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load student record.");
    }
  }, [instanceId]);

  useEffect(() => { void load(); }, [load]);

  const onMutationDone = useCallback((message: string) => {
    setNotice(message);
    void load();
  }, [load]);

  const activeContent = useMemo(() => {
    if (!data) return null;
    if (activeSection === "overview") return <OverviewSection data={data} />;
    if (activeSection === "stages") return <StagesSection data={data} />;
    if (activeSection === "submissions") return <SubmissionsSection data={data} onDone={onMutationDone} />;
    if (activeSection === "notes") return <NotesSection data={data} />;
    return <TimelineSection data={data} />;
  }, [activeSection, data, onMutationDone]);

  if (error) return <main className={`${styles.statePage} ${styles.errorState}`}><p role="alert">{error}</p></main>;
  if (!data) return <main className={styles.statePage}><p>Loading student case file…</p></main>;

  return (
    <main className={styles.page}>
      <Link href="/instructor" className={styles.breadcrumb}><ArrowLeft size={14} /> Instructor / students / {data.student.name}</Link>
      <StudentHeader data={data} />
      <div className={styles.layout}>
        <section className={styles.record}>
          <StudentSectionNav active={activeSection} onChange={setActiveSection} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSection}
              id={`student-panel-${activeSection}`}
              role="tabpanel"
              aria-labelledby={`student-tab-${activeSection}`}
              className={styles.panel}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
              transition={{ duration: .18 }}
            >
              {activeContent}
            </motion.div>
          </AnimatePresence>
        </section>
        <aside className={styles.aside}>
          <section className={styles.asideSection}>
            <span className={styles.sectionEyebrow}>Student details</span>
            <h2><User size={18} /> Record identity</h2>
            <dl className={styles.detailList}>
              <div><dt>Full name</dt><dd>{data.student.name}</dd></div>
              <div><dt>Email</dt><dd>{data.student.email}</dd></div>
              <div><dt>Campaign</dt><dd>{data.campaign}</dd></div>
              <div><dt>Status</dt><dd>{data.status}</dd></div>
            </dl>
          </section>
          <ResetControls instanceId={instanceId} stages={data.stages} onDone={onMutationDone} />
        </aside>
      </div>
      <AnimatePresence>{notice ? <motion.button type="button" className={styles.notice} onClick={() => setNotice(null)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><Check size={17} weight="bold" /><span>{notice}</span><X size={15} /></motion.button> : null}</AnimatePresence>
    </main>
  );
}
