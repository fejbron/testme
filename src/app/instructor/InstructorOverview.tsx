"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Books, Check, CheckCircle, Circle, Flag, MagnifyingGlass, SpinnerGap, UsersThree, Warning, X } from "@phosphor-icons/react";
import { apiFetch, type OverviewRow } from "@/components/api-types";
import { filterOverviewRows, needsAttention } from "./instructor-ui";
import styles from "./instructor.module.css";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function InstructorOverview() {
  const router = useRouter();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [campaign, setCampaign] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    apiFetch<{ students: OverviewRow[] }>("/api/instructor/overview")
      .then((data) => {
        setRows(data.students);
        setSelectedId((current) => current || data.students[0]?.instanceId || "");
      })
      .catch((caught: Error) => setError(caught.message));
  }

  useEffect(load, []);

  const campaigns = useMemo(() => Array.from(new Set((rows ?? []).map((row) => row.campaign))), [rows]);
  const visibleRows = useMemo(() => filterOverviewRows(rows ?? [], query, campaign, attentionOnly), [rows, query, campaign, attentionOnly]);
  const selected = (rows ?? []).find((row) => row.instanceId === selectedId) ?? visibleRows[0] ?? null;

  async function resetEnvironment() {
    if (!selected || !window.confirm(`Reset ${selected.student.name}'s environment? This cannot be undone.`)) return;
    setResetting(true);
    setError(null);
    try {
      await apiFetch(`/api/instructor/campaign-instances/${selected.instanceId}/reset`, { method: "POST", body: JSON.stringify({ mode: "environment" }) });
      setNotice(`${selected.student.name}'s environment was reset.`);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to reset environment.");
    } finally {
      setResetting(false);
    }
  }

  if (error && !rows) return <div className={styles.state}><Warning size={20} />{error}</div>;
  if (!rows) return <div className={styles.state}><SpinnerGap className="icon-spin" size={20} />Loading cohort watchtower…</div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="Campaign scope">
        <div className={styles.railLabel}>Instructor</div>
        <button type="button" className={campaign === "all" ? styles.railActive : styles.railItem} onClick={() => setCampaign("all")}>
          <UsersThree size={20} weight={campaign === "all" ? "fill" : "regular"} /><span>All students</span><b>{rows.length}</b>
        </button>
        {campaigns.map((name, index) => (
          <button type="button" key={name} className={campaign === name ? styles.railActive : styles.railItem} onClick={() => setCampaign(name)}>
            {index % 2 ? <Flag size={20} /> : <Books size={20} />}<span>{name}</span><b>{rows.filter((row) => row.campaign === name).length}</b>
          </button>
        ))}
        <div className={styles.online}><span />System online</div>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.heading}>
          <div><p>INSTRUCTOR / COHORT WATCHTOWER</p><h1>Cohort Watchtower</h1><span>Monitor campaign progress, identify students who need help, and take action.</span></div>
          <time dateTime="2026-09-20">Sep 20, 2026</time>
        </header>

        <div className={styles.content}>
          <section className={styles.roster}>
            <div className={styles.toolbar}>
              <label><MagnifyingGlass size={18} /><input aria-label="Search students" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students by name or email…" /></label>
              <select aria-label="Campaign" value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="all">All campaigns</option>{campaigns.map((name) => <option key={name}>{name}</option>)}</select>
              <button type="button" className={attentionOnly ? styles.filterActive : styles.filter} onClick={() => setAttentionOnly((value) => !value)}><Warning size={16} />At risk only</button>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.tableHeader}><span>Student</span><span>Campaign</span><span>Progress</span><span>Score</span><span>Environment</span><span>Hints</span><span>Failed</span><span>Last activity</span><span /></div>
            <div className={styles.rows}>
              {visibleRows.map((row) => (
                <motion.button layout type="button" key={row.instanceId} onClick={() => setSelectedId(row.instanceId)} className={selected?.instanceId === row.instanceId ? styles.rowActive : styles.row} whileHover={{ x: 2 }}>
                  <span className={styles.student}><i>{initials(row.student.name)}</i><span><strong>{row.student.name}</strong><small>{row.student.email}</small></span></span>
                  <span>{row.campaign}</span>
                  <span className={styles.progress}><b>{row.progress.completed} / {row.progress.total}</b><i><motion.span initial={{ width: 0 }} animate={{ width: `${row.progress.total ? row.progress.completed / row.progress.total * 100 : 0}%` }} /></i></span>
                  <strong>{row.score}</strong>
                  <span className={`${styles.environment} ${needsAttention(row) ? styles.environmentWarn : ""}`}><i />{row.environment.toLocaleLowerCase()}</span>
                  <span>{row.hintsUsed}</span><span className={row.failedSubmissions ? styles.failed : ""}>{row.failedSubmissions}</span>
                  <time>{new Date(row.lastActivity).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><ArrowRight size={15} />
                </motion.button>
              ))}
              {visibleRows.length === 0 && <div className={styles.empty}>No students match this view.</div>}
            </div>
            <footer>{visibleRows.length} students</footer>
          </section>

          <AnimatePresence mode="wait">
            {selected && (
              <motion.aside key={selected.instanceId} className={styles.inspector} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }}>
                <div className={styles.profile}><i>{initials(selected.student.name)}</i><div><h2>{selected.student.name}</h2><p>{selected.student.email}</p></div><span><i />Active</span></div>
                <div className={styles.inspectorSection}><small>Campaign</small><h3><Flag size={18} />{selected.campaign}</h3></div>
                <div className={styles.inspectorSection}><div className={styles.sectionLine}><small>Progress</small><b>{selected.progress.completed} / {selected.progress.total} stages</b></div><div className={styles.stageRail}>{Array.from({ length: selected.progress.total }, (_, index) => index < selected.progress.completed ? <CheckCircle key={index} size={23} weight="fill" /> : <Circle key={index} size={23} />)}</div></div>
                <div className={styles.facts}><div><small>Score</small><strong>{selected.score}</strong></div><div><small>Environment</small><span className={styles.live}><i />{selected.environment.toLocaleLowerCase()}</span></div></div>
                <div className={styles.inspectorSection}><small>Last activity</small><p>{new Date(selected.lastActivity).toLocaleString()}</p><div className={styles.signals}><span>Hints used <b>{selected.hintsUsed}</b></span><span>Failed submissions <b>{selected.failedSubmissions}</b></span></div></div>
                <div className={styles.actions}><motion.button whileTap={{ scale: .98 }} onClick={() => router.push(`/instructor/students/${selected.instanceId}`)}>Open student record <ArrowRight size={17} /></motion.button><button type="button" onClick={resetEnvironment} disabled={resetting}>{resetting ? <SpinnerGap className="icon-spin" /> : <Warning />}Reset environment</button></div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>{notice && <motion.button className={styles.toast} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => setNotice(null)}><Check size={18} /><span>{notice}</span><X size={15} /></motion.button>}</AnimatePresence>
    </div>
  );
}
