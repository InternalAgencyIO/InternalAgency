# IAT public UI compatibility and accessibility audit

> **DRAFT UI REVIEW - UI RELEASE HOLD - MAINNET HOLD UNCHANGED - NOT AN INDEPENDENT CERTIFICATION - NOT DEPLOYED - NO CLAIM ROUTE**

This revision records remediation and source-bound verification of the public
STAR ASCENT / IAT UI at commit
`eb43a854552ccebaf42efe86bb67a433d2495937`.

## Decision

Eight implementation findings are **closed by automated regression evidence**:
two high, four medium, and two low. One informational coverage finding remains
open because physical iOS/Android, graphical Linux, assistive-technology, and
independent-review sessions were unavailable.

The package remains **UI RELEASE HOLD**. It does not authorize or schedule a
deployment, signing ceremony, transaction, funding action, or mainnet change.
Mainnet remains independently on `HOLD`.

## Remediation verified

- Responsive headline, navigation, status, and route containment at desktop,
  768px tablet, Pixel 5, and iPhone 13 emulation profiles.
- Contrast-token changes that clear the targeted axe `color-contrast` rule on
  all eleven public routes in all seven profiles.
- Complete activation-dialog focus isolation/restoration and tab keyboard/ARIA
  relationships.
- Skip-link focus transfer, heading order, supported ARIA semantics, and
  landmark containment.
- Programmatic network loading/error feedback with focus preserved.
- `/verify` decorative containment, stable React fragment keys, and intrinsic
  home-image dimensions.

## Automated evidence

Playwright 1.62.1 ran 35 cases with 35 passing and zero failing:

| Profile | Viewport / device | Result |
| --- | --- | --- |
| Chromium desktop | 1440x900 | PASS |
| Firefox desktop | 1440x900 | PASS |
| WebKit desktop | 1440x900 | PASS |
| Chromium tablet | 768x1024 | PASS |
| Firefox tablet | 768x1024 | PASS |
| Chromium Pixel 5 emulation | Playwright device profile | PASS |
| WebKit iPhone 13 emulation | Playwright device profile | PASS |

The suite covers all eleven primary routes, broken images, document overflow,
the targeted axe rules, unsupported generic ARIA labels, home headline fit,
image dimensions, skip focus, modal isolation, tab keys, focus restoration,
network alerts/focus, and the React child-key console defect.

The source commit also passed the production build, lint with zero errors,
41/41 Node tests, IAT V2 HOLD policy gates, source-bound evidence checks,
canonical JSON checks, funding-observation regression, ceremony-entry
regression, and corrected feature signoff. Independent initialization signoff
remains pending by design.

## Open coverage boundary

`UI-COVERAGE-001` remains open. The automated WebKit and mobile profiles are
useful regression evidence, but they are not physical-device or installed
mobile-browser certification. No claim is made for:

- physical iOS Safari;
- physical Android system browser;
- a graphical Linux desktop session;
- screen reader, switch control, or voice control;
- independent third-party review;
- network-throttling or performance-laboratory scoring.

## Package map

- [manifest.json](manifest.json) - decision, counts, source binding, and hashes.
- [scope.json](scope.json) - routes, exact source hashes, inclusions, exclusions.
- [findings.json](findings.json) - machine-readable finding register.
- [FINDINGS.md](FINDINGS.md) - closure evidence and remaining gap.
- [checks.json](checks.json) - measured outcomes and limitations.
- [environment-matrix.json](environment-matrix.json) - automated and unavailable environments.

## Safety boundary

This was a local, Codex-assisted audit and code-remediation pass. No wallet,
key, secret, signing device, funds, deployment, transaction, DNS, mainnet, or
devnet state was accessed or changed.
