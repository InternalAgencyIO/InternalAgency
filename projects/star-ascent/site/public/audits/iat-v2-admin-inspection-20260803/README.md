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

## Residual finding

`QA-ADMIN-001` remains **PARTIALLY_REMEDIATED_OPEN**. The feature-only Switchboard dependency chunk is 909,373 bytes and still produces browser-compatibility warnings for externalized Node `util` and `crypto` imports. The Trezor-only chunk is 169,595 bytes. Inspection mode proves those chunks are not loaded there; it does not prove the future signing/feature modes on independent hardware or remove their upstream dependency warnings.

## Source binding and limits

The implementation and non-signing browser proof are bound to commit `bb79f564850f3a1a032aaa8bb1625e398089fdb3`, Git tree `f621ab17724a70d8fbc8366f8432691289bc5a7b`. All measurements are local build/runtime evidence. No wallet, hardware device, secret, signing, simulation for signing, broadcast, deployment, funding, DNS change, or Devnet/Mainnet mutation occurred. Mainnet remains `UNSCHEDULED_HOLD`.
