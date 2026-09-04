# IAT V2 Devnet buffer partial-upload incident — 2026-08-28

Status: **DEVNET HOLD / FINALIZED PARTIAL BUFFER OBSERVED / REVIEWED ARTIFACT NOT PRESENT**.
Mainnet was not accessed.

The attended, target-bound write invocation reached through the separately
reviewed pre-address recovery entrypoint for
`564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH` returned:

`Data writes to account failed: Custom error: Max retries exceeded`

The invocation used `--max-sign-attempts 5`, so that error does not establish a
transaction count, a no-send result, or complete failure. No exact transaction
signature or receipt was emitted. The invocation must not be rerun or resent.

The helper's original reconciliation did not reach chain state. Its keyless
`solana program show` command failed locally because Solana CLI 3.1.10 tried to
resolve a default signer from the deliberately nonexistent keyless home. That
local tooling error proved neither account presence nor absence.

A separate signer-free JSON-RPC reconciliation then pinned the canonical Devnet
endpoint and exact genesis hash
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. At finalized context slot
`489440472`, it observed:

- buffer address `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH`;
- owner `BPFLoaderUpgradeab1e11111111111111111111111`;
- `executable: false`;
- `4,522,976,880` observed lamports (not a rent-exemption conclusion);
- upgradeable-loader state tag `1` and authority-present tag `1`;
- authority `DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4`;
- `649,717` total account bytes: `37` metadata bytes plus `649,680`
  program payload bytes; and
- observed payload SHA-256
  `b93ff94d13fdd2c2ebe75af8630f70bfa3d59ab1578993a52377283edbf414ef`,
  which does **not** equal the reviewed artifact SHA-256
  `771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`.

An independent finalized byte comparison against the exact 649,680-byte public
CI artifact established that payload bytes `[0, 19200)` match exactly and
payload bytes `[19200, 649680)` remain zero. Every mismatch is an observed zero
in place of an expected nonzero artifact byte; there are no nonzero mismatches.
This reconciles the ambiguous invocation as a finalized partial on-chain effect,
not a complete upload.

These raw-RPC account bytes establish finalized state only. They do not prove
the number of attempted transactions or signatures, identify a transaction
receipt, or establish a complete causal history of the preceding write attempt.

## Exact Agave `write-buffer` public-address source audit

The recovery design was audited against Agave source commit
`7bc9c805218ca06769956e2cb61601329f5a0f6c`, not inferred from the ambiguous
write result. In that exact source:

- [`cli/src/program.rs` lines 800–844](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L800-L844)
  accepts `--buffer` either as a signer or, when no signer resolves, through the
  public-key path. [`clap-utils/src/keypair.rs` lines 834–845](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/clap-utils/src/keypair.rs#L834-L845)
  returns a literal public key without loading a signer.
- [`process_write_buffer` lines 1626–1698](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L1626-L1698)
  constructs a shared ephemeral keypair object before choosing the route, but a
  supplied public buffer address selects `(None, pubkey)`: the ephemeral object
  is not selected or passed as the buffer signer.
- [`fetch_buffer_program_data` lines 1497–1546](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L1497-L1546)
  reads the addressed account and checks loader ownership, Buffer state,
  authority, and minimum size. The public-address route is therefore limited to
  an already-existing compatible buffer; if it is absent, there is no buffer
  signer with which to create that address, and
  [`send_deploy_messages` lines 2989–3032](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L2989-L3032)
  stops rather than creating it.
- [`do_process_write_buffer` lines 2620–2718](https://github.com/anza-xyz/agave/blob/7bc9c805218ca06769956e2cb61601329f5a0f6c/cli/src/program.rs#L2620-L2718)
  emits no create instructions for an existing buffer, compares each complete
  target chunk with the same existing payload chunk, skips matching chunks, and
  queues each differing chunk in full. Its write messages name the buffer public
  key and buffer-authority public key; the caller supplies the fee payer and
  buffer authority as the write signers, not a buffer-account signer.

This audit establishes only the behavior expressed by that pinned source. It is
not evidence that the local executable completed any write, that a particular
set or number of chunks was submitted or finalized, or that any transaction,
signature, or receipt exists. The finalized `b93f…14ef` partial state remains
**HOLD** until a new signer-free finalized observation proves the complete
649,680-byte payload and exact `771c…8a01` target hash. It authorizes no handoff,
deployment, release, or Mainnet action.

The partial-state hash `b93f…14ef` is incident evidence only. It must never be
presented as an acceptable artifact hash. Do not claim a successful artifact
upload, exact transaction or signature evidence, a ready buffer, authority
handoff, deployment, feature migration, proof release, or Mainnet readiness.

The original protected reservation must remain unchanged. Recovery requires a
new, separately reviewed, target-and-prestate-bound one-use in-place lane with a
distinct crash-durable permanent CAS. That lane must be bound to fresh exact-head
public CI and its direct binding-only successor. Before mutation it must
reobserve the exact finalized owner, layout, authority, full partial hash,
19,200-byte exact prefix, and zero tail at a context slot no earlier than
`489440472`; bind the exact reviewed artifact and toolchain; avoid the protected
buffer signer by addressing the already-created buffer by public key; disclose
the exact observed `[19200, 649680)` differing region plus the pinned CLI's
full-differing-chunk write plan; and stop on any drift. It must never
create or close a buffer, access the protected signer, transfer authority, hand
off, deploy, release, or access Mainnet. Its attended authorization must disclose
that one bounded recovery invocation may sign and send multiple deployer-key
Devnet buffer-write transactions. Any ambiguous result returns to reconcile-only
HOLD with no resend. Final recovery success requires a fresh finalized
observation of the same address, owner, authority, exact 649,680-byte payload,
and target SHA-256 `771c…8a01`.

No Trezor prompt, hardware signature, transaction signing, broadcast, or state
mutation occurred during the signer-free reconciliation documented here.
