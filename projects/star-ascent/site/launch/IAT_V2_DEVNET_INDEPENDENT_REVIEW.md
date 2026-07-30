# IAT V2 devnet initialization review

Status: **AUTOMATED CHAIN CHECKS PASS / INDEPENDENT HUMAN REVIEW PENDING**

This card covers only the seven-transaction initialization and activation
sequence. It does not claim that the later staking, weekly CCC, Switchboard
commit-reveal, settlement, or maturity flows have completed an on-chain
rehearsal.

## Evidence identity

- Evidence file: `launch/iat-v2-devnet-initialization.evidence.json`
- Evidence SHA-256:
  `902f7608b1f001e238c6e7999f8424b9a0fd38a61ac08db6f6b7e5f785d37602`
- Source commit bound to the verified program:
  `ba88535036da3f3871b65100fc18b655ccfa1d57`
- Program:
  `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`
- On-chain program artifact SHA-256:
  `8239e164b4ba93d19448f9c7e102eb20170c627de95e53352e3f5b1cd4e6b756`
- Upgrade authority:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- Devnet mint:
  `BTuhzdrH2vnMELbHZWPJ1FoFRoBhkMDAyCSCRRLew4GR`

## Independent verifier

- Accountability label: **FDF Guard**
- Public address:
  `Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja`
- Must be independent of the Model T operator.

## Compare

- [ ] All seven transaction signatures in the evidence file are distinct,
  successful, finalized, and ordered from mint creation through activation.
- [ ] Every recorded transaction message SHA-256 matches the finalized
  transaction message.
- [ ] The program is executable, contains 597,336 program bytes, matches the
  artifact SHA-256 above, and is controlled by the reviewed Model T address.
- [ ] Mint decimals are 9 and total supply is exactly
  `1000000000000` base units (1,000 rehearsal IAT).
- [ ] Mint authority is `None`.
- [ ] Freeze authority is `None`.
- [ ] Immutable metadata is the canonical IAT record.
- [ ] Community custody contains `500000000000` base units.
- [ ] Treasury vault contains `200000000000` base units.
- [ ] Ecosystem vault contains `150000000000` base units.
- [ ] Core-team vault contains `100000000000` base units.
- [ ] Liquidity vault contains `50000000000` base units.
- [ ] Stake vault exists with zero starting principal.
- [ ] V2 config is active, in rehearsal mode, has lane mask `30`, and pins the
  official Switchboard devnet program.
- [ ] The core reward record fixes 17% for 104 weeks and reserves
  `34000000000` base units from treasury first.
- [ ] Mainnet remains `HOLD`.

## Sign-off

The verifier should return a separate public statement containing:

1. evidence SHA-256;
2. verifier accountability label and public address;
3. exact UTC completion time;
4. an explicit statement that every checkbox above matched;
5. any exception or mismatch.

Do not put a private key, recovery phrase, PIN, passphrase, wallet export, or
signature request in the review statement.
