# IAT V2 admin lazy-boundary hardening

**DRAFT / PARTIAL REMEDIATION / QA HOLD / NON-SIGNING / MAINNET UNSCHEDULED_HOLD**

This increment moves the Switchboard SDK behind a second dynamic import inside the already-lazy feature rehearsal. Opening the admin console or its feature shell therefore does not statically load the oracle SDK. Trezor Connect, the feature shell, the program-upgrade panel, and Switchboard remain independently identifiable lazy entries in the generated Vite manifest.

The fail-closed bundle regression resolves entries from that manifest instead of trusting hashed filenames. It rejects an eager dependency edge from the inspection entry to any operator-only surface, rejects an eager feature-shell edge to Switchboard, applies separate byte budgets, and verifies that browser compatibility shims do not leak into the initial entry. The three-engine inspection runtime additionally rejects any request for every generated lazy asset.

The measured entry remained 1,036,846 bytes. The feature shell fell from the 912,348-byte parent baseline to 28,115 bytes, a 96.92% reduction in the feature-mode startup surface. The separately deferred Switchboard action payload is 976,707 bytes, Trezor Connect is 169,595 bytes, and program upgrade is 10,997 bytes. This is not a claim that total oracle-action bytes fell: the Switchboard payload is larger than the former combined feature chunk and retains the tracked over-500-kB warning. The improvement is that the oracle SDK no longer loads merely because the feature shell opens.

This is local build and headless browser evidence on one Windows host. It is not independent hardware/runtime review and does not exercise feature mode, Trezor, RPC, simulation, signing, or broadcast. `QA-ADMIN-001` remains partially remediated and open; the source-controlled policy is in [`policy.json`](./policy.json). No deployment or chain state was changed.
