#!/usr/bin/env node

import { readFileSync } from "node:fs";

const source = readFileSync("app/dossier/read/[slug]/page.tsx", "utf8");

if (source !== source.normalize("NFC")) {
  throw new Error("Dossier reader source must remain NFC-normalized UTF-8");
}
if (/\uFFFD/u.test(source)) {
  throw new Error("Dossier reader source contains a Unicode replacement character");
}
if (/\b(?:repairLegacyEncoding|TextDecoder|windows-1252)\b/u.test(source)) {
  throw new Error("Dossier reader must not carry the retired runtime encoding-repair path");
}
if (/\b(?:TR|tailoredTR)\b|[\u011e\u011f\u0130\u0131\u015e\u015f]|[\u0370-\u052f\u0530-\u058f\u0600-\u06ff\u0900-\u0d7f\u10a0-\u10ff\u3040-\u30ff\u3400-\u9fff]/u.test(source)) {
  throw new Error("Dossier reader contains unreviewed target-language production copy");
}
if (!source.includes('const record = EN[params.slug] ?? fallback(params.slug);')) {
  throw new Error("Dossier reader must resolve every record from canonical English copy");
}
if (
  !source.includes('label: "RECORD NOT FOUND"')
  || !source.includes('title: "NON-CANONICAL ADDRESS"')
  || !source.includes('state: "RECORD NOT PUBLISHED"')
) {
  throw new Error("Unknown Dossier routes must fail closed as an unpublished non-canonical English record");
}
if (source.includes('title: "DOSSIER RECORD"') || source.includes('state: "LIVE BUILD"')) {
  throw new Error("Unknown Dossier routes must not masquerade as a live archive record");
}

console.log("OK: Dossier reader is canonical-English UTF-8 and unknown routes fail closed");
