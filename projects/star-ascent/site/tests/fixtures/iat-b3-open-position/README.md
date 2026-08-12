# Disposable OpenPosition loopback fixture

This nested Cargo workspace exercises the real feature-gated production-source
`execute_runtime_production_open_position_account_infos` seam on a disposable
loopback validator. It is not a member of the production workspace.

The `law-hook` program owns the exact Daily-Law account and one-meta
Transfer-Hook validation TLV. The `economy` wrapper seeds production-shaped
Config, Eligibility, and lane bytes from retained kernels, creates the
canonical stake-token PDA, and passes the exact 17- or 18-account graph to the
real executor. Wrapper selectors and error mapping are fixture-only.

The matrix proves local transaction rollback around hook failure, Position
lifecycle failure, and a failure injected only after the real executor returns
success. It does not prove a production dispatcher, production entrypoint,
production ProgramError ABI, production compute budget, production identities,
activation ceremony, final combined binary, adversarial Devnet, or Mainnet
authorization. All of those remain false and the Mainnet hold remains active.

Both program IDs are conspicuous fixture constants. Neither binary, program
ID, source file, seeded state, nor local mint is a deployment candidate. The
runner uses loopback RPC only and removes its validator ledger and generated
key material. Build outputs live under the ignored fixture target directory.
