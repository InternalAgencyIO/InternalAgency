# IAT V2 devnet rehearsal

**State:** `PROGRAM + ON-CHAIN FEATURES + LOCAL TIME GATES VERIFIED / MAINNET HOLD`

**Mainnet:** `HOLD`

Mainnet `HOLD` remains mandatory throughout this rehearsal.

The old `/mint` route is a superseded four-transaction ceremony and intentionally
read-only. It cannot initialize the V2 program, program vaults, reward
reservations, weekly CCC assignment, or Switchboard randomness. Do not connect
a wallet or sign from that page.

This rehearsal is complete only when every phase below has direct devnet
evidence and the independent verifier has compared the evidence against the
exact public source.

## Safety boundary

- Never place a seed phrase, PIN, passphrase, private key, wallet export, or
  program keypair in this repository, a browser form, Codex, or an evidence
  file.
- No automation may approve a hardware prompt or broadcast a transaction.
- The V2 program must be deployed **without IAT funding**.
- Program upgrade authority must be transferred to the published hardware
  administrator before any rehearsal IAT enters a program vault.
- Stop on any unexpected address, program ID, instruction, amount, authority,
  or blind/unclear hardware prompt.
- A successful devnet rehearsal is evidence, not mainnet authorization.

## Phase 1 — lock the source and build

1. Use Linux or WSL2 with the pinned versions in `Anchor.toml` and
   `rust-toolchain.toml`: Rust `1.97.1`, Solana CLI `3.1.10`, Anchor CLI and
   crates `1.0.2`.
2. Create the deployment program keypair outside the repository and record
   only its public program ID.
3. Run:

   ```text
   npm run bind:iat-v2-program-id -- --program=<PUBLIC_PROGRAM_ID> --write=yes
   ```

4. Commit the exact bound source. Do not build from an uncommitted tree.
5. Run `scripts/verify-iat-v2-sbf.sh`. Record the source commit, verifiable SBF
   hash, binary size, and tool versions.
6. Independently compare the bound `declare_id!`, all `Anchor.toml` cluster
   entries, the policy, and the allocation plan.

## Phase 2 — deploy unfunded and transfer control

1. Deploy the program **unfunded** using the exact verified SBF binary on
   devnet, without creating, minting, or transferring rehearsal IAT.
2. Verify the executable program account, ProgramData account, deployed binary
   hash, deployment transaction, and current upgrade authority.
3. Transfer upgrade authority to the published program administrator:
   `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.
4. Verify the new authority on-chain and on the physical Model T. Record the
   transfer transaction.
5. Do not continue if the program is immutable unexpectedly, controlled by a
   different address, or differs from the reviewed binary.

## Phase 3 — initialize the scaled devnet system

Use the scaled `1,000 IATDEV2` plan in
`launch/iat-v2-devnet-rehearsal.template.json`.

1. Create the devnet mint and immutable metadata.
2. Initialize the V2 config with the official devnet Switchboard On-Demand
   program `Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2`.
3. Initialize treasury, ecosystem, core-team, liquidity, and stake vault PDAs.
4. Mint the scaled `50 / 20 / 15 / 10 / 5` allocations to community custody
   and the four program vaults.
5. Revoke mint authority and freeze authority permanently.
6. Activate only after the program, vault balances, destinations, policy hash,
   randomness program, and hardware-controlled upgrade authority all match.

## Phase 4 — exercise the policy

Use the localhost-only feature console at
`http://127.0.0.1:4175/?mode=features`. It derives a second scaled rehearsal
mint, `8Lx1fQDbWNArCo2kWQCYbvx8JgahrkvNgadUPaGhudPM`, under the exact deployed
program and reviewed Model T administrator. Its rehearsal-only Genesis override
places the instance two hours before the next policy-week boundary. Mainnet
configuration forbids this override.

The feature sequence is fail-closed and requires a separate operator click to
simulate/sign and then broadcast every transaction. It registers two public
agency addresses, funds the participant with only enough devnet SOL for
position rent, opens standard/CCC Agent/CCC Associate positions, settles core
APY, claims unlocked liquidity principal, and executes a real Switchboard
commit/reveal.

The first standard position settlement opens at the next policy-week boundary.
Because a position accrues only from `accepted_week + 1` and CCC round `N`
opens 24 hours after policy week `N`, the linked CCC positions require the
matching real round approximately 24 hours later. Do not alter Genesis, replace
Switchboard evidence, or label these settlements complete early. Local warp
tests cover 52-week maturity and failure boundaries; live Switchboard
commit/reveal and linked settlement remain devnet evidence requirements.

Complete every scenario listed in the V2 rehearsal template, including:

- 25% genesis reward capacity and core-team reward reservation;
- fully collateralized standard, CCC Agent, and CCC Associate positions;
- rejection of undercollateralized rewards and reward debt;
- treasury → ecosystem → liquidity reservation order;
- 17% fixed core reward unaffected by CCC assignment;
- rejection of CCC round zero before the 24-hour Genesis delay, acceptance at
  the exact boundary, and the seven-day cadence thereafter;
- vesting boundaries and permissionless principal claims;
- an immediately preceding atomic Switchboard commit with its fresh prior-slot
  seed, later current-slot reveal, exact-uniform mapping, and no reroll;
- two-way and 100-way tie vectors;
- rejection of wrong-owner, wrong-program, malformed, stale, mismatched, and
  already-settled randomness;
- selected-agency and downstream-position weekly pauses without touching prior
  accrual or principal;
- principal withdrawal and unused reservation release.

Local-validator warp tests may prove time boundaries, but the Switchboard
commit/reveal and authority flow must also be evidenced on devnet.

### Local time-gate follow-up

The deterministic host-program proof at
`public/evidence/iat-v2/v2-local-time-gate-proof-20260801T072730Z.json` covers
the exact pre-boundary and boundary behavior for policy weeks, CCC cadence,
52-week position maturity, 26/52-week cliffs, and 104/208-week linear ends.
It compiles tests against the exact Rust policy without changing the locked
program source and cross-checks the JavaScript reference engine. It deliberately
uses no validator transaction, signer, keypair, wallet, or network state and
must never be described as signed Devnet evidence.

## Phase 5 — export and independently verify

Complete a copy of `launch/iat-v2-devnet-rehearsal.template.json` without adding
secrets. It must include:

- exact source and policy digests;
- public mint, program, ProgramData, config, vault, and token-account addresses;
- verifiable SBF hash and deployed-program comparison;
- deployment, upgrade-authority, initialization, funding, revocation,
  activation, positive-case, and negative-case transaction links;
- operator device/interface versions and confirmed-action labels;
- verifier comparison results and UTC completion times.

`FDF Guard` must independently compare the public addresses, program authority,
binary/source evidence, five destinations, mint authorities, policy behavior,
Switchboard commit/reveal, and negative cases.

Mainnet remains `HOLD` if any field is missing, any transaction failed, any
source or binary hash differs, or any reviewer conclusion is conditional.
