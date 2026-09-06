# IAT V2 durable attended-action boundary successor

**DRAFT / PARTIAL REMEDIATION / QA HOLD / NON-SIGNING / MAINNET UNSCHEDULED_HOLD**

This dated successor retains the explicit operator-activation boundary and adds the durable signed-pending and permanent broadcast-attempt modules to the reviewed attended-actions closure. The read-only Program Upgrade shell remains separate from the attended transaction surface.

The successor raises only the two ceilings affected by the fail-closed durability controls: the attended-actions entry is capped at 40,000 bytes and the complete Program Upgrade incremental closure at 72,000 bytes. These remain narrow regression ceilings, not operational authorization.

The reviewed local build measured the current attended-actions entry at 39,109 bytes and the complete Program Upgrade incremental closure at 71,551 bytes. The regression also verifies both durable module source edges and their emitted v2 schema markers.

The immutable predecessor is [`../iat-v2-admin-lazy-boundary-20260826/policy.json`](../iat-v2-admin-lazy-boundary-20260826/policy.json), whose exact SHA-256 is bound in [`policy.json`](./policy.json). All assurance flags remain false, and hardware, wallet, RPC, simulation, signing, broadcast, deployment, Devnet, and Mainnet actions remain outside this policy.
