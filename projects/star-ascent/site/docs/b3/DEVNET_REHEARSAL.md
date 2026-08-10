# B3 Daily Law public Devnet rehearsal

Status: **REVIEW GATE — DO NOT TREAT AS A RELEASE AUTHORIZATION**

This rehearsal publishes the optimized B3 Daily Law artifact and a deliberately
disposable Token-2022 mint to Solana Devnet. It is a one-way public experiment:
the program is made immutable before the law is initialized, every mint-side
authority is removed, and all generated signer files are destroyed at exit.

The rehearsal proves the law adapter on a public validator network. It does
**not** prove retained V2 feature parity, optional shielded-transfer behavior,
the website or localization estate, production operations, economic safety, or
Mainnet readiness.

## Deliberate execution gate

The wrapper is inert unless its only argument is one of the two exact opt-in
flags:

```bash
bash scripts/run-iat-b3-devnet-rehearsal.sh --execute

IAT_B3_V2_DEVNET_PAYER_KEYPAIR=/absolute/path/to/iat-v2-devnet-deployer.json \
  bash scripts/run-iat-b3-devnet-rehearsal.sh --execute-reuse-v2-devnet-payer
```

Run that command only from `projects/star-ascent/site`, after reviewing the
wrapper, driver, optimized artifact hash, and this document. Omitting
`--execute`, misspelling it, or supplying another argument must stop before the
first public write. There is no dry-run mode that silently becomes a deploy.

The wrapper and driver hard-pin this one endpoint:

```text
https://api.devnet.solana.com
```

They do not read a cluster URL from Solana configuration, command-line input,
or an environment variable. The wrapper verifies the returned Genesis hash is
Devnet's expected hash before the first public write, and the driver verifies it
again before its first transaction. A failed Devnet RPC or faucet request is a
failure; it never falls back to another cluster.

The reviewed Devnet Genesis hash is pinned as
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Devnet may be reset; a future
Genesis change must stop this script and require a reviewed pin update, never a
dynamic acceptance rule.

The preflight also requires Node.js 22 or newer and imports the driver with its
Solana dependencies before requesting an airdrop. This prevents an unsupported
local runtime from failing only after immutable public artifacts already exist.

The second mode is a bounded recovery path for public-RPC faucet rate limits.
It accepts only the already-published V2 Devnet deployer
`DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4`, requires its key path
explicitly, and checks at least 3 Devnet SOL before its first write. It cannot
select the 7XZ hardware owner, any Mainnet balance, or a default signer.
Before either mode writes, the wrapper captures the selected payer's latest
finalized transaction signature. Final evidence queries only transactions newer
than that boundary, so a reused payer with a long V2 history cannot hide new
rehearsal transactions or overflow the bounded evidence query.

The program upload may retry at most twelve times against the same pinned
Devnet RPC, exact artifact, program identity, and deployment buffer. This
resumes a public-RPC-interrupted chunk upload without creating another buffer or
silently switching identities, bytes, cluster, or funding source. Exhausting the
bound remains a loud partial failure.

## Wallet and funding isolation

The wrapper creates a checked temporary directory beneath `target/` and always
generates new program, deployment-buffer, mint, and recipient keypairs inside
it. Faucet mode also generates a new payer. The rate-limit recovery mode uses
only the explicitly supplied, exact public V2 Devnet deployer key; it does not
reuse the V2 program or mint and cannot select the 7XZ owner. Every mutating
Solana and SPL Token command names its URL, fee payer, authority, owner, or
program identity explicitly. The default Solana signer, configured wallet,
Anchor wallet, and browser wallet are never selected.

Normal mode uses only Devnet faucet airdrops for the disposable payer. The
rate-limit recovery mode may reuse SOL already held by the exact file-backed V2
Devnet deployer, after an explicit opt-in and identity check. It never transfers
from an owner, never accepts another funding identity, and never substitutes
Mainnet SOL. Both modes stop before deployment unless the selected payer has at
least 3 Devnet SOL.

The temporary directory is resolved and checked against the narrow
`target/iat-b3-devnet-rehearsal.*` prefix before removal. Exit, failure,
interrupt, and termination all enter the same cleanup path. Cleanup removes
local secret material only; it cannot and does not roll back public ledger
state.

## Irreversible sequence

The wrapper and driver must complete these operations in this order and fail
loudly if an observed state is partial or different:

1. Verify the optimized `target/deploy/iat_b3_law.so` byte length and pinned
   SHA-256 digest before generating any public artifact.
2. Generate the isolated program/mint identities. Fund a disposable payer only
   through Devnet faucet airdrops, or explicitly reuse the exact V2 Devnet
   deployer after its finalized balance and public identity pass the recovery
   gate.
3. Deploy those exact `.so` bytes through RPC under the disposable program
   identity and disposable payer upgrade authority. No existing program ID or
   upgradeable V2 program is reused.
4. Irrevocably finalize the program upgrade authority with
   `solana program set-upgrade-authority --final`, then inspect the Upgradeable
   Loader program-data account and require its authority option to be absent.
   This verification happens before `initialize_law` is allowed to run. The
   driver also hashes the deployed program-data bytes and requires an exact
   match with the pinned optimized artifact.
5. Create a nine-decimal Token-2022 mint with the Confidential Transfer mint
   extension, Transfer Hook extension bound to the immutable law program, and
   a temporary freeze authority. Create disposable source and recipient token
   accounts, and mint exactly the rehearsal supply.
