import genesisManifest from "../launch/genesis-manifest.template.json";
import {
  GENESIS_SCHEDULED_AT_UTC,
  resolveLaunchClockState,
} from "./launch-clock-state.mjs";

export function LaunchClock({ language }: { language: "en" | "tr" }) {
  const state = resolveLaunchClockState(
    genesisManifest.status,
    GENESIS_SCHEDULED_AT_UTC,
  );
  const live = state === "LIVE";
  const label = language === "en"
    ? live
      ? "GENESIS // VERIFIED LIVE"
      : "GENESIS // UNSCHEDULED · MAINNET HOLD"
    : live
      ? "BAŞLANGIÇ // DOĞRULANMIŞ CANLI"
      : "BAŞLANGIÇ // PLANLANMADI · MAINNET BEKLET";
  const signal = language === "en"
    ? live
      ? "THE VERIFIED SIGNAL IS UP."
      : "NO CEREMONY TIME IS ACTIVE · NO AUTOMATIC TRANSACTIONS."
    : live
      ? "DOĞRULANMIŞ SİNYAL AÇIK."
      : "AKTİF TÖREN SAATİ YOK · OTOMATİK İŞLEM YOK.";
  const exactTime = language === "en"
    ? "REPLACEMENT UTC WINDOW · NOT PUBLISHED"
    : "YENİ UTC PENCERESİ · YAYIMLANMADI";

  return (
    <div
      className={`launch-clock${live ? " launch-clock--live" : ""}`}
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
