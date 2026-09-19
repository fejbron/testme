"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel";
import ProgressBar from "@/components/ProgressBar";
import StatusPill from "@/components/StatusPill";
import { apiFetch, type OverviewRow } from "@/components/api-types";

export default function InstructorOverview() {
  const router = useRouter();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ students: OverviewRow[] }>("/api/instructor/overview")
      .then((d) => setRows(d.students))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!rows) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "var(--muted)" }}>No student instances yet.</p>;

  return (
    <Panel style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            {["Student", "Campaign", "Progress", "Score", "Environment", "Hints", "Failed", "Last activity"].map((h) => (
              <th key={h} style={{ padding: "10px 12px", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.instanceId}
              onClick={() => router.push(`/instructor/students/${r.instanceId}`)}
              style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
            >
              <td style={{ padding: "10px 12px" }}>
                <div>{r.student.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>{r.student.email}</div>
              </td>
              <td style={{ padding: "10px 12px" }}>
                {r.campaign} <StatusPill status={r.status} />
              </td>
              <td style={{ padding: "10px 12px", minWidth: 120 }}>
                <ProgressBar value={r.progress.completed} max={r.progress.total} />
              </td>
              <td style={{ padding: "10px 12px" }}>{r.score}</td>
              <td style={{ padding: "10px 12px" }}>
                <StatusPill status={r.environment} />
              </td>
              <td style={{ padding: "10px 12px" }}>{r.hintsUsed}</td>
              <td style={{ padding: "10px 12px" }}>{r.failedSubmissions}</td>
              <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{new Date(r.lastActivity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
