# IAT V2 Solana program

This Anchor program implements the public IAT V2 economic policy. It is
host-tested but not deployed, independently reviewed, or authorized for
mainnet.

The checked-in `declare_id!` is a deliberately non-deployable sentinel. No
corresponding secret key exists. A reviewed public program ID must replace it
before the exact source is committed and built. Program-keypair material must
stay outside the repository.

## Implemented controls

- Original SPL Token Program, nine decimals, fixed mainnet supply, and scaled
  rehearsal supply.
- Exact community, treasury, ecosystem, core-team, and liquidity allocations.
- Program-owned PDA vaults for vested lanes and user principal.
- Mint and freeze authority revocation required before activation.
- Core 17% / 104-week reward obligation reserved before user positions.
- Fully collateralized 52-week standard, CCC Agent, and CCC Associate
  positions with no reward debt or automatic compounding.
- Treasury → ecosystem → liquidity reservation and payment order.
- Permissionless weekly settlement, vested-principal claims, principal return,
  and residual-reservation release.
- Append-only agency registry; CCC round zero opens 24 hours after Genesis,
  then one immutable round opens every seven days.
- One-roll exact-uniform tiebreak with no operator reroll.
- Switchboard On-Demand 0.13 randomness account ABI parser with exact official
  mainnet/devnet program IDs, an immediately preceding atomic commit
  instruction, fresh prior-slot seed, current-slot reveal, seed-slot binding,
  and discriminator/size checks.

## Current evidence

The locked host build passes fourteen Rust tests, including the shared 100-way
tiebreak vector and adversarial Switchboard ABI/slot fixtures. The JavaScript
policy, client, and public program-ID binding suite independently passes
twenty-one tests.

This is not sufficient for deployment. Mainnet remains on HOLD until all of
the following are complete:

1. Bind a real public program ID and commit the exact reviewed source.
2. Run the locked SBF/verifiable build under Solana CLI 3.1.10 and Anchor CLI
   1.0.2 on Linux/WSL.
3. Run local-validator adversarial and Switchboard commit/reveal integration
   tests.
4. Transfer program upgrade authority to the published Model T administrator
   before any IAT enters a program vault.
5. Complete the matching hardware-wallet devnet rehearsal and independent
   comparison.
6. Publish the program binary hash, program data/authority proof, mint and
   vault addresses, transaction evidence, and security/economic review.

No script in this directory signs or broadcasts a transaction.
