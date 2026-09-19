"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusPill from "@/components/StatusPill";
import ProgressBar from "@/components/ProgressBar";
import { apiFetch, type InstanceOverview, type StageView } from "@/components/api-types";
import StagePanel from "./StagePanel";
import NotebookTab from "./NotebookTab";
import FindingsTab from "./FindingsTab";
import Terminal from "./Terminal";

type Tab = "stages" | "notebook" | "findings" | "terminal";

const POLL_MS = 5000;

export default function InstanceView({ instanceId }: { instanceId: string }) {
  const [overview, setOverview] = useState<InstanceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stages");
  const [envBusy, setEnvBusy] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<InstanceOverview>(`/api/campaign-instances/${instanceId}`);
      setOverview(data);
      setError(null);
      setSelectedSlug((prev) => {
        if (prev && data.stages.some((s) => s.slug === prev)) return prev;
        const firstUnlocked = data.stages.find((s) => s.status !== "LOCKED");
        return firstUnlocked?.slug ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load campaign instance");
    }
  }, [instanceId]);

  useEffect(() => {
    load();
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
    } catch (e) {
      setEnvError(e instanceof Error ? e.message : `failed to ${action} environment`);
    } finally {
      setEnvBusy(null);
    }
  }

  if (error && !overview) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </main>
    );
  }

  if (!overview) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  const selectedStage: StageView | undefined = overview.stages.find((s) => s.slug === selectedSlug);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 19 }}>{overview.campaign.name}</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
            v{overview.campaign.version} · <StatusPill status={overview.status} />
          </p>
        </div>
        <div style={{ minWidth: 200 }}>
          <ProgressBar value={overview.progress.completed} max={overview.progress.total} label="Stages" />
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Score: <strong style={{ color: "var(--fg)" }}>{overview.score}</strong>
          </p>
        </div>
      </div>

      <Panel
        title="Environment"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill status={overview.environment?.status ?? "PENDING"} />
            <Button variant="primary" busy={envBusy === "start"} onClick={() => runEnvAction("start")}>
              Start
            </Button>
            <Button variant="ghost" busy={envBusy === "stop"} onClick={() => runEnvAction("stop")}>
              Stop
            </Button>
            <Button variant="ghost" busy={envBusy === "reset"} onClick={() => runEnvAction("reset")}>
              Reset
            </Button>
            <Button variant={tab === "terminal" ? "primary" : "ghost"} onClick={() => setTab(tab === "terminal" ? "stages" : "terminal")}>
              {tab === "terminal" ? "Close terminal" : "Open terminal"}
            </Button>
          </div>
        }
        style={{ marginBottom: 12 }}
      >
        {envError && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{envError}</p>}
        {overview.environment?.services && overview.environment.services.length > 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Services: {overview.environment.services.join(", ")}</p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No services reported.</p>
        )}
      </Panel>

      {overview.recentEvents.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "8px 2px",
            marginBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {overview.recentEvents.map((e, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                color: "var(--muted)",
                whiteSpace: "nowrap",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "3px 9px",
              }}
              title={new Date(e.at).toLocaleString()}
            >
              {e.type.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {(["stages", "notebook", "findings", "terminal"] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "stages" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 12, alignItems: "start" }}>
          <Panel title="Stages" style={{ position: "sticky", top: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {overview.stages.map((s, i) => {
                const locked = s.status === "LOCKED";
                const isSelected = s.slug !== null && s.slug === selectedSlug;
                return (
                  <button
                    key={s.slug ?? `locked-${i}`}
                    disabled={locked}
                    onClick={() => s.slug && setSelectedSlug(s.slug)}
                    style={{
                      textAlign: "left",
                      fontFamily: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: isSelected ? "var(--accent)" : "var(--border)",
                      background: isSelected ? "rgba(57,211,187,0.08)" : "transparent",
                      color: locked ? "var(--muted)" : "var(--fg)",
                      cursor: locked ? "default" : "pointer",
                    }}
                  >
                    <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      {locked && "🔒"} {s.title}
                    </span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <StatusPill status={s.status} />
                      {s.points !== null && <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.points} pts</span>}
                      {s.scoreAwarded > 0 && <span style={{ fontSize: 11, color: "var(--accent)" }}>+{s.scoreAwarded}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {selectedStage ? (
            <StagePanel instanceId={instanceId} stage={selectedStage} onGraded={load} onOpenNotebook={() => setTab("notebook")} />
          ) : (
            <Panel>
              <p style={{ color: "var(--muted)", margin: 0 }}>No stage unlocked yet.</p>
            </Panel>
          )}
        </div>
      )}

      {tab === "notebook" && <NotebookTab instanceId={instanceId} />}
      {tab === "findings" && <FindingsTab instanceId={instanceId} />}
      {tab === "terminal" && <Terminal instanceId={instanceId} envStatus={overview.environment?.status ?? "PENDING"} />}
    </main>
  );
}
