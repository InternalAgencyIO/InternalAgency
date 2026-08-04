"use client";

import { useEffect } from "react";

const routing: Record<string, string> = {
  "star-ascent-whitepaper-v2": "white-dossier", "star-ascent-white-dossier-v2": "white-dossier", "iat-litepaper": "white-dossier", "iat-tokenomics-v1": "tokenomics", "iat-tokenomics-v2": "tokenomics", "iat-token-implementation-manifest": "mint-manifest", "iat-genesis-evidence-record": "genesis-proof", "star-ascent-broadcast-pack": "broadcast-pack", "star-ascent-genesis-social-kit": "social-kit", "star-ascent-communications-kit": "social-kit", "star-ascent-genesis-run-sheet": "genesis-run", "star-ascent-launch-rehearsal": "genesis-run", "iat-allocation-authority-checklist": "authority-map", "iat-solana-technical-spec": "technical-spec", "star-ascent-readiness-scorecard": "readiness", "star-ascent-incident-response": "incident-response",
};

function readerPath(href: string) {
  const filename = href.split("/").pop()?.replace(/\.(txt|mjs)$/i, "") ?? "";
  return `/dossier/read/${routing[filename.replace(/-(en|tr)$/i, "")] ?? "archive-record"}`;
}

export function DocumentLinkUpgrade() {
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/disclosures/"], a[href$=".mjs"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href) { link.href = readerPath(href); link.removeAttribute("download"); }
    });
  }, []);
  return null;
}
