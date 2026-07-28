# Node binding and claim API contract

This contract is a production blueprint. It does not authorize a hosted endpoint, accept secrets, or transfer tokens by itself.

## Binding flow

1. `POST /api/nodes/challenge`
   - Input: public Solana wallet address.
   - Output: short-lived nonce and exact human-readable message.
   - Store only a hash of the nonce/message; expire it in five minutes.
2. `POST /api/nodes/verify-wallet`
   - Input: wallet address, signed message, nonce id.
   - Verify the Ed25519 signature server-side with `engagement/solana-wallet-proof.mjs`. Create or update a `pending` node binding only after signature validation.
3. `GET /api/x/authorize`
   - Start X OAuth 2.0 PKCE, bound to the pending node id in a signed, short-lived state value.
4. `GET /api/x/callback`
   - Validate state, exchange the authorization code, read the X user identity, then discard access tokens unless a narrowly-scoped refresh flow is explicitly approved.
5. Atomic node activation transaction
   - Check `x_user_id` and `wallet_address` are not already active.
   - Count `genesis_slots` where slot number is 1–1000.
   - If fewer than 1,000 slots exist, insert the next slot and mark the binding `active` in the same database transaction.
   - If full, keep the binding active without a Genesis slot and return `GENESIS_CAPACITY_REACHED`.

## Epoch flow

At 00:00 UTC, the scheduler opens a transaction that creates one `reward_epochs` row for the closed UTC day. The collector records only public qualifying post IDs, then the scorer writes no more than one eligible claim per active node. The manifest generator reads a frozen epoch, writes the root and digest, and flips it from `collecting` to `published` at 00:05 UTC.

## Claim flow

`POST /api/claims/prepare`

- Require a fresh wallet signature tied to the existing bound wallet.
- Return only that wallet’s epoch, amount, leaf, Merkle proof, root, and policy digest.
- Do not accept an arbitrary destination wallet.
- The distributor service submits only an idempotent transfer for a claim whose state is still `eligible`; record the resulting transaction before marking `claimed`.

## Hard stops

- Any duplicate X account or wallet binding: HOLD the request.
- Any epoch root/manifest mismatch: HOLD the full epoch.
- Any distributor balance, mint, token program, or destination mismatch: HOLD the claim.
- Any unverified Genesis record: do not create Genesis slots or publish claim routes.

No request, log, table, manifest, or error message may contain a recovery phrase, private key, PIN, passphrase, OAuth client secret, bearer token, or distributor key.
