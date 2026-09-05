#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyIatV2DevnetProgramCeremonyRuntimeBinding,
} from "./lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

try {
  const verification = verifyIatV2DevnetProgramCeremonyRuntimeBinding({ projectRoot });
  console.log(JSON.stringify(verification, null, 2));
} catch (error) {
  console.error(`${error?.code ?? "CEREMONY_BINDING_HOLD"}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
