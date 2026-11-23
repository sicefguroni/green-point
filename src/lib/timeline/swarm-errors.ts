/**
 * The timeline swarm service could not be reached in time — typically a
 * Render instance cold-starting after idling. Callers should wait for the
 * service to wake (see /api/timeline/warmup) and retry, rather than treating
 * this as a generation failure.
 */
export class SwarmUnavailableError extends Error {
  /**
   * False when the request never reached the app (connection failure or a
   * proxy error while booting). True after a timeout, where the service may
   * still be processing it — so non-idempotent calls must not be retried.
   */
  readonly requestMayHaveRun: boolean;

  constructor(options: { requestMayHaveRun: boolean; message?: string }) {
    super(
      options.message ??
        "The timeline service is starting up. Please try again in a moment.",
    );
    this.name = "SwarmUnavailableError";
    this.requestMayHaveRun = options.requestMayHaveRun;
  }
}

export const SWARM_UNAVAILABLE_CODE = "SWARM_UNAVAILABLE";

/** JSON body the timeline routes return for a SwarmUnavailableError (HTTP 503). */
export interface SwarmUnavailableBody {
  success: false;
  code: typeof SWARM_UNAVAILABLE_CODE;
  requestMayHaveRun: boolean;
  error: string;
}

export function toSwarmUnavailableBody(
  error: SwarmUnavailableError,
): SwarmUnavailableBody {
  return {
    success: false,
    code: SWARM_UNAVAILABLE_CODE,
    requestMayHaveRun: error.requestMayHaveRun,
    error: error.message,
  };
}
