const routes: Record<string, string> = {
  "star-ascent-whitepaper-v2": "white-dossier",
  "star-ascent-white-dossier-v2": "white-dossier",
  "iat-litepaper": "white-dossier",
  "iat-tokenomics-v1": "tokenomics",
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
};

export function GET(request: Request, { params }: { params: Promise<{ legacy: string }> }) {
  return params.then(({ legacy }) => {
    const key = legacy.replace(/\.(txt|mjs)$/i, "").replace(/-(en|tr)$/i, "");
    return Response.redirect(new URL(`/dossier/read/${routes[key] ?? "archive-record"}`, request.url), 308);
  });
}
