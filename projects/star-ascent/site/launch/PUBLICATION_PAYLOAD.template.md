# $IAT Genesis Verified Publication Payload

Status: **HOLD**

Replace bracketed fields only after exact source-bound receipt, state, and endpoint verification, then change the status line to `Status: **VERIFIED**`. Copy the final values unchanged to the website, pinned post, and broadcast screen. Each evidence field must link to its own direct public record; do not reuse a landing page or a single URL as multiple proofs. The Explorer and authority-evidence URLs must visibly contain the full claimed mint address.

```text
STAR ASCENT // $IAT GENESIS VERIFIED

Network: Solana mainnet-beta
Mint: [FULL MINT ADDRESS]
Explorer: [FULL MINT EXPLORER URL]
Program: Original SPL Token Program
Decimals: 9
Fixed supply: [VERIFIED SUPPLY] IAT
Base units: [VERIFIED BASE-UNIT TOTAL]

Mint authority: None
Mint authority evidence: [FULL EXPLORER URL]
Freeze authority: None
Freeze authority evidence: [FULL EXPLORER URL]

Allocation and lock evidence: [CANONICAL URL]
Checked at (UTC): [YYYY-MM-DD HH:MM UTC — real verification time]
Evidence packet SHA-256: [LOWERCASE SHA-256 OF SOURCE-BOUND RECEIPT/STATE/ENDPOINT PACKET]
Evidence observation mode: AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION
No self-attestation: true
Human reviewer required: false

There is no private sale, paid registration, support wallet, or secret link. Never share a seed phrase or private key.
```

Do not use this payload if a field is pending, estimated, abbreviated, malformed, or not verifiable from the exact bound evidence packet. A verified $IAT payload must state exactly `1000000000 IAT` and `1000000000000000000` base units (9 decimals). The verification timestamp must be a real UTC minute, and the evidence packet digest must bind the observed receipts, state, and endpoints. The mint explorer and both authority proofs must each name the full mint address in their direct URLs.
