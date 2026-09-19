// Loads .env.local (or a file from ENV_FILE) then runs the local Prisma CLI with the given args.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = process.env.ENV_FILE ?? "../.env.local";
const txt = readFileSync(new URL(envFile, import.meta.url), "utf8");
for (const line of txt.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const args = process.argv.slice(2);
const r = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", ...args],
  { stdio: "inherit", env: process.env, cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") },
);
process.exit(r.status ?? 1);
