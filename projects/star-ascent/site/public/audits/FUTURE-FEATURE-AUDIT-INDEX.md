# IAT future-feature security audit index

> **FUTURE FEATURES ONLY - NOT PART OF GENESIS - INACTIVE - NOT DEPLOYED - NO CLAIM ROUTE - MAINNET HOLD**

These source-bound internal reviews cover features that must not be available
at Genesis. They are early checks, not activation approvals or independent
third-party audits. Their findings remain applicable to the future designs
even where the hardened Genesis source now blocks every activation path.

| Feature | Earliest intended consideration | Hardened Genesis isolation | Decision | Report |
| --- | --- | --- | --- | --- |
| Propose a Hero Promotions DLC | exactly Genesis + 8 hours, only after separate review and activation | Pass: isolated proposal branch, no deployable Genesis program or claim route | HOLD | [Hero DLC audit](iat-hero-dlc-20260802/README.md) |
| CCC Associates DLC | by Genesis + 1 week at the earliest, only after exact semantics, separate review, and activation | Pass for Genesis containment: every CCC registry, eligibility, position, randomness, round, and settlement path fails closed; no activation instruction | HOLD | [Associates DLC audit](iat-associates-dlc-20260802/README.md) |

The accepted identity unit is one unique wallet plus one unique immutable X
user ID plus active X Premium or PremiumPlus. Each X account must be at least
40 complete 24-hour periods old at its eligibility checkpoint. One person may
control multiple qualifying pairs, and the same person may legitimately collect
both sides of a future Hero pair through two distinct qualifying pairs. This is
account-farm friction and pair-level deduplication, not proof of one human or
valid payment provenance.

Enabling any future feature requires a new source-bound package, fresh tests,
independent review, explicit activation decision, and any necessary program
upgrade. A feature is not cleared merely because it appears in this index.
