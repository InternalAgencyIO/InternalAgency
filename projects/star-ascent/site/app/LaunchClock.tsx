"use client";

import { useEffect, useState } from "react";

const GENESIS = Date.parse("2026-07-28T14:00:00Z");

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
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
  const units = language === "en" ? ["D", "H", "M", "S"] : ["G", "S", "D", "S"];
  const label = language === "en" ? (live ? "GENESIS WINDOW // LIVE" : "MAIN COUNTDOWN") : (live ? "GENESIS PENCERESİ // CANLI" : "ANA GERİ SAYIM");
  const date = language === "en" ? "28 JULY · 14:00 UTC" : "28 TEMMUZ · 14:00 UTC";
  const liveSignal = language === "en" ? "THE SIGNAL IS UP." : "SİNYAL AÇIK.";
  return <div className={`launch-clock${live ? " launch-clock--live" : ""}`} aria-label={label}>
    <p><b>●</b> {label}</p>
    <time dateTime="2026-07-28T14:00:00Z">{date}</time>
    {live ? <strong>{liveSignal}</strong> : <div>{[time.days, time.hours, time.minutes, time.seconds].map((value, index) => <span key={units[index]}><b>{String(value).padStart(2, "0")}</b><em>{units[index]}</em></span>)}</div>}
  </div>;
}
