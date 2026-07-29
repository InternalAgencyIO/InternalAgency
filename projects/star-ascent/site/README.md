# Internal Agency / STAR ASCENT

This is the live public-build repository for the STAR ASCENT Genesis surface.

The work is intentionally visible: source, public documents, visual iterations, and production decisions are committed as the project advances. The repository is a record of what is present—not a substitute for independent verification.

## Live surfaces

- English and international: `internalagency.io`
- Turkish: `ileriakil.com`
- Canonical public document index: `/dossier`

## Repository map

| Location | Purpose |
| --- | --- |
| `app/` | Public web experience, including the Genesis Activation Terminal. |
| `public/images/` | Versioned campaign and lore artwork used by the live site. |
| `archive/public-disclosures/source/` | Canonical disclosure sources retained behind designed Dossier redirects. |
| `docs/` | Plain-language build, release, and operating notes. |
| `archive/` | Index of preserved iteration and release evidence. |
| `CHANGELOG.md` | Human-readable public build log. |

## Genesis boundary

Before public verification materials are published, this project does not request a seed phrase, private key, password, payment, token approval, transfer, or wallet transaction.

The on-site Activation Terminal is intentionally a preparation interface. It does not connect wallets or initiate claims. Any future launch route must be independently checkable against the published mint, authority-revocation evidence, allocation wallets, time-locks, and official channels.

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
