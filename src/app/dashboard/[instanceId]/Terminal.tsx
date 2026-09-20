"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalWindow } from "@phosphor-icons/react";
import { apiFetch } from "@/components/api-types";
import "@xterm/xterm/css/xterm.css";

const MAX_LINES = 2000;
const PROMPT = "$ ";

export default function Terminal({ instanceId, envStatus }: { instanceId: string; envStatus: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;

    async function boot() {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !containerRef.current) return;

      const term = new XTerm({
        convertEol: true,
        fontFamily: "ui-monospace, SF Mono, JetBrains Mono, Menlo, monospace",
        fontSize: 13,
        theme: {
          background: "#0a0e14",
          foreground: "#d7e0ea",
          cursor: "#39d3bb",
        },
        scrollback: MAX_LINES,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      let cwd = "/vercel/sandbox";
      let line = "";
      term.writeln("TestMe terminal. Type a command and press Enter.");
      term.write(`\r\n${cwd} ${PROMPT}`);

      async function runCommand(cmd: string) {
        try {
          const res = await apiFetch<{ stdout: string; stderr: string; exitCode: number; cwd: string }>(
            `/api/campaign-instances/${instanceId}/exec`,
            { method: "POST", body: JSON.stringify({ cmd, cwd }) },
          );
          cwd = res.cwd;
          if (res.stdout) term.write(res.stdout.replace(/\n/g, "\r\n"));
          if (res.stderr) term.write(`\x1b[31m${res.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
          if (res.exitCode !== 0) term.write(`\r\n\x1b[33m[exit ${res.exitCode}]\x1b[0m`);
        } catch (e) {
          const message = e instanceof Error ? e.message : "command failed";
          if (message.toLowerCase().includes("environment not running")) {
            setNotice("Environment is not running. Start it from the Environment panel above, then try again.");
          }
          term.write(`\r\n\x1b[31m${message}\x1b[0m`);
        }
        term.write(`\r\n${cwd} ${PROMPT}`);
      }

      const sub = term.onData((data) => {
        const code = data.charCodeAt(0);
        if (data === "\r") {
          term.write("\r\n");
          const cmd = line;
          line = "";
          if (cmd.trim()) {
            void runCommand(cmd.trim());
          } else {
            term.write(`${cwd} ${PROMPT}`);
          }
        } else if (code === 127) {
          if (line.length > 0) {
            line = line.slice(0, -1);
            term.write("\b \b");
          }
        } else if (code < 32) {
          // ignore other control chars
        } else {
          line += data;
          term.write(data);
        }
      });

      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);

      dispose = () => {
        sub.dispose();
        window.removeEventListener("resize", onResize);
        term.dispose();
      };
    }

    void boot();
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [instanceId]);

  return (
    <section className="sandbox-terminal">
      <header className="sandbox-terminal__header">
        <span><TerminalWindow size={19} /> Sandbox terminal</span>
        <strong className={envStatus === "RUNNING" ? "is-running" : ""}><i />{envStatus}</strong>
      </header>
      {envStatus !== "RUNNING" && (
        <p className="sandbox-terminal__notice">
          Environment status is {envStatus}. Commands will fail until it is running.
        </p>
      )}
      {notice && <p className="sandbox-terminal__notice">{notice}</p>}
      <div className="sandbox-terminal__screen" ref={containerRef} />
    </section>
  );
}
