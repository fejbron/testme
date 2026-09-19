"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import { apiFetch, type NotebookEntry, type NotebookType } from "@/components/api-types";

const TYPES: NotebookType[] = ["OBSERVATION", "HYPOTHESIS", "EXPERIMENT", "RESULT", "CONCLUSION", "NOTE"];

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

export default function NotebookTab({ instanceId }: { instanceId: string }) {
  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<NotebookType>("NOTE");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confidence, setConfidence] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  function load() {
    apiFetch<{ entries: NotebookEntry[] }>(`/api/campaign-instances/${instanceId}/notebook`)
      .then((d) => setEntries(d.entries))
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [instanceId]);

  async function onCreate() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/campaign-instances/${instanceId}/notebook`, {
        method: "POST",
        body: JSON.stringify({ type, title, content, confidence }),
      });
      setTitle("");
      setContent("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to create entry");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry: NotebookEntry) {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/api/notebook/${id}`, { method: "PATCH", body: JSON.stringify({ title: editTitle, content: editContent }) });
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to update entry");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this notebook entry?")) return;
    try {
      await apiFetch(`/api/notebook/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to delete entry");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Panel title="New entry">
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: 160 }} value={type} onChange={(e) => setType(e.target.value as NotebookType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select style={{ ...inputStyle, width: 130 }} value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <textarea style={{ ...inputStyle, minHeight: 80, marginBottom: 8 }} placeholder="content" value={content} onChange={(e) => setContent(e.target.value)} />
        <Button variant="primary" busy={busy} onClick={onCreate}>
          Add entry
        </Button>
      </Panel>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {!entries ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No notebook entries yet.</p>
      ) : (
        entries.map((e) => (
          <Panel key={e.id} title={`${e.type} · ${e.confidence}`} right={<span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(e.updatedAt).toLocaleString()}</span>}>
            {editingId === e.id ? (
              <div>
                <input style={{ ...inputStyle, marginBottom: 8 }} value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)} />
                <textarea style={{ ...inputStyle, minHeight: 80, marginBottom: 8 }} value={editContent} onChange={(ev) => setEditContent(ev.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="primary" onClick={() => saveEdit(e.id)}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>{e.title}</h4>
                <p style={{ margin: "0 0 10px", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{e.content}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => startEdit(e)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => remove(e.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        ))
      )}
    </div>
  );
}
