#!/usr/bin/env node

import { readFileSync } from "node:fs";

const source = readFileSync("app/dossier/read/[slug]/page.tsx", "utf8");
const match = source.match(/function repairLegacyEncoding<T>[\s\S]*?\r?\n}\r?\n\r?\nconst EN/);
if (!match) throw new Error("Could not locate the Dossier legacy-encoding repair helper");

const helperSource = match[0]
  .replace(/\r?\n\r?\nconst EN$/, "")
  .replace("function repairLegacyEncoding<T>(value: T): T", "function repairLegacyEncoding(value)")
  .replace("new Map<number, number>", "new Map")
  .replaceAll("const bytes: number[]", "const bytes")
  .replaceAll("codePointAt(0)!", "codePointAt(0)")
  .replaceAll(" as T", "");
const repairLegacyEncoding = Function(`${helperSource}\nreturn repairLegacyEncoding;`)();

const expected = "Başlangıç: STAR ASCENT’in kanıtı →";
const windows1252Artifact = new TextDecoder("windows-1252").decode(new TextEncoder().encode(expected));
if (repairLegacyEncoding(windows1252Artifact) !== expected) {
  throw new Error("Dossier reader did not repair Windows-1252 Turkish copy and punctuation");
}
const labelArtifact = "KANONÄ°K KAYIT";
if (repairLegacyEncoding(labelArtifact) !== "KANONİK KAYIT") {
  throw new Error("Dossier reader did not repair a Turkish dotted-I label without other mojibake markers");
}
if (repairLegacyEncoding(expected) !== expected) {
  throw new Error("Dossier reader changed already-correct Turkish copy");
}
if (!source.includes('title: "NON-CANONICAL ADDRESS"') || !source.includes('title: "KANONİK OLMAYAN ADRES"')) {
  throw new Error("Dossier reader must identify unknown routes as non-canonical in both languages");
}
if (source.includes('title: "DOSSIER RECORD"') || source.includes('state: "LIVE BUILD"')) {
  throw new Error("Dossier reader must not present an unknown route as a live archive record");
}

console.log("OK: Dossier reader repairs legacy Turkish text and marks unknown routes as non-canonical");
