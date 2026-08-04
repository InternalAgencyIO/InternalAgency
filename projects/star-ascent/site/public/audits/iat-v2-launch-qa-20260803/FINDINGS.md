# IAT V2 launch QA findings

> **DRAFT - QA HOLD - MAINNET HOLD - NOT DEPLOYED - NO LAUNCH AUTHORITY**

## Closed

### QA-RUNTIME-001 - unused font loader emitted blocked module requests (medium)

The stronger console-error assertion exposed blocked `file://` font requests
from an unused `next/font` loader in the Vinext development runtime. The site
already uses explicit CSS font stacks, so the dead loader and its unused body
variables were removed. The strengthened 35-case matrix then passed with zero
page exceptions or console errors.

## Open

### QA-LIVE-001 - live public routing differs from reviewed source (high)

Read-only checks observed four 404s, two incorrect V2 tokenomics redirects, and
two sitemap omissions across the two public origins. This blocks a claim that
the reviewed launch surface is what visitors currently receive. Resolution
requires an explicitly authorized deployment/reconciliation workflow and a
fresh read-only verification; this QA pass did not deploy.

### QA-L10N-001 - Turkish public metadata needs fluent review (medium)

The Turkish origin root used the English brand title, and multiple observed
Turkish route titles were visibly mistranslated. Automated title checks also
contain generic expectations that conflict with intentional route-specific
English titles. Reconcile the metadata contract, then require a fluent Turkish
reviewer to approve the public strings. Do not mass-replace valid English
route titles merely to silence the current checker.

### QA-ADMIN-001 - local admin bundle warnings need runtime closure (medium)

The isolated admin console builds, but Vite reports browser-externalized
`util`/`crypto` imports from Switchboard dependencies and a roughly 2.15 MB
chunk (about 488 kB gzip). Before ceremony use, exercise the built console in
its localhost-only environment and prove every required read/build path works.
This is not a public-site or transaction authorization.

### QA-DEPS-001 - development dependency advisories remain (medium)

`npm audit --omit=dev` reports zero production advisories. The full site audit
reports 22 development-only advisories: 15 moderate and seven high. Review
upstream fixes and lockfile impact separately; do not accept a breaking toolchain
upgrade during the launch freeze without reproducing the full gate matrix.

### QA-COVERAGE-001 - external environment coverage is incomplete (info)

No physical iOS/Android device, installed mobile Safari, graphical Linux
desktop, screen reader, switch/voice control, throttled performance lab, or
independent third-party QA session was available. Emulation is useful regression
evidence but is not a substitute for those environments.
