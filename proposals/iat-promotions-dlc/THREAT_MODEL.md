# Promotions DLC threat model

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

## Assets to protect

- the dedicated maximum budget of 180,000 IAT;
- the invariant that every completed pair pays exactly 120/60 IAT;
- the 1,000-pair permanent capacity limit;
- node, wallet, and X identity uniqueness for each reward role;
- the independence of the hero's node and wallet binding;
- verifier signing keys and X OAuth credentials;
- campaign, artifact, and policy hashes;
- user OAuth tokens and identity-mapping data; and
- public evidence integrity.

## Adversaries

- a user operating several X accounts or wallets;
- a bot registering typo or celebrity handles at scale;
- a proposer attempting to nominate themself through alternate bindings;
- a relayer replaying or reordering valid attestations;
- an observer front-running a pending nomination or settlement;
- a compromised identity-verifier service;
- a compromised program upgrade authority;
- an operator attempting to change economic terms after activation;
- a malicious RPC returning stale or fabricated reads; and
- an accidental operator using Devnet, the wrong mint, or the wrong campaign.

## Security properties

1. No instruction can transfer more than the fixed paired amount.
2. A transfer cannot commit without both role receipts and a counter increment.
3. A counter increment cannot commit without both transfers.
4. A role receipt is unique by node, wallet, and X commitment.
5. Completed pairs never exceed 1,000.
6. Pending state never reduces completed-pair capacity.
7. The hero identity used at settlement equals the nominated identity.
8. The proposer cannot supply the hero's wallet binding.
9. Campaign configuration is immutable after activation.
10. No active-campaign withdrawal path exists.
11. Wrong network, mint, token program, Genesis config, or PDA is rejected.
12. Every accepted attestation is purpose-bound, campaign-bound, expiring, and
    single-use.

## Threats and controls

| Threat | Consequence | Required control | Residual risk |
| --- | --- | --- | --- |
| Same identity claims twice | Capacity theft | Role markers for node, wallet, and X commitment | A person with multiple legitimate X accounts is not detectable as one human |
| Handle rename | Duplicate or wrong hero | Resolve and bind stable X user ID; handle is display-only | X platform identity errors |
| Fake/nonexistent handle | State spam | Resolve before on-chain nomination; invalid input stays off-chain | API outage or stale X data |
| Celebrity-handle squatting | Proposer bonus capture | One active reservation, verified proposer, cancellable nomination, public first-seen record | First valid proposer still wins |
| Self-proposal through same wallet | Unearned pair | Reject any proposer/hero node, wallet, or X match | Separate controlled identities remain possible |
| Attestation replay | Duplicate settlement | Campaign/purpose/expiry/nonce binding plus PDA markers | Verifier compromise |
| Front-running | Reward redirection | Destinations are in signed attestation and nomination state, never transaction sender input | Public timing remains observable |
| Partial payment | One side paid | One Solana transaction; markers/counter written with both token CPIs | Token-program defect |
| Cap race at pair 1,000 | 1,001st payment | Writable campaign counter serializes settlement; post-increment cap check | Temporary transaction contention |
| Wrong mint/vault | Loss or counterfeit payment | Immutable mint and token program; derive vault authority PDA; verify token account fields | Initialization review failure |
| Vault underfunding | Stuck valid claims | Full funding before activation; committed-balance invariant and public monitoring | Accidental external token movement if authority model is wrong |
| Vault overfunding | Stranded funds or misleading UI | Separate committed and surplus balances; permissionless excess return only after exhaustion | Surplus remains locked until exhaustion |
| Operator withdrawal | Broken promise | No withdrawal once active; pre-activation refund only | Upgrade authority could replace code unless frozen/timelocked |
| Malicious upgrade | Rules changed after activation | Revoke authority or enforce public timelock with independent review | Governance/key compromise under selected model |
| Compromised verifier | Fake identities within cap | HSM/managed key, short attestations, transparency log, rate limits, incident process, optional threshold signer | On-chain program cannot independently query X |
| OAuth token theft | Account takeover/privacy loss | Server-only encrypted tokens, minimal scopes, short retention, rotation and revocation | X/application compromise |
| Identity commitment enumeration | Doxxing | Keyed HMAC commitment, not raw hash of numeric ID | Verifier and auditor can map identities |
| RPC lies or stale reads | Bad UX or duplicate submissions | Confirm state through multiple RPCs; program is final authority; idempotent retries | Temporary availability loss |
| Clock manipulation | Early activation | Solana Clock plus verified Genesis config and explicit activation | Small normal cluster clock variance |
| Devnet/mainnet confusion | Wrong deployment claim | Compile-time and runtime cluster/mint/config binding; evidence labels | Human publication error |
| Secret committed publicly | Credential loss | Proposal-only secret scan, protected CI, managed secret store | Novel secret formats may evade scanners |

## Abuse controls that do not alter economics

- one active nomination per proposer;
- one active reservation per hero identity;
- proposer-funded or relayer-sponsored account rent with documented refunds;
- verifier rate limits per node, wallet, X identity, IP risk signal, and time
  window, without treating IP as identity;
- challenge nonces with short expiry and exact domain separation;
- no reward for nominations that never settle;
- no off-chain counter that can override the on-chain completed-pair counter;
- public anomaly totals and incident notices; and
- manual review may reject unverifiable input before an attestation is issued,
  but cannot change an on-chain reward amount or completed receipt.

## Privacy and data minimization

Never publish OAuth access/refresh tokens, email, IP address, device fingerprint,
raw X numeric ID, signature challenge secrets, or the identity-commitment pepper.
Store only what is required for replay prevention, audit, and legal retention.
Publish wallet addresses because transfers are public, and publish X handles
only with explicit user-facing disclosure that the handle will be public.

## Incident posture

Before activation, any unresolved critical finding leaves the campaign
inactive. After activation, the response depends on the published upgrade
model. No private hotfix, hidden allowlist, silent identity-domain reset, or
unpublished balance correction is acceptable. Every correction must identify
the affected source commit, artifact hash, transaction range, invariant, and
reviewer.

## Security-review exit criteria

- all twelve security properties have executable tests;
- the full 1,000-pair path is rehearsed on Devnet;
- mutation and property tests cannot create an unpaired receipt or 1,001st pair;
- attestation replay and identity-domain rotation tests pass;
- artifact and policy hashes reproduce independently;
- no critical or high finding remains open;
- the selected upgrade-authority model is proven on-chain; and
- the public evidence package matches chain state through an independent RPC.
