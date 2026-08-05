const routes: Record<string, string> = {
  "star-ascent-whitepaper-v2": "white-dossier",
  "star-ascent-white-dossier-v2": "white-dossier",
  "iat-litepaper": "white-dossier",
  "iat-tokenomics-v1": "tokenomics",
  "iat-tokenomics-v2": "tokenomics",
  "iat-token-implementation-manifest": "mint-manifest",
  "iat-genesis-evidence-record": "genesis-proof",
  "star-ascent-broadcast-pack": "broadcast-pack",
  "star-ascent-genesis-social-kit": "social-kit",
  "star-ascent-communications-kit": "social-kit",
  "star-ascent-genesis-run-sheet": "genesis-run",
  "star-ascent-launch-rehearsal": "genesis-run",
  "iat-allocation-authority-checklist": "authority-map",
  "iat-solana-technical-spec": "technical-spec",
  "star-ascent-readiness-scorecard": "readiness",
  "star-ascent-incident-response": "incident-response",
  "iat-allocation-validator": "authority-map",
  "iat-authority-plan-validator": "authority-map",
  "star-ascent-publication-audit": "readiness",
  "star-ascent-release-packet-validator": "readiness",
  "star-ascent-evidence-ledger-validator": "genesis-proof",
  "star-ascent-readiness-snapshot-validator": "readiness",
  "star-ascent-rehearsal-trace-validator": "genesis-run",
  "star-ascent-change-freeze-validator": "readiness",
  "star-ascent-launch-handoff-validator": "readiness",
};

export function GET(request: Request, { params }: { params: Promise<{ legacy: string }> }) {
  return params.then(({ legacy }) => {
    const key = legacy.replace(/\.(txt|mjs)$/i, "").replace(/-(en|tr)$/i, "");
    const route = routes[key];
    if (!route) return new Response("Disclosure record unavailable.", { status: 410 });
    return Response.redirect(new URL(`/dossier/read/${route}`, request.url), 308);
  });
}
