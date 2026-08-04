# IAT site, locale, and hosting QA — 2026-08-03

**DRAFT / STATIC QA / NOT LAUNCH APPROVAL / NO DEPLOYMENT / MAINNET HOLD**

This package binds a deep website QA pass to source commit `762cdf4b7d44e43878187c9103b4a5c7f226667e`. It covers the 50-locale routing model, SEO identity, client-side localization settlement, responsive browser rendering, targeted accessibility rules, Sites/Cloudflare packaging, D1 migration packaging, dependency exposure, and the launch gate regression surface.

## Decision

Website localization release remains **HOLD**. Mainnet remains **HOLD** for its existing independent gates. This QA performed no deployment, signing, simulation for signing, broadcast, wallet access, transfer, DNS change, or launch scheduling.

The expanded browser and configuration checks passed locally after four source fixes:

- localized tokenomics routes retain their route-owned `lang` and `dir`;
- predictive-engine mechanics labels and the locale-prompt timeout meet the targeted contrast rule;
- non-English pages report locale readiness only after the client catalog has actually settled.
- fresh CI checkouts compile the intentionally generated locale payloads before Playwright starts, and a payload failure can no longer declare an untranslated fallback ready.

One material localization blocker remains: 247 unique visible source strings across 15 of 25 canonical route documents are outside the 50-language catalog. Affected locales can therefore show localized metadata and navigation while retaining English prose. The largest gap is `/tokenomics` with 63 uncataloged strings. The catalog must be re-extracted from current source, translated with protocol terms preserved, reviewed by native speakers, and rerun through this matrix before the 50-language rollout can be called complete.

## Verified checks

- 1,280 catalog entries are structurally complete across 50 locale payloads.
- All 50 locale roots hydrate in a real Chromium document with the expected language, direction, canonical, alternates, containment, and no recorded runtime error.
- Six stress routes (RTL, CJK, long-copy Latin, and Turkish) pass Chromium, Firefox, WebKit, tablet, Android Chromium emulation, and iOS WebKit emulation.
- Full Playwright run: 43 passed, 6 intentional project skips, 0 failed (49 cases total).
- Site test/build run: 45 passed, 0 failed.
- Hosting package: exact project binding, D1 binding `DB`, R2 disabled, and six migrations copied byte-for-byte.
- Production dependency audit: 0 vulnerabilities. Full dev/tooling graph: 15 moderate and 7 high transitive advisories; automated fixes propose breaking downgrades and were not applied.
- IAT V2 regression: 65 passed, 0 failed. Complete launch-gate bundle passed in its fail-closed `UNSCHEDULED_HOLD` state.

The first hosted run for `921bf02` failed both web jobs and exposed the fresh-checkout locale-payload defect. At intermediate head `498cc4c`, one complete hosted web run passed while its duplicate failed only because WebKit labeled a cancelled MP4 stream as a non-media request; all page assertions passed. Source commit `762cdf4b7d44e43878187c9103b4a5c7f226667e` normalizes that engine-specific diagnostic and passes the repeated local locale matrix. Its final hosted rerun was pending when this source-bound package was generated and is not represented as already green.

## Limitations

The browser profiles are automation/emulation on the Windows audit host. No physical iPhone, physical Android device, native Linux browser host, or native macOS Safari device was tested in this pass. No native-language reviewer signed off the 49 non-English catalogs. Hosted configuration was read-only, and no live version was changed.

Machine-readable scope, checks, findings, environment coverage, localization drift, hosting observation, and hashes are included beside this file.
