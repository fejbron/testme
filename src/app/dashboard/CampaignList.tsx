"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel";
import ProgressBar from "@/components/ProgressBar";
import StatusPill from "@/components/StatusPill";
import Button from "@/components/Button";
import { apiFetch, type AssignedCampaign } from "@/components/api-types";

export default function CampaignList() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AssignedCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ campaigns: AssignedCampaign[] }>("/api/campaigns/assigned")
      .then((data) => {
        if (!cancelled) setCampaigns(data.campaigns);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onStart(c: AssignedCampaign) {
    setStartingId(c.id);
    try {
      await apiFetch(`/api/campaign-instances/${c.id}/start`, { method: "POST" });
      router.push(`/dashboard/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to start campaign");
      setStartingId(null);
    }
  }

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!campaigns) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (campaigns.length === 0) return <p style={{ color: "var(--muted)" }}>No campaigns assigned yet.</p>;

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {campaigns.map((c) => {
        const started = c.status !== "NOT_STARTED";
        return (
          <Panel key={c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{c.name}</h3>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
                  v{c.version} · {c.difficulty}
                </p>
              </div>
              <StatusPill status={c.status} />
            </div>
            <div style={{ margin: "14px 0" }}>
              <ProgressBar value={c.progress.completed} max={c.progress.total} label="Stages" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Score: <strong style={{ color: "var(--fg)" }}>{c.score}</strong>
              </span>
              {started ? (
                <Button variant="primary" onClick={() => router.push(`/dashboard/${c.id}`)}>
                  Resume
                </Button>
              ) : (
                <Button variant="primary" busy={startingId === c.id} onClick={() => onStart(c)}>
                  Start
                </Button>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
