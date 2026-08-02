# IAT future-feature security audit index

> **FUTURE FEATURES ONLY — NOT PART OF GENESIS — INACTIVE — NOT DEPLOYED — NO CLAIM ROUTE — MAINNET HOLD**

These source-bound internal reviews cover features that must not be available at
Genesis. They are early checks, not activation approvals and not independent
third-party audits.

| Feature | Earliest intended consideration | Technical Genesis isolation | Decision | Report |
| --- | --- | --- | --- | --- |
| Propose a Hero Promotions DLC | exactly Genesis + 8 hours, only after separate review and activation | Pass: isolated proposal branch, no deployable program | HOLD | [Hero DLC audit](iat-hero-dlc-20260802/README.md) |
| CCC Associates DLC | no later than Genesis + 1 week, with exact semantics still to be specified | **Fail: associate role is compiled into the current V2 candidate** | HOLD | [Associates DLC audit](iat-associates-dlc-20260802/README.md) |

The accepted identity unit for both reviews is one unique wallet plus one unique
immutable X user ID plus active X Premium. One person may control multiple
qualifying pairs. These reports do not use or recommend proof of personhood.

The next audit sequence should cover every remaining post-Genesis capability as
its own source-bound package before that capability receives an activation
route. A feature is not cleared merely because it appears in this index.
