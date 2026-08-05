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
assert.equal(GENESIS_SCHEDULED_AT_UTC, null);
assert.equal(resolveLaunchClockState("HOLD", GENESIS_SCHEDULED_AT_UTC), "UNSCHEDULED_HOLD");
assert.equal(resolveLaunchClockState("READY", GENESIS_SCHEDULED_AT_UTC), "UNSCHEDULED_HOLD");
assert.equal(resolveLaunchClockState("PUBLISHED", GENESIS_SCHEDULED_AT_UTC), "PUBLISHED_RECORD_HOLD");
assert.equal(resolveLaunchClockState("PUBLISHED", "2026-08-05T20:00:00Z", Date.parse("2026-08-05T19:00:00Z")), "SCHEDULED_HOLD");
assert.equal(resolveLaunchClockState("PUBLISHED", "2026-08-05T20:00:00Z", Date.parse("2026-08-05T21:00:00Z")), "WINDOW_OPEN_HOLD");
assert.equal(resolveLaunchClockState("HOLD", "not-a-date"), "INVALID_SCHEDULE_HOLD");
assert.equal(resolveLaunchClockState(manifest.status, GENESIS_SCHEDULED_AT_UTC), "UNSCHEDULED_HOLD");
assert.match(source, /REPLACEMENT UTC WINDOW/);
assert.match(source, /NOT PUBLISHED/);
assert.match(source, /NO AUTOMATIC TRANSACTIONS/);
assert.match(source, /data-launch-state=\{state\}/);
assert.match(source, /data-scheduled-at="UNSCHEDULED"/);
assert.doesNotMatch(source, /setInterval|2026-07-30|03:45:00|06:45:00|YENİ UTC|YAYIMLANMADI/);
console.log("Launch clock remains fail closed: publication status alone cannot imply a live launch.");
