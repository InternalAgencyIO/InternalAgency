"use client";

import { useEffect, useMemo, useState } from "react";
import genesisManifest from "../launch/genesis-manifest.template.json";
import {
  GENESIS_SCHEDULED_AT_UTC,
  resolveLaunchClockState,
} from "./launch-clock-state.mjs";

const TARGET_MS = Date.parse(GENESIS_SCHEDULED_AT_UTC);

function countdownParts(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function LaunchClock({ language }: { language: "en" | "tr" }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const state = resolveLaunchClockState(
    genesisManifest.status,
    GENESIS_SCHEDULED_AT_UTC,
    nowMs ?? TARGET_MS - 1,
  );
  const live = state === "LIVE";
  const windowOpen = state === "WINDOW_OPEN_HOLD";
  const parts = useMemo(
    () => countdownParts(TARGET_MS - (nowMs ?? TARGET_MS)),
    [nowMs],
  );
  const label = language === "en"
    ? live
      ? "GENESIS // VERIFIED LIVE"
      : windowOpen
        ? "CEREMONY WINDOW // OPEN · EVIDENCE HOLD"
        : "OPEN-SOURCE CEREMONY // COUNTDOWN"
    : live
      ? "BAŞLANGIÇ // DOĞRULANMIŞ CANLI"
      : windowOpen
        ? "TÖREN PENCERESİ // AÇIK · KANIT BEKLET"
        : "AÇIK KAYNAK TÖREN // GERİ SAYIM";
  const signal = language === "en"
    ? live
      ? "THE VERIFIED SIGNAL IS UP."
      : windowOpen
        ? "HUMAN-APPROVED EXECUTION MAY BEGIN · NO AUTOMATIC TRANSACTIONS."
        : "CODE IS PUBLIC · EXECUTION REMAINS PHYSICAL AND EVIDENCE-GATED."
    : live
      ? "DOĞRULANMIŞ SİNYAL AÇIK."
      : windowOpen
        ? "İNSAN ONAYLI YÜRÜTME BAŞLAYABİLİR · OTOMATİK İŞLEM YOK."
        : "KOD KAMUYA AÇIK · YÜRÜTME FİZİKSEL VE KANIT EŞİKLİ.";
  const exactTime = language === "en"
    ? "30 JUL 2026 · 03:45:00 UTC"
    : "30 TEM 2026 · 06:45:00 İSTANBUL";

  return (
    <div
      className={`launch-clock${live ? " launch-clock--live" : ""}${windowOpen ? " launch-clock--open" : ""}`}
      aria-label={`${label}. ${exactTime}. ${signal}`}
      aria-live="polite"
      data-launch-state={state}
      data-scheduled-at={GENESIS_SCHEDULED_AT_UTC}
    >
      <p><b>●</b> {label}</p>
      {!live && !windowOpen && (
        <div aria-label={language === "en" ? "Time until ceremony window" : "Tören penceresine kalan süre"}>
          {[
            [parts.days, language === "en" ? "DAYS" : "GÜN"],
            [parts.hours, language === "en" ? "HRS" : "SA"],
            [parts.minutes, language === "en" ? "MIN" : "DK"],
            [parts.seconds, language === "en" ? "SEC" : "SN"],
          ].map(([value, unit]) => (
            <span key={String(unit)}>
              <b>{String(value).padStart(2, "0")}</b>
              <em>{unit}</em>
            </span>
          ))}
        </div>
      )}
      <strong>{exactTime}</strong>
      <small>{signal}</small>
    </div>
  );
}
