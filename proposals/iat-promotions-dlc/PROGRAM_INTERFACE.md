# Promotions DLC program interface v0

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This document explains the network-free interface in
`program-interface.v0.json`. It is a proposed binary contract for independent
review, not an Anchor IDL, deployed program, executable artifact, program ID,
wallet request, or authorization to fund or activate anything.

Security gap: v0 stores one verifier public key and exposes no reviewed rotation
or emergency-disable instruction. It must not be treated as deployment-ready.
`VERIFIER_KEY_LIFECYCLE.md` defines the reference behavior that a separately
reviewed machine-interface amendment still needs to encode.

## Encoding contract

- The first eight bytes are the first eight bytes of SHA-256 over
  `iat-promotions-dlc-v0:<kind>:<name>`.
- All integer fields are fixed-width and little-endian.
- All hashes and privacy-preserving identity commitments are exactly 32 bytes.
- Instruction data has no variable-length fields, optional fields, padding, or
  trailing bytes.
- Integer values in the JSON interface and test vectors are decimal strings so
  JavaScript cannot silently round token amounts.

`program-interface-vectors.v0.json` fixes one canonical byte vector for every
instruction. `program-interface-codec.mjs` can encode and decode those vectors
without a wallet, RPC endpoint, chain connection, or private key.

`instruction-transition-adapter.mjs` is a second network-free proof layer. It
accepts encoded bytes, decodes them through the fixed codec, binds the decoded
fields to an already-verified attestation context, and applies the matching
pure reference-engine transition. It cannot construct a transaction, call an
RPC endpoint, request a signature, or access a wallet.

## Proposed account graph

- `Campaign` contains immutable economics, identity domain, verifier key,
  activation boundary, counters, and the dedicated promotion-vault binding.
- `Nomination` records one pending or terminal proposer/hero pairing.
- `HeroReservation` serializes pending use of an immutable hero X identity so
  two proposers cannot reserve the same hero concurrently.
- `RoleMarker` independently deduplicates node, wallet, and immutable X identity
  for each reward role.
- `SettlementReceipt` records both destinations, both identity bindings, both
  exact rewards, and the canonical sequence number for public auditing.

The account sizes, seed contracts, fields, and instruction account order are
machine-readable in the interface file. They are frozen only for this v0 draft;
changing one requires new vectors and review.

## Proposed instruction lifecycle

1. `initialize_campaign` binds the fixed economics, verified Genesis source,
   authorities, verifier key, community source/refund accounts, and dedicated
   promotion vault.
2. `fund_campaign` accepts exactly 180,000 IAT from the immutable community
   source into that vault.
3. `activate_campaign` requires separate review, full funding, matching policy
   and artifact hashes, and Genesis plus eight hours.
4. `nominate_hero` verifies a fresh proposer attestation, reserves one hero X
   identity, and creates no reward or completed-pair slot.
5. `cancel_nomination` ends a pending nomination and releases its reservation
   without changing spend or completed-pair counters.
6. `settle_pair` verifies the hero binding, creates all six independent role
   markers, transfers 120 IAT and 60 IAT atomically, writes one receipt, and
   increments one pair.
7. Pair 1,000 permanently exhausts the campaign and makes every unresolved
   nomination terminal and unpaid.
8. `finalize_exhausted_surplus` can only return post-exhaustion surplus to the
   immutable community refund account.

Before activation, `cancel_campaign_pre_activation` can return funding only to
that same immutable refund account. There is deliberately no active-campaign
withdrawal instruction.

## Verification boundary

X identity is off-chain. The proposed program therefore consumes a canonical,
short-lived verifier attestation through an Ed25519 verification preinstruction
and the Solana Instructions sysvar. The program must compare the exact signed
bytes, approved public key, campaign binding, wallet binding, immutable X user
ID commitment, nonce, and validity window. A mutable display handle is never an
on-chain uniqueness key.

The verifier is trusted only to attest the identity facts it observed. It
cannot mint, move campaign funds by itself, redirect either reward, alter the
cap, reopen exhaustion, or write any IAT V2 account.

The transition adapter rejects a verifier result unless its approved public
key, exact-message flag, purpose, campaign, attestation ID, nonce hash,
timestamps, node commitment, and X identity commitment match the decoded
instruction and current campaign. This models the input boundary; it does not
pretend to implement or replace Ed25519 signature verification.

## Race and rollback rules

The campaign, nomination, reservation, six role markers, two token
destinations, and settlement receipt are declared in the settlement account
set. Solana account locking is expected to serialize competing settlements for
the final slot and competing use of any marker. A cancellation and settlement
for the same nomination contend on the writable nomination and reservation;
exactly one can establish the terminal state.

All checks and both token transfers belong to one transaction. Any failed
guard, account creation, or transfer rolls back the full settlement. There is
no valid state in which only the hero or only the proposer was paid.

## Isolation and non-capabilities

The dedicated promotion vault is the only proposed reward source. The
interface exposes no treasury, ecosystem, liquidity, core-team, staking,
mint-authority, IAT V2 APY, CCC-selection, or V2 upgrade capability. Those
accounts are neither funding fallbacks nor writable dependencies.

This draft contains no secret, signer, private key, deployed address, live RPC
route, or chain-specific transaction. Any implementation would require a new
security review, deterministic build, public artifact hash, Devnet rehearsal,
and separate mainnet decision.
