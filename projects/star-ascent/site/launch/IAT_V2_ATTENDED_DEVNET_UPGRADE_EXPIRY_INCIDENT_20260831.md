# IAT V2 attended Devnet upgrade expiry incident — 2026-08-31

Status: **HOLD / SIGNED UPGRADE EXPIRED BEFORE BROADCAST**. Mainnet was not
accessed.

During the attended `UPGRADE_PROGRAM` ceremony, the operator reported the exact
console error:

`Signed transaction blockhash is no longer valid`

In the reviewed upgrade surface, this error can arise only inside the separate
broadcast control's exclusive `beforePersist` callback. The callback first
proves the exact durable signed-pending wire, refreshes finalized program and
buffer state, rebuilds and compares the reviewed message, verifies the local
signature, and then checks the signed blockhash at finalized and processed
commitment. The permanent broadcast-attempt reservation is created only after
that callback succeeds, and the sole `sendRawTransaction` call is reachable
only after the reservation is durably retained. Therefore this exact failure
path is pre-reservation and pre-send. The reported error does not identify
which of the finalized or processed validity checks returned false.

Fresh signer-free finalized Devnet observations established that no program
upgrade landed:

- program `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj` still points to
  ProgramData `6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP`;
- ProgramData remains at deployment slot `489333243`, retains upgrade authority
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`, and has a 649,680-byte loader
  region with SHA-256
  `88d2a55973fd89245697d07e0e662cebdc3c0154bad4aa8f81e4c446beee34a3`;
- the first 597,336 ProgramData bytes retain the old program SHA-256
  `634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7`,
  and the added 52,344 capacity bytes remain zero;
- buffer `564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH` still exists under the
  upgradeable loader, retains authority
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`, and contains the exact
  649,680-byte target artifact with SHA-256
  `771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`;
- canonical buffer reconciliation at finalized slot `491084506` returned no
  hold reasons and evidence-body SHA-256
  `1db0e3eb84e70fc3301e5d233d0784a39547cc2169e59751b59e28a2b5fa41ca`;
- the latest finalized ProgramData transaction remains the successful 52,344
  byte capacity extension at slot `489333243`; no later confirmed or finalized
  Program or ProgramData transaction was observed.

After the error, the attended page was reloaded and exposed only its memory-only
hardware session gate. The operator reported `storage-access-denied` from the
Trezor address-display request and `ACTION UI REMAINS UNRENDERED`. No browser
storage was inspected, so this incident does not claim a particular local
prompt-latch, tombstone, signed-pending, or broadcast-attempt record beyond the
reviewed source semantics. The expired transaction's message hash, blockhash,
last-valid height, signed-wire hash, and local signature were not supplied and
must not be invented.

The old source/artifact/mint/action ceremony is terminal. Do not retry the
Model T transaction signature, press broadcast, clear site data, change the
browser profile/origin/port, reconstruct or submit the expired wire, or erase
the old latch. A replacement prompt requires a genuinely new reviewed ceremony
source binding, fresh exact-head public CI, authenticated artifact and runtime
evidence, and a binding-only successor. The immutable migration artifact tuple
remains separately pinned to source
`a03fe71dd66cd1650b8d0353e486786df30b83e9`, CI run `33161771816` attempt 1,
649,680 bytes, and SHA-256
`771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01`;
it must not be relabeled as recovery-source evidence.

This incident record is not a transaction receipt, deployment receipt, release,
or Mainnet authorization.
