#!/usr/bin/env node

import { isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  observeDirectEvidence,
  persistDirectEvidenceReceipt,
  readStrictDirectObserverFile,
} from "./lib/iat-b3-devnet-direct-evidence-observer-contract.mjs";

export function parsePostDirectObserverArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_.length !== 2
    || arguments_[0] !== "--input"
    || typeof arguments_[1] !== "string"
    || !isAbsolute(arguments_[1])) {
    throw new Error(
      "Usage: observe-iat-b3-post-devnet-direct-evidence.mjs --input <absolute-input.json>",
    );
  }
  return Object.freeze({ inputPath: arguments_[1] });
}

export function runPostDirectObserver({ inputPath } = {}) {
  const request = readStrictDirectObserverFile(
    inputPath,
    "IAT_B3_POST_DIRECT_OBSERVER_INPUT",
  );
  const receipt = observeDirectEvidence(request, { phase: "POST" });
  const receiptArtifact = persistDirectEvidenceReceipt(receipt, { phase: "POST" });
  process.stdout.write(`${JSON.stringify(receiptArtifact, null, 2)}\n`);
  return receiptArtifact;
}

if (process.argv[1]
  && pathToFileURL(fileURLToPath(import.meta.url)).href
    === pathToFileURL(process.argv[1]).href) {
  try {
    runPostDirectObserver(parsePostDirectObserverArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "POST_DIRECT_OBSERVER_ERROR"}\n`);
    process.exitCode = 1;
  }
}
