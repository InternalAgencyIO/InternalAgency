#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  observeIatB3ProductionLocalRehearsalPreflight,
  validateIatB3ProductionLocalRehearsalPreflight,
} from "./lib/iat-b3-production-local-rehearsal-contract.mjs";

export function parseIatB3ProductionLocalRehearsalArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ARGS_HOLD");
  let preflight = false;
  let inputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--preflight" && !preflight) {
      preflight = true;
    } else if (argument === "--input" && inputPath === null && argv[index + 1]) {
      inputPath = resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_UNKNOWN_ARGUMENT_HOLD:${argument}`);
    }
  }
  if (!preflight) throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_FLAG_REQUIRED_HOLD");
  if (inputPath === null) throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_REQUIRED_HOLD");
  return Object.freeze({ preflight: true, inputPath });
}

export function runIatB3ProductionLocalRehearsalCli(argv) {
  let record;
  try {
    const arguments_ = parseIatB3ProductionLocalRehearsalArguments(argv);
    record = observeIatB3ProductionLocalRehearsalPreflight({
      inputPath: arguments_.inputPath,
    });
  } catch {
    record = observeIatB3ProductionLocalRehearsalPreflight({
      inputPath: null,
    });
  }
  validateIatB3ProductionLocalRehearsalPreflight(record);
  return record;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isCli) {
  const record = runIatB3ProductionLocalRehearsalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(record)}\n`);
  process.exitCode = record.exitCode;
}
