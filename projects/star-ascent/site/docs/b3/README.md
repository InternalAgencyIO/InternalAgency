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
- [Deployment-cost feasibility](COST_FEASIBILITY.md)
- [White paper draft](WHITEPAPER_DRAFT.md)

The first executable specification is
[`programs/iat_b3_reference/friday-consensus.mjs`](../../programs/iat_b3_reference/friday-consensus.mjs),
with boundary and block-validity tests in
[`tests/iat-b3-friday-consensus.test.mjs`](../../tests/iat-b3-friday-consensus.test.mjs).

The documents deliberately separate two systems:

1. **V2/Solana** is the existing program, website, launch-control, and evidence
   system. It is the migration source and behavioral reference.
2. **B3 Protocol** is the sovereign protocol required by the immutable Random
   Friday Lockdown Law: exact `6733/10000` selection, a proof-verifiable
   pre-lockdown decision, and a height-derived nominal Friday 00:01 through
   Saturday 00:01 UTC+03:00 lock. A Solana program cannot impose this
   chain-wide rule on SOL transfers, unrelated SPL transfers, or other
   programs.

No B3 implementation may replace a V2 guarantee with a weaker approximation
to meet a size, cost, schedule, or marketing target.
