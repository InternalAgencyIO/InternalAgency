# STAR ASCENT contracts

This directory is the public technical boundary for future on-chain work.

## Current status

No production contract, mint, wallet, authority, transaction, or distribution
instruction is published here. STAR ASCENT uses a standard Solana fungible-token
configuration target; it is not a custom yield, staking, custody, or identity
contract.

## Release gate

Before any mainnet action, publish and independently verify:

1. Token program and mint address.
2. Decimal configuration and exact initial supply.
3. Mint and freeze authority state after the initial mint.
4. Public allocation wallets and time-lock evidence for non-circulating allocations.
5. A reproducible transaction order and the signed public evidence packet.

Until all five appear together, the only valid status is **HOLD**.

## Scope boundary

The public target is a fixed-supply token configuration with mint and freeze
authority permanently revoked after the documented initial mint. No private sale,
paid registration, price promise, yield promise, or secret claim path belongs in
this project.

See [the live bilingual source](../site) and the public
[launch archive](../site/launch) for the current runbooks and validation tools.
