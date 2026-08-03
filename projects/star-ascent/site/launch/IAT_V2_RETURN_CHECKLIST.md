# IAT V2 return checklist

Updated at `2026-08-03T05:41:05Z`.

Mainnet remains `HOLD`. No unattended script may sign or broadcast a mainnet
transaction.

Canonical machine-readable readiness state:
`launch/iat-v2-mainnet-readiness-gate.json`. Its validator enforces the exact
integer funding shortfall, `UNSCHEDULED_HOLD`, regeneration order, local
time-gate limitations, and false values for every signing/broadcast side
effect.

## Completed historical Devnet sequence

The records below remain valid for their exact prior binary. They do not cover
the current hardened source and cannot clear its SBF or fresh Devnet gates.

- Program: `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`
- ProgramData: `6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP`
- Program administrator / community custody:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- Corrected deployed artifact SHA-256:
  `634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7`
- Program bytes: `597336`
- Corrected artifact deployment slot: `480117343`
- The temporary Devnet upgrade buffer
  `GvZjpzaDyX3w5q3AvfmXgnZFRz8xoevkAXKdutU3dfkN` is closed and no longer an
  upgrade route.
- Latest feature evidence:
  `public/evidence/iat-v2/v2-features-20260801T053340Z.json`
- Latest read-only receipt:
  `public/evidence/iat-v2/chain-status-20260801T053947Z.json`
- Feature result: all 18 immediately available actions are recorded, including
  standard and CCC-linked week-8 outcomes and CCC round 8.
- Canonical chain result: `29 / 29` signatures finalized with no reported error.
- Corrected-program feature review: **VERIFIED** at
  `2026-08-01T05:57:36Z` through an operator-relayed FDF Guard approval.
- Feature evidence status remains
  `PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW` because later
  maturity, cliff, and linear-unlock gates are outside the signed snapshot.
  That immutable export status is retained for audit history. Its prior-artifact
  review is complete; the hardened source still requires a fresh signed Devnet
  run and independent comparison.
- Current hardened-source local time-gate evidence:
  `public/evidence/iat-v2/v2-local-time-gate-proof-hardening-20260802T130622Z.json`.
- Local result: **VERIFIED LOCAL HOST ONLY** with 39 exact vectors, six Rust
  host tests, and 16 JavaScript tests. An earlier proof corrected a one-week
  reference-engine-only maturity drift. The current hardened program changes
  and 579,480-byte SBF are separately bound by the audit package.

## Next launch sequence

1. Independently reproduce the current SBF and compare SHA-256
   `d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4`.
2. Run the complete signed Devnet rehearsal against that exact binary and
   obtain an independent source/binary/account/receipt comparison.
3. Rehearse X OAuth and Cloudflare D1 duplicate, timeout, rollback, retry, and
   final-slot contention cases in a non-production environment without
   retaining credentials or personal data.
4. Fund `7XZ...fzPH` on mainnet to at least `8.5 SOL` before the ceremony.
5. Record a fresh read-only balance observation and recompute both integer
   shortfalls with `npm run refresh:iat-v2-mainnet-funding`. The command uses
   the official mainnet RPC at finalized commitment, records the context slot,
   accepts no wallet or RPC arguments, and never lifts mainnet `HOLD`.
6. After funding is complete, publish one new exact UTC launch time.
7. Re-run the complete launch preflight and regenerate every bound release
   snapshot, handoff, manifest, signing checklist, and publication payload.
8. Independently validate the regenerated packet and local host-program
   time-gate proof; never represent the latter as a signed Devnet snapshot or
   validator transaction.
9. Keep draft PR #4 unmerged until checks and the remaining gates are complete.
10. At the newly scheduled ceremony only, the operator physically reviews and signs
   each mainnet transaction. Broadcasting remains a separate explicit action.
11. Before the first stage, validate the source-bound
   `launch/iat-v2-mainnet-stage-journal.template.json` as `ARMED`. After every
   confirmed stage, stop for independent post-state reconciliation. The first
   failure, mismatch, or unresolved submission permanently ends that journal in
   `TERMINAL_HOLD`; never retry an unknown signature or create a compensating
   transaction.
12. Reconcile confirmed chain state and validate all eight journal stages as
   `FINALIZED_MATCHED` before publishing any mint, authority,
   allocation, vesting, or claim-route statement.

The final attended session must enter through
`node scripts/run-launch-preflight.mjs --require-ceremony-ready`. The ordinary
preparation preflight can pass while blockers remain and never grants ceremony
entry. See `launch/IAT_V2_CEREMONY_ENTRY_GATE.md`.

## Mainnet blockers that must stay visible

- The source-bound launch QA package at
  `public/audits/iat-v2-launch-qa-20260803/` passes 35/35 automated browser
  cases, the production build, 19/19 rendered-page tests, 65/65 V2 tests, and
  the complete local launch-gate chain. It remains `QA HOLD`: read-only live
  checks found four `/tokenomics` or `/network` 404s, two incorrect V2
  tokenomics redirects, two sitemap omissions, and Turkish metadata requiring
  fluent human review. Resolving those public-site findings requires a
  separately authorized deployment/reconciliation pass; this checklist grants
  no deployment authority.
- The historical source-bound pre-launch audit remains `HOLD` with its recorded
  two critical and seven high findings. The current hardening audit remains
  `HOLD` with six remediations pending rehearsal/review, one owner-accepted
  critical sole-Trezor concentration risk, two high launch blockers, and four
  tracked medium/low limitations.
- Ceremony entry now fails closed on
  `PRELAUNCH_SECURITY_AUDIT_CLEARANCE` and
  `REMEDIATION_SECURITY_AUDIT_CLEARANCE`. The hardening gate permits exactly
  the named owner-accepted sole-Trezor critical risk, but no unaccepted
  critical/high finding or open blocker. A current-source reproducible SBF,
  signed Devnet rehearsal, production identity integration rehearsal, and
  independent final-code audit are mandatory.
- Regeneration, verifier-assignment, and Model T path-review summary booleans
  no longer clear ceremony entry by themselves. The V2-only ceremony review
  and V2 stage journal must both pass their validators in the same assessment;
  they must be `READY` and `ARMED`, respectively. The evidence-only verifier
  must record artifact and stage-plan review without signing authority, and the
  signer must retain the physically reviewed sole-Trezor public address.
- Finalized mainnet balance at `2026-08-01T11:04:01Z`, RPC context slot
  `436549381`: `2.53365957 SOL`.
- Measured rent-exempt minima: `8.31841104 SOL` before transaction fees:
  - ProgramData: `4.15866264 SOL`;
  - temporary deployment buffer: `4.15860696 SOL`;
  - program account: `0.00114144 SOL`.
- Current pre-fee shortfall: `5.78475147 SOL`.
- Additional balance required to reach the `8.5 SOL` ceremony floor:
  `5.96634043 SOL`.
- Local maturity, cliff, and linear-unlock proof is no longer a blocker. Its
  host-only limitation must remain visible in every release packet.
- The prior public ceremony time has passed. A replacement UTC time is not yet
  published.
- `internalagency.io` DNS is no longer a blocker: both required A records,
  `162.159.143.30` and `172.66.3.26`, resolved at this update.
- Do not move the release packet, manifest, signing checklist, or publication
  payload out of `HOLD` until every remaining gate is complete and revalidated.
