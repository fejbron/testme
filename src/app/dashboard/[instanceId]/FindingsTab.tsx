"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import { apiFetch, type Finding } from "@/components/api-types";

export default function FindingsTab({ instanceId }: { instanceId: string }) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ findings: Finding[] }>(`/api/campaign-instances/${instanceId}/findings`)
      .then((d) => setFindings(d.findings))
      .catch((e: Error) => setError(e.message));
  }, [instanceId]);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!findings) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (findings.length === 0) return <p style={{ color: "var(--muted)" }}>No findings recorded yet. Add one from a stage panel.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {findings.map((f) => (
        <Panel
          key={f.id}
          title={`${f.findingType} · ${f.confidence}`}
          right={<span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(f.createdAt).toLocaleString()}</span>}
        >
          <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>{f.title}</h4>
          {f.explanation && <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{f.explanation}</p>}
          {Object.keys(f.structuredDataJson ?? {}).length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--muted)" }}>
              {Object.entries(f.structuredDataJson).map(([k, v]) => (
                <li key={k}>
                  {k}: {String(v)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
    </div>
  );
}
