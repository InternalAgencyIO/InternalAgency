# IAT V2 threat model

> **DRAFT — MAINNET HOLD — SOURCE REVIEW ONLY — NO DEPLOYMENT OR TRANSACTION AUTHORITY**

## Assets and invariants

- Fixed 1,000,000,000 IAT supply with 9 decimals.
- Mint and freeze authorities revoked before activation.
- Exact 500M/200M/150M/100M/50M allocation split.
- Program vault principal, staked principal, and fully collateralized reward
  reservations.
- Program source/SBF identity, program ID, ProgramData authority, and Genesis
  timestamp.
- Wallet/X/Premium binding ledger and first-1,000 ordering.
- Daily epoch roots, proofs, totals, distributor cap, and claim idempotency.
- CCC candidate snapshot, randomness commitment, one final outcome, weekly
  position bitmap, and eventual closeability.
- Hardware keys, OAuth secrets/tokens, RPC credentials, D1 data, build runners,
  public evidence, and operator decision records.

## Actors

- Honest participant with one or more qualifying wallet/X/Premium pairs.
- External griefer seeking denial without direct profit.
- Reward farmer maximizing claims across permitted pairs.
- Compromised or malicious website client.
- Leaked pending-node UUID holder.
- Compromised X account, X API, OAuth app, or account seller.
- Malicious/failed Switchboard committer, oracle, RPC, or validator path.
- Compromised administrator, upgrade authority, community custodian, release
  operator, dependency, or CI runner.
- Honest but mistaken operator under time pressure.
- Independent verifier/auditor.

## Trust boundaries

### Browser to binding worker

Untrusted inputs: origin headers, wallet strings, signatures, node UUIDs,
country codes, OAuth state/codes, and request timing. Browser origin is not
authentication. Security requires a verified wallet challenge plus a
server-held, scoped transition state.

### Worker to X

X authenticates control of an X account and returns an immutable user ID and,
when requested, subscription metadata. X does not prove one human. Tokens are
secrets; public artifacts may contain only non-sensitive derived status.

### Worker to D1

D1 uniqueness is the authoritative web identity/cap boundary. Multi-step
activation and slot allocation must be one atomic transaction. Schema docs do
not enforce anything unless represented in applied migrations and live queries.

### Off-chain eligibility to Solana administrator

The on-chain program cannot verify X Premium itself. The administrative signer
is an oracle for eligibility and agency registration. Incorrect attestations
become durable on-chain state. This role must be separated, logged, reviewed,
and ideally constrained by verifiable attestations/batches.

### Solana program to SPL Token

The program pins the Original Token Program, exact mint, PDA vault authority,
vault token accounts, and destination owners. Transaction failure is atomic.
No arbitrary untrusted CPI is present in the reviewed source.

### Solana program to Switchboard

The adapter pins the official cluster program, account discriminator/layout,
immediately preceding commit instruction, prior-slot seed, same account, and
current-slot reveal. These protect integrity/freshness, not availability. The
application must recover when the selected committer never reveals.

### Upgrade authority to all PDA vaults

Upgradeable code is a superuser boundary. A replacement program can change the
rules by which PDA authority signs token transfers. Hardware custody alone does
not make that authority decentralized or independent.

### Source/locks to CI and release artifact

Package registries, install scripts, GitHub Actions, Rust crates, npm locks,
Solana/Anchor installers, Electron builder, and generated SBF/portable binaries
are supply-chain inputs. A source audit is not a binary audit unless hashes and
reproducible-build evidence join them.

## Abuse cases

| ID | Abuse case | Required invariant |
| --- | --- | --- |
| TM-01 | First CCC committer never reveals | Bounded eventual settlement without reroll |
| TM-02 | Upgrade key is stolen/coerced | No one key can replace code and drain/certify/custody |
| TM-03 | Pending node UUID leaks | UUID alone cannot mutate or bind identity |
| TM-04 | Non-Premium X account authenticates | Activation fails closed |
| TM-05 | Two requests race for slot 1000 | Exactly one gets slot 1000; no slot 1001 |
| TM-06 | Same X or wallet is replayed | Global unique constraint and atomic HOLD |
| TM-07 | Operator pads CCC registry | Only consented, eligible active candidates enter snapshot |
| TM-08 | Daily demand exceeds wallet/budget | Deterministic public cap; no discretionary overspend |
| TM-09 | RPC endpoint is request-flooded | Bounded upstream cost and graceful degradation |
| TM-10 | Build dependency is compromised | Pinned, audited, reproducible, least-privilege build |
| TM-11 | Partial ceremony stalls after clock start | Contract/public Genesis remain consistent or deployment is abandoned safely |
| TM-12 | Token transfer/CPI fails mid-settlement | Full transaction rollback and unchanged bitmap/reservations |

## Security properties that currently hold in source

- Checked fixed-supply and lane arithmetic.
- Full reward reservation before accepting a position.
- PDA/account/mint/owner constraints for vault transfers.
- Permissionless settlement cannot redirect payouts.
- Wallet challenge includes domain, origin, wallet, nonce, issue, and expiry.
- Challenge consumption is atomic and signatures are exact Ed25519 inputs.
- X OAuth state is HMAC authenticated, expiring, and PKCE-bound.
- Immutable X ID and wallet have unique D1 indexes.
- CCC sampling consumes 256 bits with domain-separated rejection sampling.
- Current release records fail closed on funding/schedule/hardware blockers.

## Properties that do not currently hold

- Forced or recoverable CCC reveal.
- Multi-party separation of upgrade/admin/community custody.
- Joint wallet/X authorization after wallet verification.
- Premium enforcement.
- Atomic exact-1,000 production activation.
- Economically qualified CCC candidate set.
- Explicit aggregate daily budget.
- Clean high/critical release dependency graph.
- Independent final-code audit.

## Incident containment assumptions

There is no deployed mainnet program in this review and mainnet is `HOLD`.
Pre-launch containment is therefore to not deploy or fund. Once mint authority
is revoked and program vaults are funded, rollback is not equivalent to a web
rollback. Before launch the team needs public procedures for:

- upgrade/admin/custody compromise;
- oracle non-reveal and prolonged outage;
- partial ceremony failure;
- identity database corruption/restore;
- bad epoch root or distributor compromise;
- dependency/build compromise;
- migration to a replacement program without misleading holders.

No automated agent may sign, broadcast, transfer, deploy, or change mainnet
state under this threat model.
