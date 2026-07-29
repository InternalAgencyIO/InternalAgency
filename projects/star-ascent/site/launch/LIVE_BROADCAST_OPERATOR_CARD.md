# STAR ASCENT live broadcast operator card

Status: **HOLD — WINDOW OPENS 30 JULY 2026 AT 03:45:00 UTC**

## Before the window

- Open only verified official URLs, public source, and the Proof Board.
- Confirm the old `/mint` page says `SUPERSEDED // DO NOT SIGN`.
- Confirm `launch/release-snapshot.generated.json` remains `HOLD`.
  `launch/mainnet-handoff.template.json` `APPROVED` and
  `launch/release-packet.template.json` `READY` do not authorize V2 until their
  schemas bind the V2 program evidence.
- Read aloud: **HOLD until the exact V2 build, devnet deployment, rehearsal, and
  independent evidence are verified.**

## Reviewed V2 sequence

State each boundary, but show a transaction only after the builder and verifier
have compared it:

1. `DEPLOY_PROGRAM_WITHOUT_IAT`
2. `TRANSFER_UPGRADE_AUTHORITY_TO_MODEL_T`
3. `CREATE_INITIALIZE_IMMUTABLE_MINT_AND_METADATA`
4. `INITIALIZE_CONFIG_LANE_VAULTS_AND_STAKE_VAULT`
5. `MINT_COMMUNITY_AND_FOUR_PROGRAM_VAULT_ALLOCATIONS`
6. `REVOKE_MINT_AUTHORITY`
7. `REVOKE_FREEZE_AUTHORITY`
8. `ACTIVATE_AFTER_RANDOMNESS_BUILD_AND_REVIEW_GATES`

For every authority or value boundary, the owner checks the physical device and
the independent verifier checks the confirmed on-chain result. Then complete
the V2 positive and adversarial rehearsal matrix.

Publication is a separate human action. Publish only after matching the source
commit, SBF hash, program authority, mint, metadata, five allocation accounts,
vaults, vesting configuration, revoked authorities, and randomness evidence.

## Stop conditions

Say `HOLD` and stop if a device prompt differs, an address or digest differs, a
transaction fails, an expected rejection succeeds, evidence cannot be checked,
a credential is requested, or an approval becomes stale. Never improvise a
correction or reuse stale evidence.
