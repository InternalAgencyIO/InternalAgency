# IAT V2 architecture ownership ledger — 2026-08-05

**ACTIVE SAFE-WORK MILESTONE / 5 OF 8 COMPLETE / MAINNET UNSCHEDULED_HOLD / NO LAUNCH AUTHORITY**

This package is the authoritative source-controlled task ledger for the safe engineering work taken over on Draft PR #4. It separates work that can be completed autonomously in the repository from launch blockers that require funding, credentials, hardware, independent reviewers, or an attended ceremony.

## Half-task milestone

Five of eight safe engineering tasks are complete:

1. hydration text-node provenance and monotonic readiness;
2. deterministic standard, diagnostic, and exhaustive test profiles;
3. bounded sequential cross-engine execution with fail-fast and progress reporting;
4. collision-aware coverage diagnostics and regression tests; and
5. the complete 3,500-page dual-host browser proof.

Three safe tasks remain open: reduce and independently review the admin feature/Trezor surfaces, test supported dependency upgrades and advisory preconditions, and validate the current-source Rust accounting/invariant path without disturbing the preserved user worktree.

The exact task states and evidence are in [`work-ledger.json`](./work-ledger.json). The browser result is in [`hydration-proof.json`](./hydration-proof.json). Run `npm run check:iat-v2-architecture-work` from `projects/star-ascent/site` to verify source ancestry, hashes, task arithmetic, proof topology, HOLD boundaries, and non-authorization assurances.

## Launch boundary

Completing five safe tasks does not schedule or authorize Mainnet. Independent SBF reproduction, the 8.5 SOL funding floor, a fresh signed Devnet rehearsal, independent review, real X OAuth and D1 bindings, sole-Trezor risk acceptance, a replacement UTC window, an attended ceremony, and post-ceremony reconciliation all remain HOLD.

No wallet, hardware signer, credential, funding, signing, broadcast, deployment, Devnet, or Mainnet state was changed by this milestone.
