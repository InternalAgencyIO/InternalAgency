# IAT V2 return checklist

**Current state:** host-tested; mainnet `HOLD`

The old `/mint` route is intentionally disabled. Do not connect Backpack or
sign from it. The next human session starts with the V2 build/deployment
evidence, not a mint transaction.

## Bring back

- Trezor Model T, cable, and the computer used for the reviewed public
  administrator address:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`.
- Backpack and Trezor firmware version numbers.
- Sufficient **devnet** SOL for rehearsal fees. Do not send mainnet SOL for a
  devnet step.
- FDF Guard available to verify independently.
- Access to a Linux or WSL2 environment with the pinned Rust, Solana, Anchor,
  and Docker toolchain.
- The public announcement/broadcast URL if it will be used.

Never provide a seed phrase, PIN, passphrase, private key, recovery material,
wallet export, derivation path, or program keypair.

## Do together

1. Confirm the exact source commit and that the automated checks remain green.
2. Generate a program keypair outside the repository; share only its public
   program ID.
3. Bind that ID into the source and commit the exact bound tree.
4. Run the locked verifiable SBF build and compare its hash.
5. Deploy the program **unfunded** to devnet.
6. Transfer upgrade authority to the reviewed Model T administrator and verify
   the ProgramData authority on-chain before funding.
7. Create the scaled devnet mint, initialize every V2 PDA, fund the five
   destinations, revoke mint/freeze authorities, and activate.
8. Run the complete positive and adversarial scenario matrix in
   `launch/DEVNET_REHEARSAL_SCENARIO.md`.
9. Export the non-secret rehearsal evidence and have FDF Guard independently
   compare it.
10. Re-run the full source, build, deployment, evidence, and publication gates.

## Mainnet boundary

Mainnet is not a continuation button. After devnet passes, perform a separate
mainnet review session with:

- exact final program and mint IDs;
- exact verifiable binary and source commit;
- reviewed deployment/upgrade-authority procedure;
- final vault addresses and amounts;
- program security and economic review;
- complete independent devnet evidence;
- transaction-by-transaction hardware prompts and stop conditions.

No countdown, site deployment, source publication, test result, verbal
approval, or unattended automation may sign, submit, or authorize mainnet.
