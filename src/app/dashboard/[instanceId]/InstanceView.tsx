"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileText, Flag, LockKey, Notebook, Play, Stop, TerminalWindow } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import { apiFetch, type InstanceOverview, type StageView } from "@/components/api-types";
import FindingsTab from "./FindingsTab";
import NotebookTab from "./NotebookTab";
import StagePanel from "./StagePanel";
import Terminal from "./Terminal";
import { firstAccessibleStage, stageTone } from "./stage-ui";

type WorkspaceTab = "challenge" | "notebook" | "findings" | "terminal";

const POLL_MS = 5000;
const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { id: "challenge", label: "Challenge", icon: FileText },
  { id: "notebook", label: "Notebook", icon: Notebook },
  { id: "findings", label: "Findings", icon: Flag },
  { id: "terminal", label: "Terminal", icon: TerminalWindow },
];

export default function InstanceView({ instanceId }: { instanceId: string }) {
  const [overview, setOverview] = useState<InstanceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("terminal");
  const [envBusy, setEnvBusy] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<InstanceOverview>(`/api/campaign-instances/${instanceId}`);
      setOverview(data);
      setError(null);
      setSelectedSlug((previous) => {
        if (previous && data.stages.some((stage) => stage.slug === previous)) return previous;
        return firstAccessibleStage(data.stages);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load campaign instance");
    }
  }, [instanceId]);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  async function runEnvAction(action: "start" | "stop" | "reset") {
    setEnvBusy(action);
    setEnvError(null);
    try {
      await apiFetch(`/api/campaign-instances/${instanceId}/environment/${action}`, { method: "POST" });
      await load();
    } catch (actionError) {
      setEnvError(actionError instanceof Error ? actionError.message : `Failed to ${action} environment`);
    } finally {
      setEnvBusy(null);
    }
  }

  if (error && !overview) return <main className="campaign-loading campaign-loading--error">{error}</main>;

  if (!overview) {
    return (
      <main className="campaign-loading" aria-busy="true">
        <span className="campaign-loading__pulse" /> Preparing campaign workspace…
      </main>
    );
  }

  const selectedStage: StageView | undefined = overview.stages.find((stage) => stage.slug === selectedSlug);
  const selectedStagePosition = Math.max(overview.stages.findIndex((stage) => stage.slug === selectedSlug) + 1, 1);
  const environmentStatus = overview.environment?.status ?? "PENDING";
  const environmentRunning = environmentStatus === "RUNNING";

  return (
    <main className="campaign-shell">
      <motion.section className="campaign-command" initial={reduceMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="campaign-command__identity">
          <h1>{overview.campaign.name}</h1>
          <span>v{overview.campaign.version}</span>
          <span className="campaign-live"><i />{overview.status.replace(/_/g, " ")}</span>
        </div>
        <div className="campaign-command__progress">
          <div><strong>{selectedStagePosition} / {overview.progress.total}</strong><span>stages</span></div>
          <ProgressBar value={selectedStagePosition} max={overview.progress.total} />
        </div>
        <div className="campaign-command__score"><span>Score</span><strong>{overview.score}</strong></div>
        <div className="campaign-command__environment">
          <div className="environment-readout">
            <span>Environment</span>
            <strong className={environmentRunning ? "is-running" : ""}><i />{environmentStatus}</strong>
          </div>
          <div className="environment-actions">
            <Button variant="ghost" disabled={environmentRunning} busy={envBusy === "start"} onClick={() => runEnvAction("start")}>
              <Play size={14} weight="fill" /> Start
            </Button>
            <Button variant="ghost" disabled={!environmentRunning} busy={envBusy === "stop"} onClick={() => runEnvAction("stop")}>
              <Stop size={14} weight="fill" /> Stop
            </Button>
            <Button variant="ghost" busy={envBusy === "reset"} onClick={() => runEnvAction("reset")}>Reset</Button>
          </div>
        </div>
      </motion.section>

      {envError && <motion.p className="campaign-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert">{envError}</motion.p>}

      <section className="stage-timeline" aria-label="Campaign stages">
        {overview.stages.map((stage, index) => {
          const selected = stage.slug !== null && stage.slug === selectedSlug;
          const tone = stageTone(stage, selected);
          const locked = tone === "locked";
          return (
            <motion.button
              key={stage.slug ?? `locked-${index}`}
              className={`stage-step stage-step--${tone}`}
              disabled={locked}
              onClick={() => stage.slug && setSelectedSlug(stage.slug)}
              aria-current={selected ? "step" : undefined}
              whileHover={locked || reduceMotion ? undefined : { y: -2 }}
              whileTap={locked || reduceMotion ? undefined : { scale: 0.98 }}
            >
              <span className="stage-step__track" aria-hidden="true" />
              <motion.span
                className="stage-step__marker"
                animate={tone === "active" && !reduceMotion ? { scale: [1, 1.12, 1] } : undefined}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {tone === "complete" ? <Check size={13} weight="bold" /> : locked ? <LockKey size={12} /> : null}
              </motion.span>
              <span className="stage-step__number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{stage.title}</strong>
              <small>{tone === "complete" ? "Complete" : tone === "active" ? "In progress" : locked ? "Locked" : "Ready"}</small>
            </motion.button>
          );
        })}
      </section>

      <nav className="workspace-tabs" aria-label="Campaign tools">
        {WORKSPACE_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            <Icon size={19} weight={tab === id ? "bold" : "regular"} /> {label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={tab}
          className={`campaign-workspace campaign-workspace--${tab}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {tab === "challenge" && (selectedStage ? (
            <StagePanel position={selectedStagePosition} total={overview.stages.length} instanceId={instanceId} stage={selectedStage} onGraded={load} onOpenNotebook={() => setTab("notebook")} />
          ) : <div className="campaign-empty">No stage is available yet.</div>)}

          {tab === "terminal" && (
            <>
              <div className="campaign-workspace__challenge">
                {selectedStage ? (
                  <StagePanel compact position={selectedStagePosition} total={overview.stages.length} instanceId={instanceId} stage={selectedStage} onGraded={load} onOpenNotebook={() => setTab("notebook")} />
                ) : <div className="campaign-empty">No stage is available yet.</div>}
              </div>
              <div className="campaign-workspace__utility"><Terminal instanceId={instanceId} envStatus={environmentStatus} /></div>
            </>
          )}

          {tab === "notebook" && <NotebookTab instanceId={instanceId} />}
          {tab === "findings" && <FindingsTab instanceId={instanceId} />}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}
