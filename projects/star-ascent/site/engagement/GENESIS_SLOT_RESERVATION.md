# Genesis slot reservation gate

Status: retained Premium-only v1 HOLD gate. It remains fail-closed and must not
be presented as the owner-directed v2 Genesis implementation. V2 will retain
the first-1,000/100-IAT nominal cap while using separate atomic 10% and
conditional 90% records; no active migration or claim route exists yet.

The first 1,000 Genesis Gifts are allocated by one conditional insert inside the same D1 transactional batch that activates the verified binding, never by a browser counter or a read-then-write application counter.

1. Verify the wallet proof, wallet-bound host session, immutable country, signed/PKCE X state, immutable X user ID, and exact Premium/PremiumPlus tier.
2. In one D1 `batch()`, activate that exact binding first and clear both nonce hashes. The activation must affect exactly one pending row.
3. Then insert `COALESCE(MAX(slot_number), 0) + 1` only while the authoritative table has fewer than 1,000 rows and the activated node, wallet, immutable X ID, and activation timestamp still match. A zero-row activation therefore cannot commit an orphan slot, and any later uniqueness error aborts and rolls back the batch.
4. Return a Genesis-active result only when the insert reports one changed row. If capacity is full, the verified binding still becomes active without a gift slot and returns `active-genesis-capacity`.
5. Claims remain HOLD until the public Genesis evidence packet is verified and Premium is revalidated when its recorded observation is older than 24 hours.

The `genesis_slots` table is the authoritative cap. Its primary-key check rejects slot 1,001, its amount check fixes every gift at 100 IAT base units, and its unique binding index prevents double reservation. A UI counter, clock order, social post, wallet connection, pending binding, OAuth error, replay, or non-Premium identity never reserves a slot.
