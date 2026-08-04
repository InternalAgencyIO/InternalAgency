# Sole-Trezor authority risk record

> **DRAFT - MAINNET HOLD - OWNER-DIRECTED EXCEPTION - NOT A SECURITY CLEARANCE**

## Direction

The owner directed that every IAT V2 chain authority remain on the sole Trezor
Model T. This hardening increment therefore adds no multisig, second hardware
authority, hot key, server key, alternate authority address, or automatic
signing path.

## Accepted risk

This topology concentrates administrative, upgrade, custody, recovery, and
operator risk. Hardware isolation can protect the private key from ordinary
host exposure, but one device/seed/operator boundary is not role separation.
Compromise, coercion, loss, recovery failure, or review error can affect all
correlated powers.

The public finding remains `IAT-REM-001`, severity CRITICAL, status
`OPEN_OWNER_ACCEPTED`. That status means the requested architecture is
intentional. It does not mean the risk is fixed, independently approved, or
safe to omit from launch decisions.

## Mandatory containment

- No server-side, unattended, hot-key, or automatic signing.
- No transaction simulation for signing, signature, or broadcast without a
  separately attended and explicitly approved ceremony.
- Exact source, build, account, instruction, amount, recipient, fee-payer, and
  network review on the Model T display wherever the device can show them.
- Fresh independent comparison of source, reproducible binary, Devnet receipts,
  and intended Mainnet accounts before any authorization.
- Mainnet remains HOLD while any other launch blocker is open.

No wallet or Model T was accessed and no key, signature, transaction, funding,
deployment, DNS change, Devnet mutation, or Mainnet mutation occurred while
creating this record.
