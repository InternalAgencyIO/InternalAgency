# UI audit findings

> **DRAFT — UI RELEASE HOLD — MAINNET HOLD UNCHANGED — NOT DEPLOYED**

## UI-RESP-001 — HIGH — Core launch layout fails at phone and tablet widths

At 390x844 the launch-sequence H2 is visibly clipped in Chromium emulation and
real Firefox 153. At 768x1024 the page creates 98px of horizontal overflow, the
operator-registration nav action exits the viewport, and the launch status
rows overlap. Real Chrome 150 and Firefox 153 reproduce the tablet failure.

**Impact:** phone and tablet users can lose headline, navigation, and launch
status content on the primary public surface.

**Remediation:** introduce a tablet breakpoint before the desktop nav becomes
wider than the viewport, constrain the launch heading by available inline size,
and make the status rows wrap as labeled blocks. Add automated assertions at
390, 412, 768, 1024, and 1440 CSS pixels.

## UI-A11Y-001 — HIGH — Confirmed contrast failures across public routes

Axe-core 4.12.1 confirmed 28 `color-contrast` failures across `/`, `/network`,
`/launch`, `/proof`, `/tokenomics`, `/dossier`, `/world`, `/mint`, and
`/rewards`. Examples include the home mission eyebrow at 3.12:1, a home status
eyebrow at 1.39:1, and network pulse text at 4.04:1 where 4.5:1 was required by
the executed rule. `/signal` and `/verify` had no confirmed contrast violation
in this automated pass. Axe could not automatically determine contrast for many
gradient-backed nodes, so the confirmed count is a lower bound.

**Impact:** low-vision users may be unable to read launch state, evidence, and
navigation text.

**Remediation:** use semantic color tokens with tested foreground/background
pairs, then manually test all gradient-backed content and focus states.

## UI-A11Y-002 — MEDIUM — Activation dialog and tabs have an incomplete keyboard contract

The activation terminal traps backward focus and closes on Escape, but closing
it leaves focus on `BODY` instead of the opening control. Background `main` and
`nav` content is neither inert nor `aria-hidden`. The three tab buttons do not
respond to arrow keys and omit roving `tabindex`, `aria-controls`, and
`tabpanel` relationships.

**Impact:** keyboard and screen-reader users can lose context, traverse
background controls while the dialog is open, or encounter tabs that do not
behave as their roles promise.

**Remediation:** store and restore the opener, isolate siblings while the modal
is active, and implement the full tab keyboard/ARIA pattern.

## UI-LAYOUT-001 — MEDIUM — `/verify` creates desktop horizontal overflow

At a 1440x900 viewport, `/verify` reports a 1425px client width and 1713px
scroll width. The absolute `.verify-orbit` decorative element extends from 961px
to 1713px.

**Impact:** desktop users receive an unnecessary horizontal scrollbar and can
pan into decorative empty space.

**Remediation:** contain or clip the decoration within `.verify-page` without
hiding meaningful content, and test all route roots for zero horizontal
document overflow.

## UI-A11Y-003 — MEDIUM — Focus navigation and semantic landmarks need repair

The skip link activates but focus remains on the link rather than moving to the
main target. The launch sequence begins with an H2 before the page H1. Axe also
reported `aria-label` use on generic `div` elements as incomplete because the
labels are not consistently supported without a valid semantic role, and found
two home-page nodes outside landmarks.

**Impact:** screen-reader and keyboard users receive a less predictable outline
and navigation path.

**Remediation:** move focus to `#main-content`, make the page outline start with
the H1 or give the introductory region an appropriate structure, replace
generic labeled divs with semantic elements/roles, and place floating/safety
content in appropriate landmarks.

## UI-A11Y-004 — MEDIUM — Network lookup results are not programmatically announced

Malformed lookup input correctly renders `! INVALID SOLANA ADDRESS OR
SIGNATURE`, but no result-specific `role="alert"` or `aria-live` region is
present and focus moves to `BODY` after submission. The valid public-address
lookup otherwise succeeds and renders read-only activity and Explorer links.

**Impact:** screen-reader users may not know that lookup processing completed
or why it failed.

**Remediation:** keep focus stable, expose status through a polite live region,
and use an alert for validation failures.

## UI-FUNC-001 — LOW — `/launch` emits a React unique-key error

The browser console reports: `Each child in a list should have a unique "key"
prop` in `LaunchPage`. The source maps title lines to anonymous fragments.

**Impact:** current static rendering survives, but React reconciliation can
associate the wrong fragment if the localized heading changes.

**Remediation:** add a stable key to each mapped fragment or avoid the mapped
fragment list.

## UI-PERF-001 — LOW — Two home images omit intrinsic dimensions

`/images/outer-comms-v1.webp` and `/images/ascent-ritual-v1.webp` have no width
or height attributes. Both loaded successfully in the audit.

**Impact:** layout stability depends on CSS and image discovery rather than a
reserved intrinsic aspect ratio.

**Remediation:** publish width/height or `aspect-ratio` metadata matching the
source assets and confirm no layout shift.

## UI-COVERAGE-001 — INFO — Requested platform certification is incomplete

Real Windows Chrome, Edge, and Firefox were available. Linux coverage was
limited to GitHub Actions build/rendered-HTML tests and CodeQL. iPhone and
Android checks used viewport emulation; no iOS Safari/WebKit, physical Android,
Linux graphical browser, or screen reader was available.

**Impact:** the package cannot honestly certify those environments.

**Remediation:** run the same route, interaction, accessibility, screenshot,
and no-overflow matrix in a real device/browser lab and publish a source-bound
follow-up.
