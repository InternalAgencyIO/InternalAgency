# Batch 487 Slovakia Meta prompts, blocked occurrence, and outcomes

- Account: `leesha007`
- Mode: `Thinking`
- Browser: visible Codex in-app Browser only
- Ordered anchors in every dispatched lane: `938`, `936`, `937`
- Initial dispatches: four, exactly once each
- Initial successes: three
- Initial hard failures: one, Scene 1976
- Meta retries: one, Scene 1976 Retry 1
- Retry successes: one
- Confirmed prompt resends: zero
- Older terminal scenes reopened: zero

| Scene | Provider URL | Outcome | Retry count |
| --- | --- | --- | ---: |
| 1975 | `https://www.meta.ai/prompt/c28afc8b-012b-4e5e-b2a9-199fb3f21e58` | Success; visible Download produced `bratislava_castle_chain.jpg` | 0 |
| 1976 initial | `https://www.meta.ai/prompt/8477e594-1ff8-42be-ae8c-379d5e975e6d` | Hard failure, no image; Meta declined the distant damage element and offered an intact castle version | 0 |
| 1976 Retry 1 | `https://www.meta.ai/prompt/38bb3e58-02cd-46ab-acc2-b7c5fb3216f5` | Success; visible Download produced `rainbow_stockings_correction.jpg` | 1 |
| 1977 | `https://www.meta.ai/prompt/0daf1876-bea9-464d-9f37-0b51337156db` | Success; visible Download produced `strbske_pleso_fashion.jpg` | 0 |
| 1978 | `https://www.meta.ai/prompt/f0fb60ce-13c3-4f1e-a81b-a66ba58721bb` | Success; visible Download produced `orava_castle_group.jpg` | 0 |

The exact blocked Scene 1976 initial prompt is archived in `batch-487-slovakia-europe-gap-fill-prompts-prepared-checkpoint.json` under prompt SHA-256 `611AC0C4DDAD860478C6D546E68E4828D3B31C2478E7554678A7FF2BD36D622E`. The exact provider-safe Retry 1 prompt is archived in `batch-487-slovakia-scene-1976-meta-retry-1-prepared-checkpoint.json` under prompt SHA-256 `B522F5F9DE2B08C2205C43F0EB0523B9DF6C8B90C8543448A9A57915CFEBC54A`.

Retry 1 was staged with all three visible attachments in exact order and the visible Send control was activated once. A `Discard prompt?` navigation guard appeared after the activation while the home URL remained visible. The visible `Stay` control preserved the composer, but provider history proved that the one activation had already created the confirmed `38bb...` provider URL. No second Send occurred. A later supported upload attempt left only anchor 938 on the residual home composer before the provider URL was discovered. That duplicate residue remains unsent and is not authority.

All four final Meta occurrences are non-corrupt, public-safe, exactly-four-adult compositions with usable landmark, identity, wardrobe and footwear continuity. Scene 1976 succeeded on its only retry, so the remaining Meta retry allowance was not used. No scene was retried for aesthetic or roll-fidelity variance.
