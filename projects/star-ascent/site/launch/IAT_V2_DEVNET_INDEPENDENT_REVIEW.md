# IAT V2 corrected-program feature review

Status: **AUTOMATED CHAIN CHECKS PASS / INDEPENDENT HUMAN REVIEW PENDING**

This card binds the corrected Devnet program to the 18-transaction on-chain
feature rehearsal. Every immediately available feature action is recorded.
Later maturity, cliff, and linear-unlock gates remain outside the signed
snapshot, and mainnet remains `HOLD`.

## Evidence identity

- Feature evidence:
  `public/evidence/iat-v2/v2-features-20260801T053340Z.json`
- Feature evidence SHA-256:
  `7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9`
- Read-only chain receipt:
  `public/evidence/iat-v2/chain-status-20260801T053947Z.json`
- Chain receipt SHA-256:
  `0a2e1f8ffeecffaf974e51f2d6e9abe020517a784c5cfa8b9c0f6af1f1efa4ce`
- Program:
  `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`
- ProgramData:
  `6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP`
- Corrected on-chain program artifact SHA-256:
  `634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7`
- Program bytes: `597336`
- Corrected artifact deployment slot: `480117343`
- Upgrade authority:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- Feature mint:
  `CAJGkRQWXvJrUxK91XBPereaVSAUGzUY4yagxRKJdKUE`
- Feature config:
  `9sqs4iAD9HBUA5a8L8eV39B1KepKb9jrRW3hAzvsPTBP`

The seven-transaction initialization export describes a separate deterministic
Devnet rehearsal instance. Its different mint and config do not represent a
mainnet mint and must not be substituted for this feature evidence.

## Automated observations to reproduce

- All 18 feature signatures are finalized with no reported transaction error.
- The final four transaction-message SHA-256 values match the finalized
  transaction messages:
  - round-8 commit at slot `480373915`;
  - round-8 reveal at slot `480374608`;
  - CCC-agent settlement at slot `480374877`;
  - CCC-associate settlement at slot `480375366`.
- The standard position records 10% APY, paid `19230769` base units for week 8,
  with settled mask `1`.
- The CCC-agent position records 28% APY, paid `53846153` base units for week 8,
  with settled mask `1`.
- The CCC-associate position records 20% APY, paid `0` for week 8, with settled
  mask `1`, matching the selected-agency pause rather than a failed settlement.
- Round 8 is settled with selected agency index `1` and derivation counter `0`.
- Core reward paid is `326923076` base units and Genesis liquidity principal
  claimed is `12500000000` base units.
- The latest receipt covers the exact 29-signature union across historical V1,
  V2 initialization, and the current feature export; all 29 are finalized with
  no reported transaction error.

## Independent verifier

- Accountability label: **FDF Guard**
- Public address:
  `Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja`
- Must be independent of the Model T operator.
- Canonical response template:
  `launch/iat-v2-devnet-feature-independent-signoff.template.json`

## Compare

- [ ] The feature export SHA-256 matches the value above.
- [ ] All 18 feature signatures are distinct, successful, finalized, and in the
  recorded action order.
- [ ] Every recorded transaction-message SHA-256 matches the finalized message.
- [ ] The program is executable, contains 597,336 program bytes, matches the
  corrected artifact SHA-256, and has the pinned ProgramData and upgrade
  authority.
- [ ] The three stake roles, principals, APY rates, reservations, paid amounts,
  and week-8 settled bits match the export.
- [ ] Round-8 commit/reveal state, selected agency, and derivation counter match.
- [ ] The CCC-agent payout and selected-agency CCC-associate pause match.
- [ ] Core reward, liquidity unlock, and Switchboard devnet ownership match.
- [ ] The chain receipt contains exactly 29 canonical finalized signatures with
  no reported error.
- [ ] Later maturity, cliff, and linear-unlock gates are explicitly acknowledged
  as not proven by this signed snapshot.
- [ ] Mainnet remained `HOLD` throughout review.

## Sign-off

Return the completed JSON template with every check set to `true`, no
exceptions, the exact canonical attestation, and a UTC completion time after
both evidence records. Do not include a private key, recovery phrase, PIN,
passphrase, wallet export, signature request, or any other credential material.

Independent review does not authorize mainnet. Funding, a new exact UTC launch
time, and every mainnet release gate remain separate.
