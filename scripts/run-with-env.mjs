import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of txt.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const args = process.argv.slice(2);
const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", ...args], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
