"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Play, ShieldCheck } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import { apiFetch, type AssignedCampaign } from "@/components/api-types";

const CAMPAIGN_TAGS: Record<string, string[]> = {
  "Boot Camp": ["Base64", "ROT13", "Hex", "Binary", "Search"],
  "Field Work": ["Caesar", "Vigenère", "JWT", "Forensics", "Scripting"],
  "Project Janus": ["Network RE", "Decoder", "Git", "Systems", "Crypto"],
  "The Gauntlet": ["Cipher", "XOR", "Stego", "Hash chain", "Interpreter"],
};

function campaignState(campaign: AssignedCampaign) {
  if (campaign.status === "COMPLETED") return { label: "Completed", tone: "complete" as const };
  if (campaign.status === "ACTIVE" || campaign.progress.completed > 0) {
    return { label: "In progress", tone: "active" as const };
  }
  return { label: "Ready to start", tone: "ready" as const };
}

export default function CampaignList() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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

  const totals = useMemo(() => {
    const totalStages = campaigns?.reduce((sum, campaign) => sum + campaign.progress.total, 0) ?? 0;
    const completedStages = campaigns?.reduce((sum, campaign) => sum + campaign.progress.completed, 0) ?? 0;
    const startedCampaigns = campaigns?.filter((campaign) => campaign.status !== "NOT_STARTED").length ?? 0;
    return { totalStages, completedStages, startedCampaigns };
  }, [campaigns]);

  async function onStart(campaign: AssignedCampaign) {
    setStartingId(campaign.id);
    setError(null);
    try {
      await apiFetch(`/api/campaign-instances/${campaign.id}/start`, { method: "POST" });
      router.push(`/dashboard/${campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start campaign");
      setStartingId(null);
    }
  }

  return (
    <div className="mission-layout">
      <section className="mission-main" aria-labelledby="mission-title">
        <motion.header
          className="mission-intro"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">&gt;_ Student dashboard</p>
          <h1 id="mission-title">
            Choose your next <span>mission.</span>
          </h1>
          <p>
            Four campaigns. One seed engine. Go from fundamentals to real-world exploitation with hands-on
            challenges that run in your browser.
          </p>
        </motion.header>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mission-error" role="alert">
            {error}
          </motion.div>
        )}

        {!campaigns && <CampaignSkeleton />}
        {campaigns?.length === 0 && <div className="mission-empty">No campaigns are available yet.</div>}

        <AnimatePresence initial={!reduceMotion}>
          {campaigns && campaigns.length > 0 && (
            <motion.div className="mission-rail" initial="hidden" animate="visible">
              {campaigns.map((campaign, index) => {
                const state = campaignState(campaign);
                const started = campaign.status !== "NOT_STARTED";
                const progressPercent = campaign.progress.total
                  ? Math.round((campaign.progress.completed / campaign.progress.total) * 100)
                  : 0;
                return (
                  <motion.article
                    key={campaign.id}
                    className={`mission-row mission-row--${state.tone}`}
                    variants={{
                      hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { delay: reduceMotion ? 0 : index * 0.07, duration: 0.38 },
                      },
                    }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <div className="mission-node" aria-hidden="true">
                      <span className="mission-node__number">{String(index + 1).padStart(2, "0")}</span>
                      <motion.span
                        className="mission-node__dot"
                        animate={
                          state.tone === "active" && !reduceMotion
                            ? { scale: [1, 1.16, 1], opacity: [1, 0.75, 1] }
                            : undefined
                        }
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>

                    <div className="mission-card">
                      <div className="mission-card__story">
                        <p className="mission-card__meta">
                          {campaign.difficulty} · {campaign.progress.total} stages
                        </p>
                        <h2>{campaign.name}</h2>
                        <p className="mission-card__description">{campaign.description}</p>
                        <div className="mission-tags" aria-label={`${campaign.name} skills`}>
                          {(CAMPAIGN_TAGS[campaign.name] ?? []).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>

                      <div className="mission-card__action">
                        <div className={`mission-status mission-status--${state.tone}`}>
                          <span aria-hidden="true" />
                          {state.label}
                        </div>
                        <ProgressBar
                          value={campaign.progress.completed}
                          max={campaign.progress.total}
                          label={`${campaign.progress.completed} / ${campaign.progress.total} stages · ${progressPercent}%`}
                        />
                        <div className="mission-score">Score {campaign.score}</div>
                        {started ? (
                          <Button variant="primary" onClick={() => router.push(`/dashboard/${campaign.id}`)}>
                            <Play size={15} weight="fill" aria-hidden="true" />
                            Resume campaign
                          </Button>
                        ) : (
                          <Button variant="primary" busy={startingId === campaign.id} onClick={() => onStart(campaign)}>
                            <Play size={15} weight="fill" aria-hidden="true" />
                            Start campaign
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <aside className="mission-sidebar" aria-label="Campaign overview">
        <motion.section
          className="mission-summary"
          initial={reduceMotion ? false : { opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.4 }}
        >
          <p className="mission-summary__label">Your progress</p>
          <div className="mission-summary__count">
            <strong>{totals.startedCampaigns} / {campaigns?.length ?? 4}</strong>
            <span>campaigns</span>
          </div>
          <ProgressBar value={totals.completedStages} max={totals.totalStages || 1} />
          <p className="mission-summary__percent">
            {totals.totalStages ? Math.round((totals.completedStages / totals.totalStages) * 100) : 0}% complete
          </p>
          <div className="mission-summary__rule" />
          <p>Keep going. Each campaign builds on the last, taking you from the basics to real-world exploitation.</p>
        </motion.section>

        <motion.section
          className="mission-quote"
          initial={reduceMotion ? false : { opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.28, duration: 0.4 }}
        >
          <ShieldCheck size={22} weight="light" aria-hidden="true" />
          <blockquote>“Skills compound when you ship them.”</blockquote>
          <p>— TestMe</p>
          <ArrowRight size={18} aria-hidden="true" />
        </motion.section>
      </aside>
    </div>
  );
}

function CampaignSkeleton() {
  return (
    <div className="mission-skeleton" aria-label="Loading campaigns" aria-busy="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="mission-skeleton__row">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
