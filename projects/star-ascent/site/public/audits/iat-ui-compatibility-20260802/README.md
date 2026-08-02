# IAT public UI compatibility and accessibility audit

> **DRAFT UI REVIEW — UI RELEASE HOLD — MAINNET HOLD UNCHANGED — NOT AN INDEPENDENT CERTIFICATION — NOT DEPLOYED — NO CLAIM ROUTE**

This package records a source-bound UI, functional, responsive, accessibility,
and compatibility review of the public STAR ASCENT / IAT surfaces at commit
`b584d51466ef6696af98b5c16b6dc1d7e84eb59e`.

## Decision

**UI RELEASE HOLD.** The audited public UI should not be treated as
cross-device or accessibility-ready until the two high-severity findings and
four medium-severity findings are remediated and retested. This decision does
not change, authorize, or schedule mainnet; mainnet remains independently on
`HOLD`.

The review found:

- 2 high findings;
- 4 medium findings;
- 2 low findings;
- 1 informational coverage gap;
- no critical finding.

## What was tested

- Eleven primary public routes: `/`, `/network`, `/launch`, `/proof`,
  `/signal`, `/tokenomics`, `/dossier`, `/world`, `/verify`, `/mint`, and
  `/rewards`.
- Launch-sequence entry, English/Turkish switching, local signal activation,
  activation-terminal opening and closing, callsign normalization, readiness
  acknowledgement, and all three activation tabs.
- Keyboard focus trapping, Escape close, focus restoration, skip-link behavior,
  and tab keyboard behavior.
- Read-only network lookup rejection for malformed input and successful lookup
  of the public Solana system-program address.
- `prefers-reduced-motion: reduce` behavior.
- Axe-core 4.12.1 scans on all eleven routes using WCAG 2.0 A/AA and WCAG 2.1
  A/AA rule tags.
- Chromium viewport checks at 390x844, 412x915, 768x1024, and 1440x900.
- Real headless render smoke checks on Windows Chrome 150.0.7871.187, Edge
  149.0.4022.62, and Firefox 153.0.1.
- The existing Ubuntu GitHub Actions build, rendered-HTML tests, policy gates,
  and CodeQL result at the audited commit.

## Confirmed results

### Passed

- All eleven routes loaded with one `main`, a visible H1, no broken images, and
  explicit `HOLD` / not-published language.
- Desktop launch rendering was visually consistent in real Chrome, Edge, and
  Firefox on Windows.
- The main launch interactions, local language toggle, callsign transformation,
  checkbox state, tab click selection, Escape close, and backward focus trap
  worked.
- The malformed Solana lookup was rejected and a valid public address produced
  a read-only balance/activity result and Explorer links without a wallet
  connection or signature.
- Reduced-motion emulation removed the launch-sequence, fire, and line
  animations.
- No duplicate IDs, broken images, unsafe `_blank` relationships, or browser
  runtime exceptions were observed on the home page.

### Failed or incomplete

- The opening launch headline is clipped at phone width in Chromium emulation
  and real Firefox, and the 768px layout has horizontal overflow, a clipped nav
  action, and overlapping status content in real Chrome and Firefox.
- Axe confirmed 28 contrast failures across eight of eleven routes. The scan
  also left many gradient-backed nodes for manual review.
- The activation terminal does not restore focus to its opener, does not mark
  background content inert/hidden, and implements tabs without arrow-key,
  `tabindex`, `aria-controls`, or `tabpanel` behavior.
- The skip link activates but leaves focus on the link rather than the main
  target.
- `/verify` creates 288px of horizontal document overflow at 1440px because the
  decorative orbit extends beyond the viewport.
- Invalid network lookup feedback is visible but is not exposed through an
  alert/live region.
- `/launch` emits a React unique-key error from heading-line fragments.
- Two home-page images omit intrinsic width and height metadata.

## Environment truth table

| Environment | Coverage | Result |
| --- | --- | --- |
| Windows Chrome 150 | Real headless desktop render; interactive Chromium coverage | Desktop smoke pass; responsive failures confirmed |
| Windows Edge 149 | Real headless desktop render | Pass at 1440x900 |
| Windows Firefox 153 | Real headless desktop, tablet, and phone render | Desktop pass; tablet and phone failures confirmed |
| Linux / Ubuntu | GitHub Actions build, rendered-HTML tests, policy checks, CodeQL | Pass at audited commit; no graphical browser render |
| iPhone 390x844 | Chromium viewport emulation only | Intro clipping confirmed; **not iOS Safari certification** |
| Android 412x915 | Chromium viewport emulation only | No document overflow; status-label collision observed; **not a physical-device result** |
| iOS Safari / WebKit | Not available | Not tested |
| Physical Android system browser | Not available | Not tested |
| Screen reader | Not available | Not tested |

The detailed machine-readable matrix is in
[environment-matrix.json](environment-matrix.json).

## Remediation order

1. Repair the 390–768px launch layout and add automated no-overflow assertions
   at phone, tablet, and desktop widths.
2. Fix the 28 confirmed contrast failures and manually resolve the nodes whose
   gradient backgrounds axe could not evaluate.
3. Implement a complete dialog and tab keyboard contract, restore opener focus,
   isolate background content, and make skip navigation transfer focus.
4. Clip or contain the `/verify` orbit without creating document overflow.
5. Announce network lookup results, fix the React key warning, and add image
   dimensions.
6. Run real Safari/WebKit, Linux Firefox, Android Chrome, and screen-reader
   passes before claiming compatibility.

## Package map

- [manifest.json](manifest.json) — decision, finding counts, source binding,
  and artifact hashes.
- [scope.json](scope.json) — audited routes, source hashes, and exclusions.
- [findings.json](findings.json) — machine-readable finding register.
- [FINDINGS.md](FINDINGS.md) — impact, evidence, and remediation guidance.
- [checks.json](checks.json) — commands, interactions, and measured outcomes.
- [environment-matrix.json](environment-matrix.json) — real, emulated, CI-only,
  and untested environments.

## Limitations

This was a local, source-bound, Codex-assisted audit. It was not an independent
third-party accessibility certification, physical-device lab, screen-reader
study, production penetration test, deployment, wallet interaction, signing
session, broadcast, or mainnet mutation. Headless rendering is not equivalent
to a complete user journey on a physical device. Passing build and rendered-HTML
tests on Ubuntu do not establish Linux browser compatibility.
