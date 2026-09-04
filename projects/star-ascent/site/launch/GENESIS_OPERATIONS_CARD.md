# IAT V2 Genesis operations card

Status: **UNSCHEDULED — MAINNET HOLD — FUNDING AND FINAL PACKET PENDING**

No replacement UTC window is published and there is no automatic transaction.
The superseded four-transaction `/mint` page is read-only and must not be used.

## Roles

| Role | Required action |
| --- | --- |
| Signer | Reviews every authority-changing or value-moving action on the physical Model T. |
| Builder | Builds only from the committed, program-ID-bound source and cannot substitute addresses. |
| Automated evidence validator | Checks source/binary identity, every address, amount, authority, scenario, and Explorer result from bound receipts/state/endpoints. |
| Broadcaster | Publishes only text copied from the source-bound automated evidence packet after explicit owner publication approval. |

## Canonical V2 gates

1. Review `engagement/iat-economic-policy.v2.json`,
   `launch/iat-v2-allocation-plan.template.json`,
   `launch/iat-v2-devnet-rehearsal.template.json`,
   `docs/IAT_V2_PROGRAM_ARCHITECTURE.md`, and `programs/iat_v2/README.md`.
2. Bind a new public program ID using `scripts/bind-iat-v2-program-id.mjs`.
   Commit the exact bound source; program-keypair material stays outside the
   repository.
3. Run `scripts/verify-iat-v2-sbf.sh` in the pinned Linux/WSL2 toolchain and
   preserve the verifiable SBF hash.
4. Follow `launch/DEVNET_REHEARSAL_SCENARIO.md`. Deploy unfunded, transfer
   upgrade authority to hardware control, initialize, fund, activate, and test
   V2 on devnet.
5. The automated evidence lane compares the complete Devnet evidence and negative
   cases against the source, policy, plan, program authority, and binary.
6. Regenerate `launch/release-snapshot.generated.json` in `HOLD`. The legacy
   `launch/token-metadata.template.json`,
   `launch/allocation-lock-plan.template.json`,
   `launch/genesis-manifest.template.json`,
   `launch/devnet-rehearsal.template.json`, and
   `launch/genesis-signing-checklist.template.json` remain historical
   consistency artifacts; they cannot authorize V2.
7. `launch/mainnet-handoff.template.json` may become `APPROVED` and
   `launch/release-packet.template.json` may become `READY` only after they are
   upgraded to bind the V2 evidence. Keep
   `launch/pre-publication-packet-proof.generated.json` and
   `launch/PUBLICATION_PAYLOAD.template.md` on HOLD until direct mainnet
   evidence exists.

## Exact planned allocation math

These are targets, not claims of completed minting. The base-unit amounts total
exactly `1000000000000000000` at 9 decimals.

| Destination | Share | Base units | Custody |
| --- | ---: | ---: | --- |
| Community | 50% | `500000000000000000` | Published hardware-wallet custody |
| Treasury | 20% | `200000000000000000` | IAT V2 program vault PDA |
| Ecosystem | 15% | `150000000000000000` | IAT V2 program vault PDA |
| Core team | 10% | `100000000000000000` | IAT V2 program vault PDA |
| Liquidity | 5% | `50000000000000000` | IAT V2 program vault PDA |

## Reviewed stage order

Do not reorder, omit, or combine an authority boundary:
Before the first boundary, bind every blockhash-free reviewed intent and
expected post-state in `launch/iat-v2-mainnet-stage-journal.template.json` and
validate it as `ARMED`. For each stage, hash the actual serialized message after
its fresh blockhash is added and before submission; do not pretend all eight
expiring messages can be frozen in advance.

1. `DEPLOY_PROGRAM_WITHOUT_IAT`
2. `TRANSFER_UPGRADE_AUTHORITY_TO_MODEL_T`
3. `CREATE_INITIALIZE_IMMUTABLE_MINT_AND_METADATA`
4. `INITIALIZE_CONFIG_LANE_VAULTS_AND_STAKE_VAULT`
5. `MINT_COMMUNITY_AND_FOUR_PROGRAM_VAULT_ALLOCATIONS`
6. `REVOKE_MINT_AUTHORITY`
7. `REVOKE_FREEZE_AUTHORITY`
8. `ACTIVATE_AFTER_RANDOMNESS_BUILD_AND_REVIEW_GATES`

After each confirmed boundary, stop for automated source/receipt/state reconciliation and record a
direct Explorer URL plus the observed post-state digest. Continue only on an
exact match. The first failure, mismatch, or submitted transaction whose
confirmation remains unknown permanently changes this journal to
`TERMINAL_HOLD`; all later boundaries remain `NOT_ATTEMPTED`. Never retry an
unknown signature, compensate, or improvise a repair transaction.

After activation, complete every positive and adversarial scenario in the V2
rehearsal template. Publication is a separate explicit owner decision, not a
transaction or protocol stage.

## Stop and return to HOLD if

- a device prompt is unclear, blind, or unexpected;
- source, binary, deployed program, ProgramData, or upgrade authority differs;
- an address, amount, program, decimal, metadata field, vault, or mint
  authority differs;
- the official cluster-specific Switchboard program is not used;
- a positive case fails or a negative case succeeds;
- a digest, review, deployment, or approval timestamp is absent or stale;
- a credential, secret, reroll, reward debt, or unreviewed correction is
  requested.

Preserve observable evidence and repeat review. Do not improvise a repair
transaction or reuse an earlier approval.

## Minimum public record after verification

Do not publish this record until the stage journal is `RECONCILED` with all
eight boundaries `FINALIZED_MATCHED`.

- Source commit, public program ID, verifiable SBF hash, ProgramData address,
  and hardware-controlled upgrade-authority evidence
- Mint address, metadata, Original SPL Token Program, 9 decimals, and exact
  fixed supply
- Five allocation accounts, vault PDAs, schedules, and balances
- Mint- and freeze-authority revocation evidence
- Switchboard program/account, commit, reveal, derivation counter, winning
  index, and settlement evidence
- Devnet scenario matrix, automated evidence receipt, UTC timestamps, and
  clear remaining mainnet HOLD/GO decision
