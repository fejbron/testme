import { NextResponse } from "next/server";
import { drainJobs } from "@/lib/events/drain";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cron/drain endpoint. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token). */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const processed = await drainJobs(25);
  return NextResponse.json({ processed });
}

export const GET = handle;
export const POST = handle;
