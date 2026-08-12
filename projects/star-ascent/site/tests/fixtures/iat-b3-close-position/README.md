# B3 close-position loopback rehearsal

This disposable crate imports and invokes
`execute_runtime_production_close_position_account_infos` from the production
`iat_b3_economy` source. It proves only that the current feature-gated handler
can execute against synthetic OPEN Daily Law and production-shaped ACTIVE
Config fixtures on a loopback `solana-test-validator`, and that a synthetic
wrapper failure after handler success rolls all four state writes back.

The crate is not a member of the production workspace. Its program identity,
Law state, Config, caller, Position, Lane accounts, instruction entrypoint, and
error mapping are synthetic rehearsal infrastructure. It proves no production dispatcher, production
entrypoint ABI, production identities, final binary, public Devnet execution,
deployment, activation, or Mainnet authorization. It performs no token CPI,
signing ceremony, broadcast, or public-network write. Mainnet remains **HOLD**.

`scripts/run-iat-b3-close-position-local.sh` creates all key material and the
validator ledger under a disposable directory, binds the validator to
`127.0.0.1`, stops it, removes every generated key and ledger, and emits the
review evidence only after cleanup succeeds.
