import { drainJobs } from "./drain";
import { log } from "@/lib/observability/logger";

/** Best-effort inline drain after a state change so the student sees progress without waiting for cron. */
export async function kickDrain(rounds = 3): Promise<void> {
  try {
    for (let i = 0; i < rounds; i++) {
      const n = await drainJobs(10);
      if (n === 0) break;
    }
  } catch (err) {
    log.warn("kickDrain failed", {}, { message: err instanceof Error ? err.message : String(err) });
  }
}
