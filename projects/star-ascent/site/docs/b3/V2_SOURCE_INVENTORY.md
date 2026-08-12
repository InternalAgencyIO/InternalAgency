# B3 inheritance and V2 port inventory

Status: source inherited; runtime port in progress.

Canonical V2 source commit: `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796`

The B3 branch descends from that exact public V2 commit. No V2 source was
removed when B3 planning began. This is source inheritance, not a claim that
every component has already been rewritten for the sovereign B3 runtime.

## Inventory

| V2 area | Canonical source | Inherited | B3 port status |
| --- | --- | --- | --- |
| Anchor instruction runtime | `programs/iat_v2/src/lib.rs` | Yes | Pending module-by-module port |
| Supply, allocations, vesting, rewards, roles, CCC timing, tiebreaks | `programs/iat_v2/src/policy.rs` | Yes | Pending pure-policy extraction and differential tests |
| Switchboard ABI, commit, and reveal validation | `programs/iat_v2/src/switchboard_randomness.rs` | Yes | Semantics retained; Solana transport must be replaced |
| JavaScript policy oracle | `engagement/iat-v2-reference-engine.mjs` | Yes | Retained as an independent differential oracle |
| Client and instruction builders | `programs/iat_v2/client.mjs`, `programs/iat_v2/instructions.mjs`, `programs/iat_v2/feature-instructions.mjs` | Yes | B3 client pending; V2 client remains supported during migration |
| Wallet/X identity and D1 activation | `app/api/x/**`, `app/api/nodes/**`, `engagement/node-binding-policy.mjs`, `engagement/x-oauth-state.mjs` | Yes | B3 binding adapter pending; fail-closed rules retained |
| Network RPC and explorer | `app/api/network/route.ts`, `app/network/**` | Yes | B3 read adapter pending |
| Website and tokenomics | `app/**`, `app/tokenomics/**`, `public/**` | Yes | Retained; B3 data integration pending |
| Fifty-locale system and review holds | `app/i18n/**`, localization scripts and tests | Yes | Retained unchanged |
| Admin inspection and hardware signing boundary | `tools/iat-v2-admin-console/**`, mint and ceremony modules | Yes | Retained for V2 transition; B3 ceremony design pending |
| Audit, CI, release, launch, and evidence gates | repository `.github/workflows/**`; site `public/audits/**`, `docs/**`, `launch/**`, `scripts/**` | Yes | Retained; B3-specific gates being added |
| Inactive future previews and DLC boundaries | `app/future/**`, future-feature tests and audits | Yes | Retained inactive |

## V2 on-chain entrypoint coverage

All fifteen V2 entrypoints remain in the inherited source:

1. `initialize_config`
2. `initialize_lane_vault`
3. `initialize_stake_vault`
4. `activate`
5. `register_agency`
6. `set_eligibility`
7. `open_position`
8. `settle_position_week`
9. `settle_core_week`
10. `claim_lane_principal`
11. `withdraw_position_principal`
12. `close_position`
13. `commit_round`
14. `settle_round`
15. `expire_round`

The list is intentionally explicit so a mistaken historical count cannot hide
an omitted handler.

## Port-completion rule

An inherited row becomes **PORTED** only when:

1. B3 owns an implementation rather than merely retaining the V2 file;
2. canonical V2 and B3 vectors agree where behavior must remain identical;
3. B3-specific consensus and migration behavior is tested separately;
4. inactive V2 features remain unreachable;
5. security, economic, and external reproduction evidence is public.

Until every KEEP row in `V2_FEATURE_PARITY.md` is mapped to this evidence, B3
is not feature-complete and must not be described as ready for activation.
