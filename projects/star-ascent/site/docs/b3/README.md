# IAT B3 architecture workspace

Status: draft architecture baseline. No deployment, signing, funding, network
mutation, site publication, or Mainnet authorization is implied.

B3 evolves the complete IAT V2 system. Unless the project owner records an
explicit cut, every V2 behavior, safety property, inactive future feature,
public surface, and evidence gate remains in scope.

This directory contains the first source-controlled B3 design set:

- [Architecture baseline](ARCHITECTURE_BASELINE.md)
- [Repository and live-estate baseline](ESTATE_BASELINE.md)
- [V2 feature-parity contract](V2_FEATURE_PARITY.md)
- [V2 source inheritance and port inventory](V2_SOURCE_INVENTORY.md)
- [Deployment-cost feasibility](COST_FEASIBILITY.md)
- [Native confidential IAT transfers](SHIELDED_TRANSFERS.md)
- [White paper draft](WHITEPAPER_DRAFT.md)

The framework-neutral Rust daily-law kernel is
[`programs/iat_b3_consensus`](../../programs/iat_b3_consensus). Its fixed
vectors match the independent JavaScript specification in
[`programs/iat_b3_reference/daily-lockdown-consensus.mjs`](../../programs/iat_b3_reference/daily-lockdown-consensus.mjs),
with boundary and block-validity tests in
[`tests/iat-b3-daily-lockdown-consensus.test.mjs`](../../tests/iat-b3-daily-lockdown-consensus.test.mjs).
The same Rust crate now also contains the selected Solana-profile domain
separation, persistent daily-decision validation, and fail-closed IAT transfer
disposition. SlotHashes account access and the Token-2022 hook adapter remain
the next measured implementation phase.

The documents deliberately separate two deployment profiles:

1. **V2/Solana** is the existing program, website, launch-control, and evidence
   system. It is the migration source and behavioral reference.
2. **B3/Solana** is the selected least-cost profile: a Token-2022 IAT mint with
   native confidential transfers and an immutable IAT Daily Law hook. The owner
   explicitly relaxed chainwide scope, first-block decision, threshold-VRF
   randomness, and independent-clock guarantees to avoid operating a sovereign
   validator network. The exact boundary is recorded in
   [Native confidential IAT transfers](SHIELDED_TRANSFERS.md).

The former sovereign profile remains the only route to making the Daily Law a
chainwide consensus rule for all transactions. It is not the selected build
because its validator and operations investment conflicts with the current
cost constraint.

No B3 implementation may replace a V2 guarantee with a weaker approximation
to meet a size, cost, schedule, or marketing target.
