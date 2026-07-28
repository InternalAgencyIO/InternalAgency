# STAR ASCENT — Daily X Participation Rewards

## Decision

Use a **daily Merkle-proof claim system**, not automatic blind transfers.

At Genesis, every participant with one verified X account bound to one public Solana wallet may claim **100 IAT**. From then on, a deterministic daily process runs on the UTC clock:

1. **00:00 UTC** — close the prior UTC epoch and collect qualifying X activity.
2. **00:05 UTC** — publish an epoch manifest and Merkle root; claims open.
3. **Claim window** — the participant connects only their already-bound wallet and claims the proof assigned to that wallet.
4. **30 days after the epoch** — the claim expires under the public policy; it is never silently reallocated.

The initial 100 IAT and each daily reward are participation rewards, not yield, APY, interest, a price promise, or an investment return.

## Why claim instead of automatic wallet pushes

- An X profile does not safely reveal a wallet. OAuth binding plus a wallet-signature challenge establishes the destination first.
- A claim proof assigns an exact amount to one public wallet and lets anyone audit the epoch total before transfer.
- A dedicated, capped distributor wallet can serve claims without exposing the treasury or relying on the signer device every day.
- Direct pushes require a continuously funded hot wallet and create avoidable wrong-address, token-account, and operational-replay risk.

## Qualifying action for the launch version

One qualifying action per closed UTC day:

- one original X post or reply matching the published daily prompt and canonical campaign tag;
- authored by the linked X account; and
- returned by the official X API collection query inside the epoch window.

Do not reward likes or reposts alone in the launch version. They are difficult to evaluate fairly at scale and are easy to automate. The launch cap is **12 IAT per epoch**.

## Required live components

| Component | What it does | Launch gate |
| --- | --- | --- |
| X developer app | OAuth account binding and official API collection | Approved app, OAuth callback, scoped credentials |
| Binding service | Binds one X account to one wallet after a wallet-signature challenge | Database and rate limits |
| UTC scheduler | Starts the closed-day snapshot at 00:00 UTC | Durable scheduler with alerting |
| Scorer | Applies the public action rule and produces eligible wallet rows | Reproducible logs and duplicate checks |
| Merkle publisher | Produces manifest, root, proofs, and policy digest | Public immutable epoch artifact |
| Claim API | Serves one wallet’s proof and checks binding / expiry | Abuse limits and audit logs |
| Distributor | Sends a claim from a limited operational wallet | Dedicated hot wallet; treasury never in web runtime |

## Human-only inputs needed before this can go live

1. Exact official X handle and the canonical campaign tag.
2. Approved X developer Project/App with OAuth callback URL and API access. Do not send client secrets or bearer tokens in chat; set them only in the deployment secret manager.
3. The hostname for the binding callback, e.g. `internalagency.io/api/x/callback`.
4. A dedicated distributor wallet public address and an operating cap. It must not be the Trezor-held treasury.
5. Final approval of the 12 IAT daily cap and 30-day claim expiry.

## Launch sequence

1. Publish the policy JSON and its digest while status is HOLD.
2. Verify the token mint and authorities independently; only then set the mint address in the reward configuration.
3. Complete a devnet rehearsal: OAuth link, wallet bind, snapshot, proof generation, proof verification, claim transfer, and an Explorer check.
4. Fund only the dedicated distributor operational cap after the rehearsal passes.
5. Announce the Genesis 100 IAT claim only when the Proof Board links the actual mint and distributor evidence.
6. Start the first interaction epoch at the next 00:00 UTC boundary after the system passes all gates.

## Public epoch manifest fields

`epochStartUtc`, `epochEndUtc`, `policyHash`, `mint`, `eligibleWalletCount`, `totalClaimableBaseUnits`, `merkleRoot`, `manifestDigest`, `publishedAtUtc`, `distributionStatus`.

No user’s OAuth token, email, private key, recovery phrase, PIN, or passphrase belongs in an epoch artifact.
