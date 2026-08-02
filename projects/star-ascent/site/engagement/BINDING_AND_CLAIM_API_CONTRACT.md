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
   - Return no internal node ID. Set a signed 15-minute `Secure`, `HttpOnly`, `SameSite=Lax`, host-only session cookie whose nonce is stored only as a hash.
3. `POST /api/nodes/select-country`
   - Require the wallet-bound session. Accept only a two-letter country code and make the first valid choice immutable.
4. `GET /api/x/authorize`
   - Require the wallet-bound session. Start X OAuth 2.0 PKCE and persist a hash of the signed state's one-time nonce.
5. `GET /api/x/callback`
   - Require the same wallet-bound session, validate signed state and the stored nonce, exchange with five-second deadlines, and request the authenticated immutable X user ID plus `created_at` and `subscription_type`.
   - Accept only `Premium` and `PremiumPlus`, and require at least 40 full days of account age; fail closed on missing, `None`, `Basic`, unknown, invalid, or too-new values. Record the creation timestamp, tier, and a 24-hour revalidation deadline, then discard the access token.
6. Atomic node activation transaction
   - Check `x_user_id` and `wallet_address` are not already active.
   - In one D1 `batch()` transaction, first activate the exact binding while consuming both nonce hashes, then reserve the next integer slot only while fewer than 1,000 rows exist and the just-activated identity/timestamp still match.
   - If full, mark the verified binding active without a slot and return `active-genesis-capacity`.
   - A duplicate, expired, replayed, or failed activation inserts no slot. Activation-first ordering prevents a zero-row activation from committing an orphan reservation; any later SQL failure aborts the whole batch.

## Epoch flow

At 00:00 UTC, the scheduler opens a transaction that creates one `reward_epochs` row for the closed UTC day. The collector records only public qualifying post IDs, then the scorer writes no more than one eligible claim per active node. The manifest generator reads a frozen epoch, writes the root and digest, and flips it from `collecting` to `published` at 00:05 UTC.

## Claim flow

`POST /api/claims/prepare`

- Require a fresh wallet signature tied to the existing bound wallet.
- Return only that wallet's epoch, amount, leaf, Merkle proof, root, and policy digest.
- Do not accept an arbitrary destination wallet.
- An offline tool may build only a bounded unsigned batch whose destinations exactly match eligible bound wallets. The owner reviews and signs each batch physically on the sole Trezor Model T; there is no server, hot, or second signing key. Record a finalized transaction before marking any included claim `claimed`.

## Hard stops

- Any duplicate X account or wallet binding: HOLD the request.
- Any missing/unknown X tier, X account younger than 40 full days, or stale Premium observation: HOLD the request or epoch.
- Any epoch root/manifest mismatch: HOLD the full epoch.
- Any source balance, mint, token program, batch total, or destination mismatch: HOLD the batch.
- Any unverified Genesis record: do not create Genesis slots or publish claim routes.

No request, log, table, manifest, or error message may contain a recovery phrase, private key, PIN, passphrase, OAuth client secret, bearer token, or signing key.
