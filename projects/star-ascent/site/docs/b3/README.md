# IAT B3 architecture workspace

Status: B3 is the primary forward architecture. Implementation and evidence are
in progress. Mainnet remains HOLD; no deployment, signing, funding, network
mutation, site publication, or authority revocation is implied.

B3 evolves the complete IAT V2 system. Unless the project owner records an
explicit cut, every V2 behavior, safety property, inactive future feature,
public surface, and evidence gate remains in scope.

This directory contains the first source-controlled B3 design set:

- [Architecture baseline](ARCHITECTURE_BASELINE.md)
- [Repository and live-estate baseline](ESTATE_BASELINE.md)
- [V2 feature-parity contract](V2_FEATURE_PARITY.md)
- [V2 source inheritance and port inventory](V2_SOURCE_INVENTORY.md)
- [Deployment-cost feasibility](COST_FEASIBILITY.md)
- [Operator factions](FACTIONS.md)
- [Core-team concentration cap](CORE_TEAM_CAP.md)
- [Rust write-gate audit](RUST_WRITE_GATE_AUDIT.md)
- [Native confidential IAT transfers](SHIELDED_TRANSFERS.md)
- [Native Daily Law adapter](LAW_ADAPTER.md)
- [Gated path to Mainnet](MAINNET_PATH.md)
- [White paper draft](WHITEPAPER_DRAFT.md)

The framework-neutral Rust daily-law kernel is
[`programs/iat_b3_consensus`](../../programs/iat_b3_consensus). Its fixed
vectors match the independent JavaScript specification in
[`programs/iat_b3_reference/daily-lockdown-consensus.mjs`](../../programs/iat_b3_reference/daily-lockdown-consensus.mjs),
with boundary and block-validity tests in
[`tests/iat-b3-daily-lockdown-consensus.test.mjs`](../../tests/iat-b3-daily-lockdown-consensus.test.mjs).
The same Rust crate also contains the selected Solana-profile domain separation,
persistent daily-decision validation, and fail-closed IAT transfer disposition.
The first native adapter in [`programs/iat_b3_law`](../../programs/iat_b3_law)
now implements the standard hook dispatcher, mint-bound law-state PDA,
permissionless SlotHashes finalizer, and same-day no-reroll guard. It remains a
Devnet-held prototype with optimized SBF and disposable local-validator
evidence.

The disposable integration harness and its exact coverage boundary are defined
in [`LOCAL_VALIDATOR_REHEARSAL.md`](LOCAL_VALIDATOR_REHEARSAL.md).

The documents deliberately separate two deployment profiles:

1. **V2/Solana** is the existing program, website, launch-control, and evidence
   system. It is the migration source and behavioral reference.
2. **B3/Solana** is the primary forward architecture: one canonical Token-2022
   IAT mint with an immutable Daily Law hook on every public and confidential
   ownership transfer. Privacy is an optional confidential-balance mode on the
   same mint; only opt-in users pay ZK-proof and confidential-account costs.
   Chainwide Solana scope, first-block decision, threshold-VRF randomness, and
   an independent clock are explicitly relaxed to avoid a sovereign validator
   network. The exact boundary is recorded in
   [Native confidential IAT transfers](SHIELDED_TRANSFERS.md).

The former sovereign profile remains the only route to making the Daily Law a
chainwide consensus rule for all Solana-independent transactions. It is not the
selected build because its validator and operations investment conflicts with
the current cost constraint. This does not narrow the selected law: it remains
IAT-wide for the canonical B3 mint.

No B3 implementation may replace a V2 guarantee with a weaker approximation
to meet a size, cost, schedule, or marketing target.
