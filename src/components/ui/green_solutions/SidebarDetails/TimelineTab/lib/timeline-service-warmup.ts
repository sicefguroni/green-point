"use client";

/**
 * The timeline swarm runs on a host that sleeps when idle, so the first
 * request after a quiet period waits for a cold start. These helpers wake it
 * early and let callers wait until it is ready. State is module-level so the
 * sidebar, the Timeline tab and its fullscreen copy share one in-flight wake-up.
 */

// The host sleeps after ~15 idle minutes; recheck well before that.
const WARM_TTL_MS = 5 * 60_000;
const MAX_WARMUP_ATTEMPTS = 3;

let lastReadyAt = 0;
let inflight: Promise<boolean> | null = null;

export function isTimelineServiceWarm(): boolean {
  return Date.now() - lastReadyAt < WARM_TTL_MS;
}

export function markTimelineServiceReady(): void {
  lastReadyAt = Date.now();
}

export function markTimelineServiceCold(): void {
  lastReadyAt = 0;
}

/** Ping the warm-up route once (deduped). Resolves true when the service is up. */
export function warmTimelineService(): Promise<boolean> {
  if (isTimelineServiceWarm()) return Promise.resolve(true);

  if (!inflight) {
    inflight = (async () => {
      try {
        const response = await fetch("/api/timeline/warmup", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.ok) markTimelineServiceReady();
        return response.ok;
      } catch {
        return false;
      } finally {
        inflight = null;
      }
    })();
  }

  return inflight;
}

/** Keep pinging until the service answers, up to a few warm-up windows. */
export async function ensureTimelineServiceReady(): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_WARMUP_ATTEMPTS; attempt += 1) {
    if (await warmTimelineService()) return true;
  }
  return false;
}
