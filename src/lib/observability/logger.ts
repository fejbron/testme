type Ctx = {
  requestId?: string;
  userId?: string;
  campaignInstanceId?: string;
  environmentInstanceId?: string;
  submissionId?: string;
  jobId?: string;
};

/** Structured JSON logger (spec §33). Never logs seeds/secrets — callers pass only ids. */
function emit(level: "info" | "warn" | "error", msg: string, ctx: Ctx = {}, extra: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx, ...extra });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, ctx?: Ctx, extra?: Record<string, unknown>) => emit("info", msg, ctx, extra),
  warn: (msg: string, ctx?: Ctx, extra?: Record<string, unknown>) => emit("warn", msg, ctx, extra),
  error: (msg: string, ctx?: Ctx, extra?: Record<string, unknown>) => emit("error", msg, ctx, extra),
};
