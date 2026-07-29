export const GENESIS_SCHEDULED_AT_UTC = "2026-07-29T14:15:18Z";

export function resolveLaunchClockState(
  manifestStatus,
  scheduledAtUtc = GENESIS_SCHEDULED_AT_UTC,
  nowMs = Date.now(),
) {
  if (manifestStatus === "PUBLISHED") return "LIVE";
  if (scheduledAtUtc === null) return "UNSCHEDULED_HOLD";
  const scheduledAtMs = Date.parse(scheduledAtUtc);
  if (!Number.isFinite(scheduledAtMs)) return "INVALID_SCHEDULE_HOLD";
  return nowMs >= scheduledAtMs ? "WINDOW_OPEN_HOLD" : "SCHEDULED_HOLD";
}
