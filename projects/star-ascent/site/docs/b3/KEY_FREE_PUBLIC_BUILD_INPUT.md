# IAT B3 key-free public build input

Status: **HOLD — nonauthorizing build-only contract**.

This contract supplies deterministic public values to a key-free, offline Law/Economy compile.
It creates no keypair, private key, signer, payer, balance, funding, RPC receipt, transaction,
deployment identity, or network observation. Its output is deliberately nondeployable and cannot
satisfy the production R01 identity manifest, a signer-bearing local-validator rehearsal, public
Devnet evidence, production-final-byte evidence, release authorization, or Mainnet.

## Inputs

Two distinct external file claims are accepted under the only permitted case-sensitive paths:
`inputs/build-only-identity.json` and `inputs/declared-genesis.json`. Each in-memory text claim must
be canonical sorted JSON followed by exactly one LF and accompanied by a matching caller-supplied
SHA-256 and UTF-8 byte length. This module does not open a file or prove regular-file, one-link,
run-root, inode, or descriptor identity; B27 must observe those facts directly in the same process.

The identity file has exactly these keys:

```text
schema generatedAtUtc laneId lawProgramId economyProgramId canonicalMint
```

The declared-Genesis file has exactly these keys:

```text
schema generatedAtUtc laneId network rpcUrl genesisHash
```

The compatibility schema name contains `observation`, but this record is classified only as
`DECLARED_COMPILE_DOMAIN_ONLY_NOT_NETWORK_OBSERVATION`. The fixed Devnet URL and Genesis hash are
compile-domain data. Their presence proves neither endpoint access nor current cluster truth and
grants no network authority.

The checked-in template is documentation only. Its null values make it invalid as executable input.

## Deterministic public values

The consumer supplies a checkpoint claim with exact committed head, committed tree, frozen B26
runner SHA-256, and lane ID. K44 checks the claim structurally but does not observe Git. For each of
`LAW`, `ECONOMY`, and `MINT`, the validator hashes this domain-separated UTF-8 preimage:

```text
IAT-B3-KEY-FREE-PUBLIC-ID/V1 NUL domain NUL head NUL tree NUL runner-sha256 NUL lane-id
```

The 32 SHA-256 bytes are encoded as canonical Base58. The three results must be pairwise distinct,
must exactly recompute from the external checkpoint, and must not match reserved programs, retained
V2/test fixtures, supplied production identities, or any previously observed lane identity.

This derivation creates public bytes only. There is no corresponding known private key, so the
values cannot sign, deploy, upgrade, mint, pay, or authorize anything.

## Fail-closed rules

- Exact schemas, key sets, and the two fixed file paths are mandatory; duplicate members, accessors,
  proxies, extra keys, noncanonical Base58/JSON, any alternate path, or binding-claim drift fail.
- Identity and Genesis timestamps and lane IDs must match. Inputs older than 15 minutes or dated in
  the future fail. Any checkpoint, runner, lane, or derived-ID drift fails.
- The checkpoint, wall clock, production-identity inventory, prior-lane inventory, file texts, and
  file bindings are caller claims. The module directly observes none of them. Five explicit observer
  blockers remain open even when `structuralContractValid` and `structuralPayloadsValidated` are
  true. `authorizingBuildInputValidated`, `consumerPromotionPermitted`, and `capabilityIssued` stay
  false. B27 must independently cross-match every claim through same-process source/filesystem/clock
  observers; it may never promote serialized K44 output by itself.
- Every keypair, private key, signer, signature, payer, balance, funding, endpoint-use, network, RPC,
  declared-Genesis observation, deployment, production-identity, execution, signer-bearing rehearsal,
  public-Devnet, release, and Mainnet truth remains false/HOLD. Serialized structural output is never
  an execution capability or receipt.

No key-generation permission is required for this key-free contract. Any later disposable keypair
generation, local signing, local-validator RPC mutation, network/download, system provisioning,
funding, public Devnet, or Mainnet action requires its own explicit authority boundary.
