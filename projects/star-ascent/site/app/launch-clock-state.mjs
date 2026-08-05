export const GENESIS_SCHEDULED_AT_UTC = null;

export function resolveLaunchClockState(
  manifestStatus,
  scheduledAtUtc = GENESIS_SCHEDULED_AT_UTC,
  nowMs = Date.now(),
) {
  if (scheduledAtUtc === null) {
    return manifestStatus === "PUBLISHED" ? "PUBLISHED_RECORD_HOLD" : "UNSCHEDULED_HOLD";
  }
  const scheduledAtMs = Date.parse(scheduledAtUtc);
  if (!Number.isFinite(scheduledAtMs)) return "INVALID_SCHEDULE_HOLD";
  return nowMs >= scheduledAtMs ? "WINDOW_OPEN_HOLD" : "SCHEDULED_HOLD";
}
