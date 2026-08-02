# UI audit findings - remediation revision

> **DRAFT - UI RELEASE HOLD - MAINNET HOLD UNCHANGED - NOT DEPLOYED**

## Closed findings

### UI-RESP-001 - HIGH - CLOSED

Responsive constraints now contain the launch headline, navigation, status
rows, and all route documents. Chromium and Firefox pass at 768x1024;
Chromium Pixel 5 and WebKit iPhone 13 emulation pass their home-layout checks.

### UI-A11Y-001 - HIGH - CLOSED

Contrast-safe route tokens replaced the failing pairs. The targeted axe
`color-contrast` rule reports zero confirmed violations across all eleven
routes in seven profiles. Manual gradient and physical assistive-technology
review remains part of the open coverage boundary.

### UI-A11Y-002 - MEDIUM - CLOSED

The activation dialog now isolates background siblings, traps focus, restores
the exact opening control, and implements roving tabs with `aria-controls`,
`tabpanel`, arrow, Home, and End behavior. The keyboard contract passes in all
seven profiles.

### UI-LAYOUT-001 - MEDIUM - CLOSED

The decorative `/verify` orbit is clipped and paint-contained. The route matrix
reports no horizontal document overflow in desktop or tablet engines.

### UI-A11Y-003 - MEDIUM - CLOSED

Skip activation moves focus to main; heading order, landmarks, and generic
ARIA semantics are repaired. Targeted axe checks and an explicit unsupported
generic-label assertion pass.

### UI-A11Y-004 - MEDIUM - CLOSED

Network lookup loading/completion uses a polite status, invalid input uses an
alert, and the invoking button retains focus across the asynchronous path. The
behavior passes in all seven profiles.

### UI-FUNC-001 - LOW - CLOSED

Localized launch-title fragments now have stable keys. No matching React
console defect appears in the browser matrix.

### UI-PERF-001 - LOW - CLOSED

The two audited home images now publish exact intrinsic dimensions, lazy
loading, and asynchronous decoding metadata. The intrinsic-dimension assertion
passes in all profiles.

## Open finding

### UI-COVERAGE-001 - INFO - OPEN

Physical iOS Safari, physical Android, graphical Linux, screen readers and
other assistive technologies, and independent review were unavailable.
Playwright WebKit and mobile device emulation do not replace those sessions.

**Required follow-up:** repeat the route, interaction, overflow, screenshot,
and assistive-technology matrix in a real device/browser lab and publish a new
source-bound revision. This informational gap keeps the UI release decision on
`HOLD`; it does not alter the independent mainnet `HOLD`.
