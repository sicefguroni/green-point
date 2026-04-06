export function getTimelineSwarmEnv() {
  const baseUrl =
    process.env.TIMELINE_SWARM_SERVICE_URL || "http://127.0.0.1:8001";

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}