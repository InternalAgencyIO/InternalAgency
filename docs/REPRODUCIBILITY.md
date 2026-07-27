# Reproducibility and public-record standard

## The minimum record

For every public release, the repository must contain:

1. A plain-language README explaining what the release is and is not.
2. Exact local prerequisites and one command sequence to validate the source.
3. A dependency lockfile or equivalent pinned environment record.
4. A changelog entry naming the user-visible change.
5. A license statement and attribution record for every included asset.
6. Evidence links for any claim about production, a public deployment, or an
   on-chain state.

## STAR ASCENT repository rules

- The public website repository builds the site from source and documents its
  deployment path. It must not contain secrets.
- The contracts repository contains only reviewed source and test fixtures.
  A contract is never described as deployed without a public address and
  verification record.
- The audits repository distinguishes a threat model, a self-review, and an
  independent audit. These are not interchangeable.
- The archive repository preserves released documents, approved media, and
  public evidence. Corrections are additive and timestamped.

## CC0 boundary

STAR ASCENT public narrative documents, published reference data, public
checklists, and non-code archive metadata should use CC0 1.0 where feasible.
Software and third-party assets keep their stated licenses. This rule does not
override a contributor's copyright or a third-party license.

## Before merging to `main`

- Confirm that the change is reproducible from the README.
- Confirm that no token, credential, personal data, seed phrase, or signing
  material is included.
- Confirm that public claims have evidence, or say `HOLD`.
- Add a concrete commit message and changelog note when the public output changes.
