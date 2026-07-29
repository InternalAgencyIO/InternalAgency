#!/usr/bin/env node

import { readFileSync } from "node:fs";

const source = readFileSync("app/dossier/read/[slug]/page.tsx", "utf8");

const extractRecordKeys = (start, end) => {
  const match = source.match(new RegExp(`${start}([\\s\\S]*?)${end}`));
  if (!match) throw new Error(`Could not locate ${start}`);
  return [...match[1].matchAll(/^  (?:"([^"]+)"|([a-z][\w-]*)): \{ label:/gm)]
    .map((entry) => entry[1] ?? entry[2]);
};

const englishKeys = extractRecordKeys(
  "const EN: Record<string, Copy> = \\{",
  "\\n\\};\\n\\nconst TR:",
);
const turkishKeys = extractRecordKeys(
  "const TR: Record<string, Copy> = \\{",
  "\\n\\};\\n\\nconst tailoredEN:",
);
const tailoredEnglishKeys = extractRecordKeys(
  "const tailoredEN: Record<string, Copy> = \\{",
  "\\n\\};\\n\\nconst tailoredTR:",
);
const tailoredTurkishKeys = extractRecordKeys(
  "const tailoredTR: Record<string, Copy> = \\{",
  "\\n\\};\\n\\nfunction fallback",
);

if (JSON.stringify(englishKeys) !== JSON.stringify(turkishKeys)) {
  throw new Error("English and Turkish canonical Dossier record inventories diverge");
}
if (JSON.stringify(tailoredEnglishKeys) !== JSON.stringify(tailoredTurkishKeys)) {
  throw new Error("English and Turkish tailored Dossier record inventories diverge");
}

const routeMatch = source.match(
  /const NEXT_RECORD_ROUTES: Record<string, string> = (\{[\s\S]*?\n\});/,
);
if (!routeMatch) throw new Error("Could not locate the Dossier next-record route map");
const nextRecordRoutes = Function(`"use strict"; return (${routeMatch[1]});`)();
const expectedNextRecordRoutes = {
  "white-dossier": "/dossier/read/tokenomics",
  tokenomics: "/dossier/read/genesis-proof",
  "mint-manifest": "/dossier/read/genesis-run",
  "genesis-proof": "/dossier/read/mint-manifest",
  "broadcast-pack": "/dossier/read/social-kit",
  "social-kit": "/dossier/read/white-dossier",
  "genesis-run": "/dossier/read/genesis-proof",
  "authority-map": "/dossier/read/genesis-proof",
  "technical-spec": "/dossier/read/mint-manifest",
  readiness: "/dossier/read/genesis-run",
  "incident-response": "/dossier",
};

if (JSON.stringify(nextRecordRoutes) !== JSON.stringify(expectedNextRecordRoutes)) {
  throw new Error("Dossier next-record destinations do not match their bilingual CTA labels");
}

const recordKeys = new Set([
  ...englishKeys,
  ...tailoredEnglishKeys,
]);
if (
  recordKeys.size !== Object.keys(nextRecordRoutes).length
  || [...recordKeys].some((slug) => !(slug in nextRecordRoutes))
) {
  throw new Error("Every bilingual Dossier record must have one canonical next-record destination");
}
for (const destination of Object.values(nextRecordRoutes)) {
  if (!destination.startsWith("/")) {
    throw new Error("Dossier next-record destinations must remain same-origin for bilingual host parity");
  }
  if (destination === "/dossier") continue;
  const targetSlug = destination.match(/^\/dossier\/read\/([^/?#]+)$/)?.[1];
  if (!targetSlug || !recordKeys.has(targetSlug)) {
    throw new Error(`Dossier next-record destination is not canonical: ${destination}`);
  }
}

if (!source.includes('const nextRecordHref = NEXT_RECORD_ROUTES[params.slug] ?? "/dossier";')) {
  throw new Error("Known and unknown Dossier routes must use the canonical navigation resolver");
}
if (!source.includes("<a href={nextRecordHref}>{record.next}")) {
  throw new Error("The bilingual next-record CTA must use the canonical resolved destination");
}
if (source.includes('"/dossier#tokenomics"')) {
  throw new Error("The next-record CTA must open the direct Tokenomics document, not its index summary");
}

console.log("OK: Dossier next-record navigation matches every English and Turkish record");
