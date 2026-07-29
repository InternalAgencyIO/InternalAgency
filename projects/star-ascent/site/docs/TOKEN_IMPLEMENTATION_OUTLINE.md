# $IAT Genesis Token Implementation

Status: implemented locally and evidence-locked. No mint, authority change, token account, lock vault, or distribution has been created by this repository.

## Fixed architecture

| Layer | Genesis decision |
| --- | --- |
| Token standard | Original SPL Token Program |
| Decimals | 9 |
| Supply | 1,000,000,000 IAT / 1,000,000,000,000,000,000 base units |
| Metadata | Canonical Metaplex metadata PDA; `Internal Agency Token` / `IAT`; zero seller fee; immutable at Genesis |
| Allocations | 50% community, 20% treasury, 15% ecosystem, 10% core team, 5% liquidity |
| Locks | External, independently reviewed program-derived vault owners are mandatory for treasury, ecosystem, core team, and liquidity |
| Authorities | Model T is temporary mint/freeze authority; both are permanently revoked |
| Operator surface | Localhost-only; public deployments are read-only |

## Exact transaction sequence

1. Atomically create the mint, initialize it with 9 decimals, and create immutable metadata.
2. Atomically create five canonical associated token accounts and mint all five exact allocations.
3. Revoke mint authority.
4. Revoke freeze authority.

Devnet uses the same four transactions and 50/20/15/10/5 ratio with 1,000 test IAT. Each transaction receives a separate Model T physical confirmation.

## Enforced lock prerequisite

`launch/allocation-lock-plan.template.json` is the only allocation-owner source for the generated ceremony configuration. `READY` requires five distinct owners; locked allocations must use off-curve program-derived vault authorities, a reviewed external program ID, direct Explorer evidence for the vault and program, separate public schedule evidence, and an independent plan digest. A team wallet or ordinary multisig must not be labelled time-locked.

## Metadata prerequisite

`launch/token-metadata.template.json` binds the public JSON at `public/metadata/iat.json` by SHA-256. Its `READY` state requires independent review. Transaction 1 uses the same fixed values and creates an immutable on-chain record.

## Build-time interlock

`scripts/generate-mint-ceremony-config.mjs` validates all canonical artifacts, recomputes their digests, and emits `app/mint/ceremony-config.generated.json`. Mainnet becomes `READY` only when metadata, lock plan, signer checklist, exact devnet rehearsal, approved handoff, and release packet all pass and bind the current files. Any drift regenerates a `LOCKED` configuration.

## Hard stops

- No unverified wallet interface, public-host signing, or unclear device prompt.
- No seed phrase, private key, PIN, passphrase, recovery material, or wallet export in any artifact.
- No mainnet action before the exact devnet and independent-review chain passes.
- No claim, distribution, or publication before direct on-chain evidence exists.
