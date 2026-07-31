# Content-addressed review manifest

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

The proposal publishes a deterministic inventory of its review surface in
`review-manifest.v1.json`. It is a review aid, not a release, deployment,
approval, audit certificate, transaction, claim route, or authority record.

## Coverage

The generator recursively inventories every regular UTF-8 file under this
proposal directory and classifies it as an artifact, generator, validator,
test, or supporting source. Symbolic links, unknown file types, absolute paths,
path traversal, duplicate paths, and unclassified files fail closed.

Only `review-manifest.v1.json` is excluded from its own tree. A file cannot
truthfully embed its own content digest without asserting an unexplained
recursive fixed point, so that exclusion is explicit in `selfReference` rather
than hidden. The Git commit identifies the manifest file itself; consumers may
also hash the downloaded manifest independently.

## Hash contract

All proposal files are UTF-8 text. CRLF and lone CR are normalized to LF before
content hashing so the same Git content reproduces across operating systems.
Paths use forward slashes and are ordered by unsigned UTF-8 bytes.

Each leaf commits to:

```text
SHA256(
  UTF8("iat-promotions-dlc-review-leaf-v1") || 0x00 ||
  UTF8(path) || 0x00 ||
  ASCII(normalizedByteLength) || 0x00 ||
  rawContentSha256
)
```

Adjacent leaf or node digests are joined using:

```text
SHA256(
  UTF8("iat-promotions-dlc-review-node-v1") || 0x00 ||
  rawLeftSha256 || rawRightSha256
)
```

An unpaired final node is duplicated at each level. The final digest is
`treeRootSha256`. Every intermediate level is published in `merkleVectors`, so
reviewers can compare more than the final digest and locate the first divergent
level without receiving any private evidence.

## Independent runtime verification

`verify-review-manifest.py` independently implements path discovery, role
classification, UTF-8 normalization, SHA-256 content addressing, leaf
construction, every intermediate Merkle level, the final root, summaries, and
all HOLD metadata using only the Python standard library. It does not import or
execute the JavaScript implementation.

The Python verifier is itself classified as a validator and included in the
review tree. Cross-runtime tests require the Python and Node implementations to
produce the same complete manifest, not merely the same root.

## Reproduce locally

From the repository root:

```sh
node proposals/iat-promotions-dlc/generate-review-manifest.mjs --write
node proposals/iat-promotions-dlc/validate-review-manifest.mjs
python proposals/iat-promotions-dlc/verify-review-manifest.py
node --test proposals/iat-promotions-dlc/tests/review-manifest.test.mjs
node --test proposals/iat-promotions-dlc/tests/review-manifest-python.test.mjs
```

The validator also regenerates the entire inventory from the local proposal
tree. Any content, path, ordering, role, byte-length, hash-contract, status, or
coverage drift fails validation.

The manifest contains paths, public roles, normalized sizes, and hashes only.
It contains no event bodies, account snapshots, wallet material, X identities,
handles, OAuth data, signatures, secrets, or signing capability.
