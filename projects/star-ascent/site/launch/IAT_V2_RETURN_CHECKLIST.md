# IAT V2 return checklist

Prepared at `2026-07-31T01:43:34Z`.

Mainnet remains `HOLD`. No unattended script may sign or broadcast a
mainnet transaction.

## Verified state before the operator returns

- Program: `62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj`
- ProgramData: `6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP`
- Program administrator / community custody:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- Abandoned incomplete Devnet buffer, now closed for rent recovery:
  `Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6`
- Fresh Devnet buffer:
  `GvZjpzaDyX3w5q3AvfmXgnZFRz8xoevkAXKdutU3dfkN`
- Required final buffer authority:
  `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`
- Required program artifact SHA-256:
  `634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7`
- Required program bytes: `597336`
- Current deployed Devnet hash:
  `8239e164b4ba93d19448f9c7e102eb20170c627de95e53352e3f5b1cd4e6b756`
The old upload, repair, and standalone handoff launchers are disabled. They
must not be used. The fresh rebuild launcher closes only the abandoned Devnet
buffer, reclaims its rent, creates one clean buffer, verifies the exact reviewed
binary, and hands authority to `7XZ...fzPH`.

## Operator sequence

1. Double-click `OPEN_IAT_DEVNET_FRESH_REBUILD.cmd`.
2. Leave the window open. Wait for `FRESH REBUILD COMPLETE`.
   - The helper retries public-RPC transport failures.
   - It creates exactly one fresh buffer after closing the abandoned buffer.
   - Its temporary creation signer is never printed and is deleted on exit.
   - It independently dumps and hashes the buffer.
   - It hands authority to `7XZ...fzPH` only after the exact reviewed hash is
     present.
3. Return to:
   `http://127.0.0.1:4175/?mode=upgrade&buffer=GvZjpzaDyX3w5q3AvfmXgnZFRz8xoevkAXKdutU3dfkN`
4. Click `VERIFY BUFFER`.
5. Continue only when the screen shows:
   - buffer authority `7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH`;
   - buffer hash
     `634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7`;
   - current hash
     `8239e164b4ba93d19448f9c7e102eb20170c627de95e53352e3f5b1cd4e6b756`;
   - mainnet `HOLD`.
6. Connect the `7XZ...fzPH` Model T and click
   `CONNECT 7XZ + SIMULATE + SIGN`.
7. Review and approve the Devnet-only upgrade on the Model T.
8. Only after the console shows `SIGNED // NOT BROADCAST`, click the separate
   `BROADCAST SIGNED DEVNET UPGRADE` button.
9. Wait for
   `UPGRADE FINALIZED // CORRECTED 7XZ PROGRAM IS LIVE ON DEVNET`.
10. Open the fresh feature rehearsal. Complete the seven initialization stages,
    then follow each `NEXT VERIFIED ACTION` in order. Every hardware signature
    remains separate from its broadcast.
11. Continue until the immediate feature path reports complete. Export both the
    initialization and feature evidence files.
12. FDF Guard must independently compare the exact artifact hash, program and
    ProgramData addresses, signer, mint configuration, vault destinations,
    Switchboard program, and every Explorer transaction result.

## Mainnet blockers that must stay visible

- The prior public ceremony time `2026-07-30T14:05:00Z` has passed. Publish one
  new exact UTC time only after corrected Devnet evidence and independent review
  exist.
- `7XZ...fzPH` currently has `0.51970258 SOL` on mainnet. The measured
  rent-exempt minima total `8.31841104 SOL`: `4.15866264 SOL` for ProgramData,
  `4.15860696 SOL` for the temporary deployment buffer, and `0.00114144 SOL`
  for the program account, before transaction fees. The current pre-fee
  shortfall is `7.79870846 SOL`; fund to at least `8.5 SOL` total before the
  ceremony.
- The independent sign-off must cover the corrected
  `634d9505...72c7772a7` artifact. Prior sign-off does not cover these new bytes
  or the custody-signer replacement.
- `internalagency.io` still publishes the incorrect A answer `72.66.3.26`.
  Replace it with the required Sites target `172.66.3.26`; retain
  `162.159.143.30`.
- Do not move the release packet, manifest, or publication payload out of
  `HOLD` until every gate above is complete and revalidated.
