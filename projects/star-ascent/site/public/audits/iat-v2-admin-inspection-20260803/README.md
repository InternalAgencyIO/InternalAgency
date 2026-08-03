# DRAFT IAT V2 admin inspection-runtime audit

**DRAFT / PARTIAL REMEDIATION / QA HOLD / NON-SIGNING INSPECTION / MAINNET HOLD / NOT DEPLOYED / NO LAUNCH AUTHORITY**

This source-bound package evaluates the local IAT V2 admin console without connecting a wallet, loading Trezor Connect, reading RPC state, simulating, signing, or broadcasting. It does not replace the attended ceremony or a fresh source-bound Devnet rehearsal.

## Result

- Added an explicit `?mode=inspect` runtime that disables RPC refresh, hardware loading, simulation, signing, and broadcast.
- The built inspection page returned HTTP 200 on an isolated ephemeral loopback origin with zero external requests, zero page errors, and zero console errors.
- Trezor Connect remained `unloaded`; hardware, feature-rehearsal, and upgrade-only chunks were not requested.
- Every rendered refresh, connection, simulation, and broadcast control was disabled.
- Removed the Google Fonts request and retained local system/monospace stacks for offline inspection.
- Split feature rehearsal, program upgrade, and Trezor dependencies behind dynamic imports. The initial JavaScript chunk fell from 2,148,150 bytes to 1,063,820 bytes, a 50.48% reduction.
- Replaced the feature-only bundle's externalized Node `crypto` and `util` imports with narrow browser compatibility modules. SHA-256 delegates to directly pinned `@noble/hashes@1.8.0`; no cryptographic primitive was implemented locally.
- Four deterministic compatibility tests match Node SHA-256 across text, binary, and chunked inputs, verify the `inspect.custom` symbol, and fail closed for unsupported algorithms, encodings, input types, or hash reuse.
- The rebuilt feature chunk emits no externalized Node-import warnings. The only build warning is the tracked lazy chunk size warning.
- A fail-closed post-build regression gate now enforces explicit byte budgets for the entry, feature, Trezor, and upgrade chunks; rejects Node-externalization markers; verifies that SHA-256 compatibility remains feature-only; and runs in every IAT V2 admin inspection gate.

## Residual finding

`QA-ADMIN-001` remains **PARTIALLY_REMEDIATED_OPEN**. The externalized Node-import warnings are removed, but the feature-only Switchboard dependency chunk remains 915,400 bytes and the Trezor-only chunk remains 169,595 bytes. Inspection mode proves those chunks are not loaded there; it does not prove the future signing/feature modes on independent hardware. Bundle-size reduction and independent hardware/runtime review remain open.

## Source binding and limits

The implementation and non-signing browser proof are bound to commit `ed8bf69274b9f7d17f223f39e7f49fd2c6a6d7e5`, Git tree `d13df9da20dd25a21e49f59eaa4ae1c94d79aec4`. All measurements are local build/runtime evidence. No wallet, hardware device, secret, signing, simulation for signing, broadcast, deployment, funding, DNS change, or Devnet/Mainnet mutation occurred. Mainnet remains `UNSCHEDULED_HOLD`.
