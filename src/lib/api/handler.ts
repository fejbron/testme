import { NextResponse } from "next/server";
import { AuthError, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { log } from "@/lib/observability/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap a route handler with auth + uniform error handling. */
export function route<T>(
  fn: (ctx: { user: SessionUser; req: Request; params: Record<string, string> }) => Promise<T>,
) {
  return async (req: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      const params = await context.params;
      const data = await fn({ user, req, params });
      return NextResponse.json(data ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof AuthError)
        return NextResponse.json({ error: err.message }, { status: err.code === "FORBIDDEN" ? 403 : 401 });
      log.error("route error", {}, { message: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "invalid JSON body");
  }
}
