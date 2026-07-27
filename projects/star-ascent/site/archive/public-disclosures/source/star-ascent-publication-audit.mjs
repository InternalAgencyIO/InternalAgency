/*
 * STAR ASCENT PUBLICATION AUDIT SCAFFOLD
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module checks a supplied bundle of public
 * document text. It does not make network requests, inspect Solana, approve a
 * launch, or prove that linked evidence is current or authentic.
 */

const bilingualPairs = [
  {
    id: "allocation-authority-checklist",
    en: "iat-allocation-authority-checklist-en.txt",
    tr: "iat-allocation-authority-checklist-tr.txt",
    markers: {
      en: ["PRE-LAUNCH TEMPLATE", "Distribution must remain paused"],
      tr: ["LANSMAN ÖNCESİ ŞABLON", "dağıtım durmalıdır"],
    },
  },
  {
    id: "litepaper",
    en: "iat-litepaper-en.txt",
    tr: "iat-litepaper-tr.txt",
    markers: {
      en: ["PRE-LAUNCH DESIGN DRAFT", "Distribution must remain paused"],
      tr: ["LANSMAN ÖNCESİ TASARIM TASLAĞI", "Dağıtım durmalıdır"],
    },
  },
  {
    id: "solana-technical-specification",
    en: "iat-solana-technical-spec-en.txt",
    tr: "iat-solana-technical-spec-tr.txt",
    markers: {
      en: ["NO LIVE MINT OR DEPLOYMENT", "Private keys, seed phrases, and passwords"],
      tr: ["CANLI MINT VEYA DAĞITIM YOKTUR", "Özel anahtarlar, seed phrase'ler ve şifreler"],
    },
  },
  {
    id: "launch-communications-kit",
    en: "star-ascent-communications-kit-en.txt",
    tr: "star-ascent-communications-kit-tr.txt",
    markers: {
      en: ["PRE-LAUNCH DRAFT", "No token address, price, chart, wallet balance"],
      tr: ["LANSMAN ÖNCESİ TASLAK", "Token adresi, fiyat, grafik, cüzdan bakiyesi"],
    },
  },
  {
    id: "launch-rehearsal",
    en: "star-ascent-launch-rehearsal-en.txt",
    tr: "star-ascent-launch-rehearsal-tr.txt",
    markers: {
      en: ["A REHEARSAL IS NOT LAUNCH APPROVAL", "Any HOLD or FAIL"],
      tr: ["PROVA, LANSMAN ONAYI DEĞİLDİR", "Her BEKLET veya BAŞARISIZ"],
    },
  },
  {
    id: "readiness-scorecard",
    en: "star-ascent-readiness-scorecard-en.txt",
    tr: "star-ascent-readiness-scorecard-tr.txt",
    markers: {
      en: ["CURRENT DECISION: HOLD", "Any HOLD or FAIL blocks"],
      tr: ["MEVCUT KARAR: BEKLET", "BEKLET veya BAŞARISIZ durumu"],
    },
  },
  {
    id: "incident-response",
    en: "star-ascent-incident-response-en.txt",
    tr: "star-ascent-incident-response-tr.txt",
    markers: {
      en: ["DEFAULT DECISION: HOLD", "Support will not resolve an incident through a private message"],
      tr: ["VARSAYILAN KARAR: BEKLET", "Destek bir olayı özel mesajla çözmez"],
    },
  },
];

const sharedFiles = [
  {
    path: "iat-allocation-validator.mjs",
    markers: ["DESIGN AND LOCAL TEST CODE ONLY", "cannot connect to a wallet"],
  },
  {
    path: "iat-authority-plan-validator.mjs",
    markers: ["DESIGN AND LOCAL TEST CODE ONLY", "cannot query", "distribution must remain blocked"],
  },
  {
    path: "star-ascent-release-packet-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "cannot approve a launch", "readiness decision must remain HOLD"],
  },
  {
    path: "star-ascent-evidence-ledger-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "makes no network calls", "readiness decision must remain HOLD"],
  },
  {
    path: "star-ascent-readiness-snapshot-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "cannot approve a launch", "readiness decision must remain HOLD"],
  },
  {
    path: "star-ascent-rehearsal-trace-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "cannot approve a launch", "readiness decision must remain HOLD"],
  },
  {
    path: "star-ascent-change-freeze-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "human-approved manifest", "cannot approve a launch"],
  },
  {
    path: "star-ascent-launch-handoff-validator.mjs",
    markers: ["LOCAL, DETERMINISTIC QA ONLY", "role-separated human handoff", "cannot approve a launch"],
  },
];

export const PUBLICATION_MANIFEST = Object.freeze({
  bilingualPairs: Object.freeze(bilingualPairs),
  sharedFiles: Object.freeze(sharedFiles),
});

function readBundleFile(bundle, path) {
  const value = bundle instanceof Map ? bundle.get(path) : bundle?.[path];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`missing or empty publication file: ${path}`);
  }
  return value;
}

function requireMarkers(content, path, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) {
      throw new Error(`missing critical marker in ${path}: ${marker}`);
    }
  }
}

export function auditPublicationBundle(bundle) {
  const auditedFiles = new Set();

  for (const pair of PUBLICATION_MANIFEST.bilingualPairs) {
    for (const language of ["en", "tr"]) {
      const path = pair[language];
      const content = readBundleFile(bundle, path);
      requireMarkers(content, path, pair.markers[language]);
      auditedFiles.add(path);
    }
  }

  for (const file of PUBLICATION_MANIFEST.sharedFiles) {
    const content = readBundleFile(bundle, file.path);
    requireMarkers(content, file.path, file.markers);
    auditedFiles.add(file.path);
  }

  return Object.freeze({
    criticalMarkerStatus: "pass",
    fileCount: auditedFiles.size,
    languagePairCount: PUBLICATION_MANIFEST.bilingualPairs.length,
    networkChecked: false,
    readinessDecision: "HOLD",
  });
}
