# Internal Agency / STAR ASCENT

This is the live public-build repository for the STAR ASCENT Genesis surface.

The work is intentionally visible: source, public documents, visual iterations, and production decisions are committed as the project advances. The repository is a record of what is present—not a substitute for independent verification.

## Live surfaces and localization status

- Indexable canonical English and international surface: `internalagency.io`
- Turkish-intent host: `ileriakil.com` — Turkish is on localization review `HOLD`; the host currently serves canonical English fallback with `noindex` and must not be described as an approved Turkish-language surface.
- All other non-English locale-intent routes are also `HOLD` until exact overrides have accountable, source-bound review evidence.
- Canonical public document index: `/dossier`

## Repository map

| Location | Purpose |
| --- | --- |
| `app/` | Public web experience, including the Genesis Activation Terminal. |
| `public/images/` | Versioned campaign and lore artwork used by the live site. |
| `public/evidence/iat-v2/` | CC0 devnet evidence exports, SHA-256 index, and read-only chain-status receipt. |
| `archive/public-disclosures/source/` | Canonical disclosure sources retained behind designed Dossier redirects. |
| `docs/` | Plain-language build, release, and operating notes. |
| `archive/` | Index of preserved iteration and release evidence. |
| `CHANGELOG.md` | Human-readable public build log. |

## Genesis boundary

Before public verification materials are published, this project does not request a seed phrase, private key, password, payment, token approval, transfer, or wallet transaction.

The on-site Activation Terminal is intentionally a preparation interface. It does not connect wallets or initiate claims. Any future launch route must be independently checkable against the published mint, authority-revocation evidence, allocation wallets, time-locks, and official channels.

## Public devnet evidence

Every non-secret IAT devnet evidence export held by the launch team as of
2026-07-30 is published under CC0 in
[`public/evidence/iat-v2`](public/evidence/iat-v2). The directory includes the
exact operator-export bytes, a SHA-256 ledger, and a read-only devnet status
receipt for every recorded transaction signature.

The latest feature snapshot is explicitly partial. It does not mark player
staking, APY settlement, live randomness, CCC selection, time-gated behavior,
or independent review complete. Mainnet remains **HOLD**.

## Local development

```bash
pnpm install
pnpm exec vinext dev
pnpm exec vinext build
```

Node.js 22 or newer is required. Production deployment is handled through the connected Sites project after a successful build and a source push.

## Contribution protocol

1. Make the smallest legible change.
2. Validate with `pnpm exec vinext build`.
3. Commit a descriptive snapshot.
4. Update `CHANGELOG.md` and the relevant document index where public behavior changes.
5. Never commit secrets, wallet material, private keys, user data, or unverified chain facts.

Read [docs/GENESIS.md](docs/GENESIS.md) and [docs/REPOSITORY-PROTOCOL.md](docs/REPOSITORY-PROTOCOL.md) before publishing a Genesis-facing change.
