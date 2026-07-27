"use client";

import { useEffect, useState } from "react";

const GENESIS = Date.parse("2026-07-28T14:00:00Z");

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

export function LaunchClock({ language }: { language: "en" | "tr" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = GENESIS - now;
  const live = remaining <= 0;
  const time = format(remaining);
  const label = language === "en" ? (live ? "GENESIS WINDOW // LIVE" : "MAIN COUNTDOWN") : (live ? "GENESIS PENCERESİ // CANLI" : "ANA GERİ SAYIM");
  return <div className={`launch-clock${live ? " launch-clock--live" : ""}`} aria-label={label}>
    <p><b>●</b> {label}</p>
    <time dateTime="2026-07-28T14:00:00Z">{language === "en" ? "28 JULY · 14:00 UTC" : "28 TEMMUZ · 14:00 UTC"}</time>
    {live ? <strong>{language === "en" ? "THE SIGNAL IS UP." : "SİNYAL AÇIK."}</strong> : <div><span><b>{String(time.days).padStart(2, "0")}</b><em>D</em></span><span><b>{String(time.hours).padStart(2, "0")}</b><em>H</em></span><span><b>{String(time.minutes).padStart(2, "0")}</b><em>M</em></span><span><b>{String(time.seconds).padStart(2, "0")}</b><em>S</em></span></div>}
  </div>;
}