6. Disable the freeze authority and mint authority. The driver independently
   verifies both fields are null, verifies the extension set and total supply,
   and checks that the hook still names the immutable law program.
7. Initialize the mint-bound law and validation PDAs while the disposable payer
   is the temporary authority for both required extensions. The same
   `initialize_law` instruction must revoke both authorities through Token-2022
   CPI, reload the mint, prove both are null, and preserve the law hook program,
   auto-approval, and null auditor configuration before committing either PDA.
   Any remaining authority or separate later revocation is a hard failure.
8. Exercise the real hooked-transfer missing-day rejection and the direct-hook
   bypass rejection, then re-read the sealed mint.
9. Finalize the current protocol day using only Solana `Clock` and `SlotHashes`,
   recompute and verify the selected lagged slot hash and draw, reject a
   same-day reroll, then exercise a real hooked transfer. It must move exactly
   one base unit when open or land the expected lockdown error without changing
   balances when locked.
10. Re-read every authority and binding before reporting success. A successful
    transaction is not sufficient evidence when the resulting state is wrong.

The program cannot be repaired after step 4. That is intentional for the
rehearsal: an implementation defect creates an abandoned immutable Devnet
artifact, not a reason to retain an upgrade key.

## Public evidence

The successful driver emits sanitized JSON under the
`iat-b3-devnet-rehearsal/v1` schema. It records:

- the pinned network, RPC identity, Devnet Genesis hash, artifact byte length,
  and SHA-256 digest;
- public program, program-data, mint, payer, recipient, token-account, law-state,
  and validation-PDA addresses with Devnet Explorer links;
- every transaction signature exposed by the CLI or driver, its observed slot,
  fee, compute units when RPC metadata exposes them, success or expected custom
  error, and a Devnet Explorer link;
- the complete bounded transaction history of the fresh disposable payer,
  which captures deployment buffer writes even when the CLI summary omits
  their signatures, with null fee/compute fields only when RPC omits metadata.
  History lookups are deliberately batched and paced for the official public
  RPC rate limit;
- the finalized protocol day, entropy slot, draw bucket, chance numerator,
  lockdown result, transfer outcome, and balance delta; and
- independent postconditions showing that program upgrade authority and every
  mint-side authority are absent.

No keypair bytes, seed material, filesystem paths, environment values, command
lines containing local paths, or raw temporary logs belong in emitted evidence.
Some Solana CLI responses do not expose every internal deployment signature;
the evidence labels that absence instead of inventing measurements. Every
signature that is exposed must resolve through the pinned RPC, and fee/compute
fields may be null only when the RPC transaction metadata omits them.

The wrapper emits a sanitized failure record with its last phase, whether a
public write started, and whether permanent or partial artifacts may remain.
It then removes local secrets. A public write followed by failure is never
reported as `SKIP`, never reported as a clean rollback, and never retried on a
different cluster.

## Expected permanent Devnet artifacts

A successful run intentionally leaves all of the following visible forever in
Devnet history:

- the immutable program and its program-data account;
- the Token-2022 mint with fixed supply, law Transfer Hook, Confidential
  Transfer extension, and no surviving authority;
- the law-state and extra-account-meta validation PDAs;
- the disposable payer and recipient public identities and their ledger
  history;
- the source and recipient Token-2022 accounts and the rehearsal token supply;
  and
- every successful and deliberately rejected rehearsal transaction.

Because their signer files are deleted, the disposable payer, recipient, token
accounts, and supply may become unusable after the run. A temporary deployment
buffer should be closed by a successful Solana deployment, but a failed or
interrupted deployment can leave a partial buffer or other public accounts.
Those are expected public-test artifacts, not the production IAT mint and not
an upgrade path.

## What a pass proves—and what it does not

A pass proves that the reviewed law-only artifact can be deployed immutably on
Devnet; that a correctly shaped Token-2022 mint can bind to it with no retained
authority; that Solana validator sysvars drive the daily result without an
oracle; that real Token-2022 hook traffic fails closed before finalization and
obeys the open/locked result afterward; and that the RPC exposes useful public
fee, slot, signature, and compute evidence.

A pass does not prove:

- that every V2 instruction and user-facing feature has been retained in B3;
- that non-token economic state changes all invoke the shared law kernel;
- that optional native shielded transfers are implemented, private, cheap, or
  compatible with the law;
- that the finalization incentive and delayed-caller influence are resolved;
- that congestion, skipped slots, forks, rollback, wallet support, indexers,
  exchanges, or operational monitoring are production-ready;
- that 50 localizations or public website copy and media are release-ready; or
- that Mainnet deployment, a production mint ceremony, security review, or
  launch is authorized.

Those remain separate release gates. This Devnet run must never be presented as
retained V2 parity or Mainnet rehearsal completion.

## Offline review gate

Before anyone supplies `--execute`, run the offline regression probe:

```bash
node --test tests/iat-b3-devnet-rehearsal-safety.test.mjs
```

Reviewers should then confirm the artifact hash against the previously accepted
local-validator evidence, inspect both Devnet scripts, and decide whether the
permanent public artifacts are acceptable. The command that performs the first
public write remains exactly:

```bash
bash scripts/run-iat-b3-devnet-rehearsal.sh --execute
```
