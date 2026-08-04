# IAT V2 pre-launch security audit package

> **DRAFT SECURITY REVIEW — MAINNET HOLD — NOT AN EXTERNAL AUDIT — NOT DEPLOYED — NO CLAIM ROUTE — NO LAUNCH AUTHORITY**

This package records a source-bound, repository-wide pre-launch review of IAT
V2 at commit `c23d42d108a33ee105bcbfd32a7acb9f6a66fe96`. It inventories every
tracked file and applies the deepest manual review to executable and
security-critical surfaces: the Solana program, reward and identity services,
database migrations, client instruction builders, release controls, CI,
dependency locks, and the Electron companion application.

## Decision

**HOLD. Do not deploy or fund the IAT V2 mainnet program.**

The review found two open critical blockers and seven open high-severity
findings. The most serious are:

1. A permissionless first committer can create the unique CCC round PDA and
   then withhold the Switchboard reveal. There is no timeout, cancellation, or
   replacement path. The affected CCC week can never settle, linked positions
   can never complete all 52 settlements, and reward reservations remain
   locked.
2. One address is planned as program upgrade authority, on-chain administrator,
   and 500M-IAT community custodian. Compromise or coercion of that one key can
   combine code replacement, administrative certification, and direct
   community custody loss.
3. Pending web bindings use a node UUID as an unscoped bearer capability.
   Country selection and X OAuth authorization do not require a fresh wallet
   proof or server session, and the UUID is placed in a URL.
4. The owner-approved identity unit is a unique wallet plus a unique immutable
   X user ID with X Premium for every pair; multiple pairs controlled by one
   person are allowed. The current callback enforces the two unique identifiers
   but does not request, store, or enforce X `subscription_type`.
5. The live D1 schema and routes do not implement the documented atomic
   first-1,000 Genesis slot reservation.

The full register is in [FINDINGS.md](FINDINGS.md) and
[findings.json](findings.json). The accepted multi-account model and its
economic consequences are in [SYBIL-AND-GAME-THEORY.md](SYBIL-AND-GAME-THEORY.md).

## Identity model used by this audit

This audit does **not** impose one-human-one-account. A participant is one pair
of:

- a uniquely bound Solana wallet whose control is proven by a fresh signature;
- a uniquely bound immutable X user ID whose control is proven through OAuth;
- an eligible X Premium subscription proven for that authenticated user.

One person may operate multiple qualifying pairs. The remaining abuse question
is therefore whether every pair independently satisfies all three controls,
not whether the operator is a unique human. X handles are display metadata and
must never be used as the deduplication key.

## What passed

- 19 locked Rust unit/time-boundary tests passed.
- 41 IAT V2 JavaScript tests passed, including reservation, PDA, instruction,
  clock, CCC sampling, and Trezor adapter checks.
- Eight root Electron tests passed.
- `check:iat-v2` and `check:iat-v2-signoff` passed while preserving mainnet
  `HOLD`; the initialization sign-off remains `PENDING` and the feature sign-off
  passes.
- CodeQL checks on draft PR #4 passed for actions, JavaScript/TypeScript, and
  Python at the audited head.
- `cargo audit` found zero known Rust vulnerabilities in 226 locked
  dependencies; it reported the transitive `bincode 1.3.3` crate as
  unmaintained.
- Bounded current-tree and 970-commit history secret-pattern scans found no
  credential-shaped matches after false-positive triage.
- Production-only `npm audit --omit=dev` reported zero vulnerabilities in both
  npm workspaces.

Passing checks do not neutralize the open findings.

## What did not pass

- The release/build dependency trees contain known advisories: the root tree
  reports 1 critical and 12 high findings; the site npm tree reports 7 high and
  15 moderate findings. These are outside npm's production-only set, but they
  affect release tooling, bundled framework paths, and locally executed admin
  tooling and must be triaged and upgraded before release.
- `cargo clippy -- -D warnings` is not clean. Rust tests pass, but the strict
  lint gate reports framework-generated divergence warnings plus local
  `items_after_test_module` and `too_many_arguments` warnings.
- GitHub Dependabot and code-scanning alert-list APIs returned `404` to the
  current token. Individual CodeQL check conclusions were still verified from
  the pull request.
- No independent third-party smart-contract/security report exists. This
  Codex-assisted review is not independent assurance and does not satisfy that
  policy requirement.

## Closure rule

Mainnet may not enter attended preflight until:

- every critical and high finding is fixed or explicitly accepted through a
  public, named, multi-party risk decision;
- fixes have regression tests and a new source-bound audit revision;
- the randomness recovery design is tested in SBF/local-validator and signed
  Devnet flows;
- program upgrade, administration, and custody roles are separated with
  multi-party controls;
- an independent audit reviews the final immutable commit and deployed binary;
- dependency advisories are removed or documented as demonstrably unreachable;
- the canonical ceremony assessment reports the audit clearance check as true.

The current package deliberately reports `launchDecision: HOLD`. Editing the
wording is insufficient; the validator recomputes the finding counts, audited
Git tree, critical source hashes, and package artifact hashes.

## Package map

- [manifest.json](manifest.json) — decision, identity model, counts, and package
  digests.
- [scope.json](scope.json) — exact source commit/tree and critical-source
  SHA-256s.
- [findings.json](findings.json) — machine-readable finding register.
- [FINDINGS.md](FINDINGS.md) — human-readable impact and remediation.
- [SYBIL-AND-GAME-THEORY.md](SYBIL-AND-GAME-THEORY.md) — accepted identity
  model, incentives, caps, and attack economics.
- [THREAT-MODEL.md](THREAT-MODEL.md) — assets, actors, trust boundaries, and
  abuse cases.
- [attack-matrix.json](attack-matrix.json) — adversarial cases and present
  outcomes.
- [checks.json](checks.json) — commands, results, tool limits, and timestamps.

## Primary external references

- [Solana program deployment and upgrade authority](https://solana.com/docs/programs/deploying)
- [Switchboard Solana randomness commit/reveal tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial)
- [X Get My User fields](https://docs.x.com/x-api/users/get-my-user)
- [X user data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary)

## Limitations

This was a source and configuration review with local/static tests. It was not
a formal proof, production penetration test, mainnet simulation, key ceremony,
custody review, legal review, or independent external audit. Binary media were
inventory-bound and secret-pattern scanned, not manually decoded as executable
content. No wallet, key, secret, signing device, mainnet transaction, or funds
were accessed. An audit never guarantees safety.
