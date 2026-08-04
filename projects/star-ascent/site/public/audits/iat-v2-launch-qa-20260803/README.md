# IAT V2 launch QA consolidation

> **DRAFT - QA HOLD - MAINNET HOLD - NOT DEPLOYED - NOT AN INDEPENDENT CERTIFICATION - NO CLAIM ROUTE**

This package records the 2026-08-03 launch-readiness QA pass for the source at
commit `4b7b121640e65586aaadf2fcf2c6d5b96808108b`. It combines local browser,
build, policy, security-regression, release-gate, dependency, and read-only
public-route observations without granting any launch authority.

## Decision

The reviewed source passes its automated local gates, but the overall decision
remains **QA HOLD / MAINNET HOLD**.

The immediate browser defect found by the stronger suite is closed: an unused
`next/font` loader caused blocked local font module requests. The loader was
removed and every audited route now fails regression testing on non-200 page
responses, browser exceptions, console errors, broken images, mojibake,
overflow, missing document language/title, unsupported generic ARIA labels,
or the selected axe rules.

Five findings remain open:

- the live public deployment diverges from the reviewed launch source;
- live Turkish metadata/content needs bilingual human reconciliation;
- the local admin bundle retains Node-compatibility and size warnings;
- development-only dependencies report upstream advisories;
- physical-device, graphical Linux, assistive-technology, performance-lab,
  and independent-review coverage is unavailable.

## Verified local outcomes

- Production Vinext build: **PASS**.
- Rendered HTML suite: **19/19 PASS**.
- Playwright/Axe matrix: **35/35 PASS** across seven automated profiles.
- Lint: **0 errors**, eight existing `<img>` optimization warnings.
- Production dependency audit: **0 advisories**.
- IAT V2 suite: **65/65 PASS IN HOLD**.
- Independent signoff validators: **valid HOLD**; fresh initialization/current
  remediation signoff remains pending.
- Complete launch-gate chain: **PASS IN HOLD**.
- Mainnet funding observation: `2,533,659,570` lamports against the exact
  `8,500,000,000` lamport floor; `UNSCHEDULED_HOLD` remains enforced.

## Read-only live observation

At `2026-08-03T05:41:05Z`, `npm run check:public` made read-only HTTPS requests
to `internalagency.io` and `ileriakil.com` and returned **FAIL** with 46 contract
mismatches. Thirty legacy disclosure redirects and both robots files passed.

Eight failures are direct routing/publication drift indicators:

- `/tokenomics` and `/network` return 404 on both origins (four failures);
- both V2 tokenomics disclosure URLs redirect to `archive-record` instead of
  `tokenomics` (two failures);
- both sitemap checks omit the canonical `/tokenomics` URL (two failures).

The other 38 failures are title/description contract mismatches. Several
route-specific English titles are reasonable but differ from the checker's
generic expected title, so those results require contract reconciliation rather
than automatic replacement. The Turkish root is served with the English brand
title and multiple Turkish route titles are visibly low-quality translations;
they require a fluent human review before any claim of bilingual parity.

No production edit or deployment was attempted.

## Automated environment matrix

| Profile | Result |
| --- | --- |
| Chromium desktop 1440x900 | PASS |
| Firefox desktop 1440x900 | PASS |
| WebKit desktop 1440x900 | PASS |
| Chromium tablet 768x1024 | PASS |
| Firefox tablet 768x1024 | PASS |
| Pixel 5 Chromium emulation | PASS |
| iPhone 13 WebKit emulation | PASS |

These are headless/emulated results on a Windows host. They are not physical
iOS/Android or installed Safari certification.

## Package map

- `manifest.json` - source binding, decision, finding counts, and digests.
- `scope.json` - included source and explicit exclusions.
- `checks.json` - machine-readable results and measurements.
- `findings.json` - machine-readable finding register.
- `FINDINGS.md` - reviewer-oriented finding detail.
- `environment-matrix.json` - executed and unavailable environments.

## Safety boundary

This was a local, Codex-assisted QA pass plus read-only public HTTP checks. No
wallet, key, secret, hardware signer, signing request, transaction simulation,
broadcast, transfer, mint, deployment, DNS, mainnet, or devnet mutation was
performed. This package does not authorize any of those actions.
