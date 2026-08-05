import genesisManifest from "../launch/genesis-manifest.template.json";
import {
  GENESIS_SCHEDULED_AT_UTC,
  resolveLaunchClockState,
} from "./launch-clock-state.mjs";

export function LaunchClock() {
  const state = resolveLaunchClockState(
    genesisManifest.status,
    GENESIS_SCHEDULED_AT_UTC,
  );
  const label = "GENESIS // UNSCHEDULED · MAINNET HOLD";
  const signal = "NO CEREMONY TIME IS ACTIVE · NO AUTOMATIC TRANSACTIONS.";
  const exactTime = "REPLACEMENT UTC WINDOW · NOT PUBLISHED";

  return (
    <div
      className="launch-clock"
      role="status"
      aria-label={`${label}. ${exactTime}. ${signal}`}
      aria-live="polite"
      data-launch-state={state}
      data-scheduled-at="UNSCHEDULED"
    >
      <p><b>●</b> {label}</p>
      <strong>{exactTime}</strong>
      <small>{signal}</small>
    </div>
  );
}
