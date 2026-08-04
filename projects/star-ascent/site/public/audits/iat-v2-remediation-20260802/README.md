# IAT V2 pre-launch hardening audit

> **DRAFT - MAINNET HOLD - INTERNAL REVIEW - NOT DEPLOYED - NO CLAIM ROUTE - NO LAUNCH AUTHORITY**

## Decision

**HOLD. Do not deploy, fund through this package, sign, simulate for signing, or broadcast the IAT V2 Mainnet program.**

This package reviews source commit
`b73d2d3ce8572e833b9fdd37df23cd97b40df111`. It records concrete
remediation across Genesis identity, exact reward liability, public RPC,
desktop isolation, dependency graphs, and Genesis exclusion of the future CCC
DLC. A pinned verifiable build produced a 579,480-byte SBF with SHA-256
`d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4`.
The hardened source and that binary have not yet received a signed Devnet
rehearsal or independent final-code review.

## Implemented controls

- Genesis node activation uses a short-lived signed HttpOnly session bound to
  the verified wallet, node, nonce, and expiry. A returned UUID is not bearer
  authority.
- X activation binds the immutable X user ID and accepts only Premium or
  PremiumPlus accounts at least 40 days old. Missing or malformed evidence
  fails closed.
- Wallet and immutable X ID are unique. The atomic reservation model permits
  exactly 1,000 Genesis slots and no slot 1,001.
- Daily rewards admit at most 1,000 qualifying wallet/X/Premium pairs per UTC
  epoch, 12 IAT each: exactly 12,000 IAT per epoch and 4,380,000 IAT over 365
  epochs. No refill or recycling expands those ceilings.
- Every CCC entry path is compiled fail-closed for Genesis and there is no
  activation instruction. CCC remains a separately reviewed future DLC.
- The public RPC proxy is read-only, bounded, timed out, rate limited, and
  sanitizes provider details. The desktop renderer is sandboxed with exact
  navigation, permission, capture, and IPC boundaries.
- Root production/full and site production dependency audits report zero known
  vulnerabilities under the pinned Node runtime.

## Single-Trezor authority exception

At the owner's explicit direction, all chain authorities remain on the sole
Trezor Model T. No multisig, second authority, hot signer, server signer, or
alternate authority address was added. This satisfies the requested custody
topology, but it does **not** provide role separation. Device, recovery, and
operator correlation remains an open owner-accepted critical risk documented
in [OWNER-RISK-ACCEPTANCE.md](OWNER-RISK-ACCEPTANCE.md).

## Evidence boundary

The current deterministic time proof is byte-bound to the reviewed source and
current SBF, and uses no signer, wallet, validator transaction, or broadcast.
The prior SBF, 29 finalized Devnet signatures, and FDF Guard comparison bind
prior source and remain historical evidence only. They are not relabeled as
signed transaction proof of this commit.

## Required next gates

1. Independently reproduce and compare the published current-source SBF hash.
2. Run the complete signed Devnet rehearsal against that exact binary.
3. Obtain independent source, binary, account, receipt, and game-theory review.
4. Rehearse X OAuth and D1 failure/concurrency behavior in a non-production
   environment without retaining secrets or private identity data.
5. Only after those gates, funding, a new UTC window, regenerated artifacts,
   final preflight, attended Model T review, and explicit broadcast approval
   may be considered.

## Package map

- [scope.json](scope.json) - immutable source/tree and evidence boundaries.
- [findings.json](findings.json) - open, accepted, tracked, and remediated items.
- [attack-matrix.json](attack-matrix.json) - adversarial identity, cap, budget,
  custody, RPC, desktop, supply-chain, and evidence cases.
- [GAME-THEORY.md](GAME-THEORY.md) - Sybil-cost, incentives, caps, and future-DLC analysis.
- [OWNER-RISK-ACCEPTANCE.md](OWNER-RISK-ACCEPTANCE.md) - sole-Trezor exception.
- [checks.json](checks.json) - executed validations and honest limitations.
- [manifest.json](manifest.json) - package decision and artifact digests.

## Limitations

This is an internal Codex-assisted source review, not an independent audit,
formal proof, custody guarantee, production penetration test, or legal opinion.
No wallet, secret, key, hardware device, production account, funds, DNS,
signing, simulation for signing, broadcast, deployment, Devnet mutation, or
Mainnet mutation was accessed or performed.
