export default function Home() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "72px 24px" }}>
      <p style={{ color: "var(--accent)", letterSpacing: 4, fontSize: 12 }}>CYBER RANGE</p>
      <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: "12px 0 20px" }}>
        Investigate systems. Prove conclusions.
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 620 }}>
        A challenge here is an executable environment — services, captures, binaries,
        repositories, and hidden state. Every student gets a personalized instance
        derived from a secret seed, so answers cannot be copied and pasting the prompt
        into an AI is not enough. You reverse engineer, write working tools, recover
        evidence, and defend what you found.
      </p>
      <div style={{ marginTop: 32, display: "flex", gap: 14 }}>
        <a href="/login" style={{ background: "var(--accent)", color: "#04110e", padding: "10px 18px", borderRadius: 6, textDecoration: "none", fontWeight: 700 }}>Sign in</a>
        <a href="/api/health" style={{ border: "1px solid var(--border)", color: "var(--fg)", padding: "10px 18px", borderRadius: 6, textDecoration: "none" }}>Status</a>
      </div>
    </main>
  );
}
