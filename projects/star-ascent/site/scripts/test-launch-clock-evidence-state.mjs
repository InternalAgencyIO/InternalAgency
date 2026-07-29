#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GENESIS_SCHEDULED_AT_UTC,
  resolveLaunchClockState,
} from "../app/launch-clock-state.mjs";

const manifest = JSON.parse(
  readFileSync(resolve("launch/genesis-manifest.template.json"), "utf8"),
);
const source = readFileSync(resolve("app/LaunchClock.tsx"), "utf8");
const targetMs = Date.parse(GENESIS_SCHEDULED_AT_UTC);

assert.equal(GENESIS_SCHEDULED_AT_UTC, "2026-07-29T14:15:18Z");
assert.equal(
  resolveLaunchClockState("HOLD", GENESIS_SCHEDULED_AT_UTC, targetMs - 1),
  "SCHEDULED_HOLD",
);
assert.equal(
  resolveLaunchClockState("HOLD", GENESIS_SCHEDULED_AT_UTC, targetMs),
  "WINDOW_OPEN_HOLD",
);
assert.equal(
  resolveLaunchClockState("READY", GENESIS_SCHEDULED_AT_UTC, targetMs + 1),
  "WINDOW_OPEN_HOLD",
);
assert.equal(
  resolveLaunchClockState("PUBLISHED", GENESIS_SCHEDULED_AT_UTC, targetMs - 1),
  "LIVE",
);
assert.equal(resolveLaunchClockState("HOLD", null, targetMs), "UNSCHEDULED_HOLD");
assert.equal(
  resolveLaunchClockState("HOLD", "not-a-date", targetMs),
  "INVALID_SCHEDULE_HOLD",
);
assert.equal(
  resolveLaunchClockState(manifest.status, GENESIS_SCHEDULED_AT_UTC, targetMs - 1),
  "SCHEDULED_HOLD",
);
assert.match(source, /29 JUL 2026 · 14:15:18 UTC/);
assert.match(source, /29 TEM 2026 · 17:15:18 İSTANBUL/);
assert.match(source, /NO AUTOMATIC TRANSACTIONS/);
assert.match(source, /data-launch-state=\{state\}/);
assert.match(source, /setInterval/);
assert.doesNotMatch(source, /2026-07-28/);
console.log(
  "Launch clock carries the exact two-hour ceremony window while remaining evidence-gated.",
);
