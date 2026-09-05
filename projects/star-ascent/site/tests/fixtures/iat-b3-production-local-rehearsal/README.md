# IAT B3 production local-rehearsal fixtures

`expected-dispositions.v1.json` is the only committed production rehearsal
fixture. It records expected results, not execution evidence.

Final law/economy ELF files, their final Docker dual-build receipts, a READY
production identity packet, disposable signer files, and a validator ledger
are intentionally absent. They must be supplied outside the repository and
pass the preflight byte, receipt, identity, path, and no-symlink checks. Until
then, all execution, Devnet, rollback, release, and Mainnet claims remain HOLD.
