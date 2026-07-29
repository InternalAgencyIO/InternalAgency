# Genesis slot reservation gate

The first 1,000 Genesis Gifts must be allocated by one database statement against a pre-seeded slot pool, never by a browser counter or a read-then-write maximum calculation.

1. Pre-create slot rows `1` through `1000`.
2. After a wallet proof and X identity binding are both active, atomically update one row whose `node_binding_id` is null.
3. Return the slot number only after that update reports one changed row.
4. If no row changes, return `GENESIS_CAPACITY_REACHED`; the verified node remains active but has no Genesis Gift slot.
5. Claims remain HOLD until the public Genesis evidence packet is verified.

The slot pool is the authoritative cap. A UI counter, clock order, social post, wallet connection, or pending binding never reserves a slot.
