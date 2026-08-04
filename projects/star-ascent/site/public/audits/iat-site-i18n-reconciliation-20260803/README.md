# DRAFT visible-source localization reconciliation

**DRAFT / TRANSLATION HOLD / NATIVE REVIEW HOLD / RUNTIME INACTIVE / MAINNET HOLD / NOT DEPLOYED / NO LAUNCH AUTHORITY**

This source-bound package converts the previously counted 247 uncataloged visible strings into an explicit pending workflow. It captures every string, records every affected canonical route, assigns a status for all 50 supported locales, and validates that none of the pending copy is silently activated at runtime.

## Result

- 25 canonical routes scanned.
- 247 visible strings captured on the same 15 affected routes reported by the prior audit.
- Zero counted strings remain untracked by either the active catalog or the pending workflow.
- English source is captured but not activated through the pending artifact.
- All 49 non-English locales are explicitly `TRANSLATION_AND_NATIVE_REVIEW_REQUIRED`.
- Automatic English fallback approval, translation completion, native review, and runtime activation are all false.

This closes the inventory and workflow gap. It does **not** close the translation or native-quality finding. The existing 1,280-string active catalog remains unchanged, and no generated pending copy is served to localized URLs.

## Source binding

The captured site source and workflow are bound to commit `b88402cbcc7151610b37573c887b7ea080f092c1`, Git tree `d778eb80420f510e2003f359903f41981aba98a6`. The validator checks that exact tree, source hashes, the 247-string/15-route reproduction, all 50 locale states, and every false runtime/approval flag.

## Continuous drift guard

Commit `c400b430434f21f52fd5da559017f3b5ce55e5bc`, Git tree `580421a2f9b84c3a2bdcc5059f1d8a5bf4251595`, adds a rendered-source drift gate to `check:qa:i18n`. The gate reserves an ephemeral loopback port, binds a fresh Vinext process to that exact address, renders all 25 canonical routes, and compares stable hashes of the complete pending source/route inventory against this reviewed artifact. Added, removed, moved, or changed pending copy fails the gate and requires explicit recapture and review.

The gate does not translate, approve, or activate any pending copy. It also does not trust an unrelated server that may already be running on a familiar development port.

## Remaining work

Accountable translation, protected-term review, layout regression, and native-speaker approval remain required for every non-English locale before pending copy may enter the active catalog. No third-party translation service, deployment, DNS change, wallet access, signing, broadcast, funding, or chain mutation occurred in this increment.
