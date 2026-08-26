import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public launch copy stays conditional and HOLD-safe", async () => {
  const [home, press, pressDeck, signal, verify, proof, reader] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/press/page.tsx"),
    read("../app/press/PressCopyDeck.tsx"),
    read("../app/signal/page.tsx"),
    read("../app/verify/page.tsx"),
    read("../app/proof/page.tsx"),
    read("../app/dossier/read/[slug]/page.tsx"),
  ]);

  assert.match(home, /BROADCAST STATUS/);
  assert.match(home, /before any Mainnet decision can be considered/);
  assert.doesNotMatch(home, /LIVE BROADCAST|mainnet can unlock/);

  assert.match(press, /MAINNET HOLD/);
  assert.match(press, /No launch window or claim route is scheduled/);
  assert.match(pressDeck, /DRAFT · DO NOT PUBLISH · NO WINDOW SCHEDULED/);
  assert.match(pressDeck, /HOLD-SAFE DRAFT COPY/);
  assert.doesNotMatch(`${press}\n${pressDeck}`, /THE SIGNAL OPENS IN ONE HOUR|The room is open|SHARE-READY COPY/);

  assert.match(signal, /CHANNELS PENDING VERIFICATION/);
  assert.doesNotMatch(signal, /CHANNELS ACTIVATING/);
  assert.match(verify, /TRUST ONLY A PUBLISHED ROUTE/);
  assert.match(verify, /MAINNET HOLD → LAUNCH CONTROL/);
  assert.doesNotMatch(verify, /MOVE ONLY ON THE LIVE ROUTE|THE LIVE ORDER/);
  assert.match(proof, /OPEN JSON/);
  assert.doesNotMatch(proof, /DOWNLOAD JSON/);
  assert.match(proof, /Reference run 32937913614 failed 3 retained-v2 parity assertions/);
  assert.match(proof, /No passing current-source artifact is bound on this board/);
  assert.match(proof, /Mainnet is UNSCHEDULED HOLD/);
  assert.doesNotMatch(proof, /passed on the public PR head|full verifiable SBF rehearsal are green|DEVNET PROOF ONLINE|AUG(?:UST)?\s+27/i);

  assert.match(reader, /fee payer must be signed/);
  assert.match(reader, /must be published together/);
  assert.match(reader, /must be confirmed before any Mainnet action is considered/);
});

test("legacy disclosure links resolve honestly and unknown IDs fail closed", async () => {
  const [route, upgrade, home] = await Promise.all([
    read("../app/disclosures/[legacy]/route.ts"),
    read("../app/DocumentLinkUpgrade.tsx"),
    read("../app/page.tsx"),
  ]);

  for (const routeKey of [
    "iat-allocation-validator",
    "iat-authority-plan-validator",
    "star-ascent-publication-audit",
    "star-ascent-release-packet-validator",
    "star-ascent-evidence-ledger-validator",
    "star-ascent-readiness-snapshot-validator",
    "star-ascent-rehearsal-trace-validator",
    "star-ascent-change-freeze-validator",
    "star-ascent-launch-handoff-validator",
  ]) {
    assert.ok(route.includes(JSON.stringify(routeKey)), `${routeKey} server mapping`);
    assert.ok(upgrade.includes(JSON.stringify(routeKey)), `${routeKey} client mapping`);
  }
  assert.match(route, /status: 410/);
  assert.match(upgrade, /replace\(\/\-\(\?:en\|tr\)\$\/i, ""\)/);
  assert.match(home, /canonical Dossier context, not executable downloads or preserved validator bytes/);
  assert.doesNotMatch(home, /Open archived [^"\n]*validator record/);
});
