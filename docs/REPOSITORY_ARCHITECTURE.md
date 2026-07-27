# Internal Agency repository architecture

## Current public repository

`InternalAgencyIO/InternalAgency` remains the home of **Radiance**. Its source,
motion assets, build tooling, and release history remain in place. STAR ASCENT
must not be merged into the Radiance application tree.

## STAR ASCENT public repository network

The launch work is separated by trust boundary rather than by convenience.
Each repository has one public purpose and an independently readable history.

| Repository | Visibility | Purpose | Never contains |
| --- | --- | --- | --- |
| `InternalAgencyIO/star-ascent-site` | Public | The bilingual public site: source, Dossier routes, public artwork, build and deployment notes. | Wallet secrets, API keys, private identities, signing material. |
| `InternalAgencyIO/star-ascent-contracts` | Public | On-chain program specifications, program source only if independently reviewed, test fixtures, deployment manifests, and reproducible build instructions. | Seed phrases, private keys, pre-signed transactions, unreleased signing data. |
| `InternalAgencyIO/star-ascent-audits` | Public | Security review scope, threat model, reproducible checks, audit reports, remediation ledger, and evidence references. | Fabricated audits or claims that a review happened when it did not. |
| `InternalAgencyIO/star-ascent-archive` | Public | White Dossier editions, public launch records, media kit, approved artwork, transcript-ready evidence, and change log. | Personal information, credentials, or mutable claims presented as immutable evidence. |

## Publishing rule

`main` is the visible record in every STAR ASCENT repository. Every material
public-site change is committed to `star-ascent-site/main`; the deployment
mirror remains an operational delivery channel, not the sole archive.

No repository should claim that a token is live, a lock exists, an authority
was revoked, or an audit passed until the associated public evidence is linked.

## Migration order

1. Create the four repositories above under `InternalAgencyIO` with public visibility.
2. Seed `star-ascent-site` from the current production site source.
3. Seed `star-ascent-archive` with the existing public Dossier source records;
   preserve legacy URLs but use designed pages as the canonical reading surface.
4. Seed `star-ascent-contracts` with only the approved technical outline and
   test plan. Do not add a deployable program before a reviewed implementation exists.
5. Seed `star-ascent-audits` with the threat model and a clear `NOT AUDITED`
   status until independent work is complete.
6. Add cross-repository links to the site footer and each repository README.

## Naming and branch policy

- Default branch: `main`
- Release tags: `site-vYYYY.MM.DD.N`, `archive-vYYYY.MM.DD.N`, or semantic
  versioning for independently audited contract releases.
- Branches: `codex/<scope>` for short-lived changes.
- Public commits use concrete, reviewable messages. Generated output and
  secrets never enter Git history.
