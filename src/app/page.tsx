import Link from "next/link";

const stats = [
  { n: "4", l: "Campaigns" },
  { n: "26", l: "Challenges" },
  { n: "5", l: "Grader types" },
];

const paths = [
  {
    kind: "BEGINNER · 6 STAGES",
    title: "Boot Camp",
    desc: "Start here. Decode base64, ROT13, hex and binary, sum a column, and grep a secret out of a noisy log. Short, forgiving, and personalized — the moves every later campaign assumes.",
    tags: ["Base64", "ROT13", "Hex", "Binary", "Search"],
  },
  {
    kind: "INTERMEDIATE · 6 STAGES",
    title: "Field Work",
    desc: "Classical ciphers, a forged token, and logs that hide an intruder. Break Caesar and Vigenère, read a JWT, peel a layered blob, catch a scanner in an access log, and write a script the grader tests on unseen input.",
    tags: ["Caesar", "Vigenère", "JWT", "Forensics", "Scripting"],
  },
  {
    kind: "ADVANCED · 8 STAGES",
    title: "Project Janus",
    desc: "A personalized host, an unknown protocol, a broken service. Investigate a captured filesystem, reverse a binary protocol, write a decoder, do git archaeology, patch a C service, and rebuild what was lost.",
    tags: ["Network RE", "Decoder", "Git", "Systems", "Crypto"],
  },
  {
    kind: "EXPERT · 6 STAGES",
    title: "The Gauntlet",
    desc: "Six escalating puzzles with no scaffolding. Peel a layered cipher, break repeating-key XOR, pull a marker out of an image, walk a hash chain, write a stack-VM interpreter, and trace an injection through a log.",
    tags: ["Cipher", "XOR", "Stego", "Hash chain", "Interpreter", "Forensics"],
  },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-soft)",
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        <span className="mono" style={{ color: "var(--fg-strong)", fontWeight: 700, letterSpacing: "-0.02em" }}>
          ▚ testme
        </span>
        <nav style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 14 }}>
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary" style={{ padding: "8px 14px" }}>
            Create account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 48,
            alignItems: "center",
            padding: "72px 0 40px",
          }}
        >
          <div>
            <p className="eyebrow">&gt;_ investigate · runs in your browser</p>
            <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: "14px 0 20px" }}>
              Learn security
              <br />
              by <span style={{ textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 6 }}>breaking it.</span>
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>
              TestMe hands you an executable environment — captures, binaries, repositories, services, hidden
              state — and a personalized secret seed. You reverse engineer, write working tools, recover
              evidence, and prove your conclusions. Pasting the prompt into an AI is not enough.
            </p>
            <div style={{ marginTop: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-primary">
                ▶ Create account
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Sign in →
              </Link>
            </div>

            <div style={{ display: "flex", gap: 44, marginTop: 44 }}>
              {stats.map((s) => (
                <div key={s.l}>
                  <div className="mono" style={{ fontSize: 28, color: "var(--fg-strong)", fontWeight: 700 }}>
                    {s.n}
                  </div>
                  <div className="eyebrow" style={{ letterSpacing: "0.12em", marginTop: 2 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal mock */}
          <div className="card" style={{ borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#3a3a3a" }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#3a3a3a" }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#3a3a3a" }} />
              <span className="eyebrow" style={{ marginLeft: 8 }}>
                workstation — silent-relay
              </span>
            </div>
            <pre
              className="mono"
              style={{ margin: 0, padding: 18, fontSize: 13, lineHeight: 1.7, color: "var(--fg)", whiteSpace: "pre-wrap" }}
            >
{`$ file capture.pcap
capture.pcap: pcap capture file, USER0 link-type
$ xxd -l 24 capture.pcap | head -1
0000: d4c3 b2a1 0200 0400 ...   magic + version
$ ./decoder < frame.bin
{"length":16,"msgType":3,"seq":4211}
`}
              <span style={{ color: "var(--fg-strong)" }}>$ </span>
              <span style={{ background: "var(--fg-strong)", color: "#000" }}>&nbsp;</span>
            </pre>
          </div>
        </section>

        {/* Campaigns */}
        <section style={{ padding: "40px 0 24px" }}>
          <p className="eyebrow">Campaigns</p>
          <h2 style={{ fontSize: 30, margin: "8px 0 6px" }}>Four tracks, one seed engine</h2>
          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 640, marginBottom: 24 }}>
            From base64 to buffer overflows. Every student gets different concrete values from the same
            concepts. Stages unlock as you solve them; graded against what actually happened, not the text
            you typed.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
            {paths.map((p) => (
              <div key={p.title} className="card" style={{ padding: 20 }}>
                <p className="eyebrow" style={{ fontSize: 11 }}>
                  {p.kind}
                </p>
                <h3 style={{ fontSize: 20, margin: "8px 0 8px" }}>{p.title}</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{p.desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="mono"
                      style={{ fontSize: 11, color: "var(--muted)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 6 }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "48px 0 72px", borderTop: "1px solid var(--border-soft)", marginTop: 24 }}>
          <h2 style={{ fontSize: 26, marginBottom: 10 }}>Open a terminal and start</h2>
          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 560, marginBottom: 20 }}>
            Create an account, get a personalized campaign instance, and begin the first investigation.
            Your progress follows you.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup" className="btn btn-primary">
              Create account
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
