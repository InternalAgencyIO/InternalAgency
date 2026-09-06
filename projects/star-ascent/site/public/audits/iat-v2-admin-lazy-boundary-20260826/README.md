# IAT V2 attended-action boundary hardening

**DRAFT / PARTIAL REMEDIATION / QA HOLD / NON-SIGNING / MAINNET UNSCHEDULED_HOLD**

This successor increment preserves the 15,000-byte Program Upgrade shell ceiling and moves transaction construction, simulation, hardware-signing, broadcast, and local receipt controls behind a second dynamic boundary. The boundary is not requested until the operator presses **LOAD ATTENDED ACTIONS + RECEIPTS**. Merely opening the Program Upgrade route continues to load only the read-only inspection shell.

The source-controlled regression resolves both entries from the generated Vite manifest. It requires one exact shell-to-attended dynamic edge, rejects an eager initial-entry or shell-static edge, verifies the explicit user-activation source path, caps the shell and attended entry separately, and caps their complete incremental static closure so shared chunks cannot hide growth.

The reviewed local Node 24.19.0 build after the final source split measured a 12,919-byte read-only shell, an 8,808-byte attended-actions entry, and a 30,021-byte aggregate incremental closure including the 8,294-byte attended-evidence chunk. Vite inlined the isolated capacity-extension builder into the attended-actions entry; the regression therefore verifies the exact source edge and emitted marker while rejecting that marker from the read-only shell. These measurements are evidence for the fail-closed ceilings, not authorization to load a wallet, prompt a device, sign, broadcast, deploy, or enter Mainnet.

The predecessor policy remains immutable at [`../iat-v2-admin-lazy-boundary-20260805/policy.json`](../iat-v2-admin-lazy-boundary-20260805/policy.json) with its exact SHA-256 bound in [`policy.json`](./policy.json). `QA-ADMIN-001` remains open for independent hardware/runtime review and the existing large operator-only chunks.
