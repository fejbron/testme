import Link from "next/link";
import {
  ArrowRight,
  Books,
  ChartLineUp,
  Circle,
  Flag,
  ShieldCheck,
  SquaresFour,
  TerminalWindow,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { campaignPaths, marketingStats } from "./marketing-data";
import styles from "./marketing.module.css";

function MarketingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand}><SquaresFour size={18} weight="fill" /> testme</Link>
        <nav className={styles.nav} aria-label="Marketing navigation">
          <a href="#campaigns">Campaigns</a>
          <a href="#platform">How it works</a>
          <Link href="/instructor">For instructors</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.textLink}>Sign in</Link>
          <Link href="/signup" className={styles.primaryButton}>Get started <ArrowRight size={16} /></Link>
        </div>
      </div>
    </header>
  );
}

function RangeStatus() {
  return (
    <aside className={styles.livePanel} aria-label="Live range status">
      <div className={styles.liveHeader}>
        <span className={styles.status}><Circle size={9} weight="fill" /> Live range status</span>
        <time dateTime="2026-09-20">Sep 20, 2026</time>
      </div>
      <div className={styles.liveBody}>
        <div className={styles.online}>
          <div><strong>247</strong><span> students online</span></div>
          <dl className={styles.liveStats}>
            {marketingStats.map((stat) => <div key={stat.l}><dt>{stat.n}</dt><dd>{stat.l}</dd></div>)}
          </dl>
        </div>
        <div className={styles.featured}>
          <span>Featured campaign</span>
          <div className={styles.featuredRow}>
            <Flag size={22} />
            <div><strong>Boot Camp</strong><small>Beginner · 6 stages</small></div>
            <ArrowRight size={18} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function InvestigationHero() {
  return (
    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>Hands-on cybersecurity training</p>
        <h1>Build the skills <span>attackers test.</span></h1>
        <p className={styles.heroLead}>TestMe gives you real tools, executable environments, and a guided path from fundamentals to real-world exploitation—entirely in your browser.</p>
        <div className={styles.heroActions}>
          <Link href="/signup" className={styles.primaryButton}>Start training now <ArrowRight size={17} /></Link>
          <a href="#campaigns" className={styles.secondaryButton}>Explore campaigns</a>
        </div>
        <div className={styles.proof}>
          <div className={styles.proofItem}><TerminalWindow size={22} /><span><strong>Practical labs</strong>Real tools. Real systems.</span></div>
          <div className={styles.proofItem}><ChartLineUp size={22} /><span><strong>Track progress</strong>See your growth.</span></div>
          <div className={styles.proofItem}><UsersThree size={22} /><span><strong>Guided learning</strong>From easy to advanced.</span></div>
        </div>
      </div>
      <RangeStatus />
    </section>
  );
}

function TerminalDemo() {
  return (
    <section className={styles.section} id="platform">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Practice against working systems</p>
        <h2>Your browser becomes the lab.</h2>
        <p>Investigate captures, binaries, repositories, services, and hidden state. Recover evidence and prove your conclusion against what actually happened.</p>
      </div>
      <div className={styles.terminalLayout}>
        <div className={styles.terminal}>
          <div className={styles.terminalHeader}><span><TerminalWindow size={17} /> testme@range:~$</span><b>ENVIRONMENT READY</b></div>
          <pre>{`$ file capture.pcap
capture.pcap: pcap capture file, USER0 link-type

$ xxd -l 24 capture.pcap | head -1
0000: d4c3 b2a1 0200 0400 ...

$ ./decoder < frame.bin
{"length":16,"msgType":3,"seq":4211}

`}<strong>$ investigation continues</strong></pre>
        </div>
        <div className={styles.principles}>
          <article className={styles.principle}><ShieldCheck size={27} /><div><h3>Personalized environments</h3><p>Each learner works from a unique seed, so understanding matters more than copied answers.</p></div></article>
          <article className={styles.principle}><Books size={27} /><div><h3>Structured progression</h3><p>Every campaign is available from signup; stages guide you from foundations to expert work.</p></div></article>
          <article className={styles.principle}><ChartLineUp size={27} /><div><h3>Evidence-based grading</h3><p>Progress reflects the work completed in the environment, not merely the text submitted.</p></div></article>
        </div>
      </div>
    </section>
  );
}

function CampaignPath() {
  return (
    <section className={styles.section} id="campaigns">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Learning path</p>
        <h2>From first decode to final gauntlet.</h2>
        <p>Four campaigns build on one another. Start with the fundamentals, then move through analysis, reverse engineering, systems work, and unscripted challenges.</p>
      </div>
      <div className={styles.campaigns}>
        {campaignPaths.map((campaign, index) => (
          <article className={styles.campaign} key={campaign.title}>
            <span className={styles.campaignIndex}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.campaignContent}>
              <div className={styles.campaignMeta}><Flag size={14} /> {campaign.kind}</div>
              <h3>{campaign.title}</h3>
              <p>{campaign.desc}</p>
            </div>
            <div className={styles.campaignSide}>
              <div className={styles.tags}>{campaign.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className={styles.campaignFooter}><span>Available at signup</span><ArrowRight size={18} /></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MarketingFooter() {
  return (
    <>
      <section className={styles.cta}>
        <div><p className={styles.eyebrow}>Ready when you are</p><h2>Open a terminal. Build skills that transfer.</h2><p>Create an account, launch your first personalized campaign instance, and keep every campaign available as your confidence grows.</p></div>
        <Link href="/signup" className={styles.primaryButton}>Create account <ArrowRight size={17} /></Link>
      </section>
      <footer className={styles.footer}>
        <div><Link href="/" className={styles.brand}><SquaresFour size={18} weight="fill" /> testme</Link><p>Practice today. Defend tomorrow.</p></div>
        <div className={styles.footerLinks}><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link><a href="#campaigns">Campaigns</a></div>
      </footer>
    </>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <MarketingHeader />
      <main className={styles.main}>
        <InvestigationHero />
        <TerminalDemo />
        <CampaignPath />
        <MarketingFooter />
      </main>
    </div>
  );
}
