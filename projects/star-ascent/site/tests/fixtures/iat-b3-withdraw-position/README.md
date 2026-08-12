# Disposable WithdrawPositionPrincipal loopback fixture

This nested Cargo workspace exercises the real feature-gated production-source
`execute_runtime_production_withdraw_position_account_infos` seam on a disposable
loopback validator. It is not a member of the production workspace.

The synthetic Law hook owns the exact Daily-Law account and one-meta Transfer-Hook
validation TLV. The economy wrapper seeds an ACTIVE Config and mature Position,
then passes the exact twelve-account withdrawal graph to the real executor. A
fixture-only setup path funds the canonical stake vault; it is not production
stake-ingress evidence.

The matrix proves law-first rejection before malformed instruction decoding,
hook-CPI rollback, post-executor transaction rollback, and exact success bytes for
the stake/destination token accounts plus Config/Position CAS. Wrapper selectors,
program IDs, error mapping, setup bypasses, binaries, and identities are fixture
only. This does not prove a production dispatcher, entrypoint, ProgramError ABI,
reproducible or final combined binary, public Devnet, all fifteen handlers, or
Mainnet authorization. Mainnet remains **HOLD**.

The runner uses loopback RPC only and removes its validator ledger and generated
key material. Build outputs live under the ignored fixture target directory.
