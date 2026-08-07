# Internal Agency repository and live-estate baseline

Observed: 2026-08-07

Mode: read-only observation; no GitHub, hosting, DNS, website, wallet, Devnet,
or Mainnet mutation was performed.

## GitHub

- Repository: `InternalAgencyIO/InternalAgency`
- Visibility: public
- Default branch: `main`
- Canonical V2 preparation branch: `agent/iat-launch-window`
- Canonical V2 observed head: `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796`
- Draft launch PR: #4, `agent/iat-launch-window` -> `main`
- PR #4 observed scope: 280 commits, 796 changed files
- PR #4 observed state: open, draft, not mergeable at observation time
- Separate inactive preview PR: #9, `agent/iat-postgenesis-teasers` -> `main`

The default branch is not the complete V2 architecture source. B3 starts from
the exact public PR #4 head and must later reconcile any V2 head movement
explicitly. PR #9 remains a separate historical preview branch; its feature
intent is preserved in the parity contract, but it is not used as the B3 Git
base.

## Local worktrees

- Existing V2 guardian worktree:
  `work/iat-mainnet-final-r2-20260806`
- Existing guardian branch:
  `agent/iat-mainnet-final-r2-20260806`
- Guardian worktree observed with two uncommitted hydration-ledger files; they
  were preserved and not copied, restored, staged, or edited.
- Isolated B3 worktree:
  `work/iat-b3-architecture`
- Isolated B3 branch:
  `agent/iat-b3-architecture`

## Hosting

The canonical branch contains `.openai/hosting.json` with:

```json
{
  "project_id": "appgprj_6a665e190c9081918cfdd3f9f121087a",
  "d1": "DB",
  "r2": null
}
```

The D1 binding and site-hosting configuration are part of the B3 public-system
inventory. They are not protocol consensus and cannot authorize token or chain
state.

## Live public endpoints

Basic direct GET observations:

| URL | Status | Relevant observation |
| --- | ---: | --- |
| `https://internalagency.io/` | 200 | `Internal Agency — STAR ASCENT` |
| `https://internalagency.io/network` | 200 | `NETWORK` |
| `https://internalagency.io/tokenomics` | 200 | `FIXED-SUPPLY PROTOCOL` |
| `https://internalagency.io/sitemap.xml` | 200 | XML sitemap returned |
| `https://ileriakil.com/` | 200 | `X-Robots-Tag: noindex, nofollow, noarchive` |

This is an availability baseline, not full content, localization, security,
accessibility, or deployment-source certification. The Turkish domain's
fail-closed indexing header must remain until the existing accountable review
gates permit a change.

## Ownership boundary for B3 work

Until explicit publication authority is granted, B3 work remains on its local
isolated branch. It must not:

- push over `agent/iat-launch-window`;
- merge or close PR #4 or PR #9;
- deploy the Sites project;
- change D1, DNS, domains, or live content;
- use wallet, Trezor, keypair, seed, or signing material;
- mutate Devnet or Mainnet;
- relabel HOLD evidence as approval.

Future repository, website, and protocol changes should share one source-bound
release record so the public site never describes a B3 behavior that the
reviewed validator/runtime does not implement.
