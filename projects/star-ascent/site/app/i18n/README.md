# Internal Agency localization contract

`messages.json` is the source-complete runtime catalog for public UI localization. English is the canonical source. A non-English cell may differ from English only when `reviewed-localization-policy.json` designates the locale `REVIEWED` and binds that exact override to accountable, source-bound review evidence. The browser never calls a translation service.

The current policy is `GLOBAL_FAIL_CLOSED`: English is `SOURCE`; all 49 non-English locales, including Turkish, are `HOLD`; and there are no reviewed overrides. Every HOLD route therefore serves canonical English content.

## Public routing

- English keeps the canonical unprefixed route (`/`, `/future`, `/dossier`).
- Every other configured locale keeps a stable locale-intent prefix (`/es`, `/fr/future`, `/ar/dossier`). A prefix records the visitor's requested locale; it does not prove that translated content is approved.
- Public Dossier records keep stable nested locale-intent routes (for example, `/fr/dossier/read/white-dossier`). While that locale is `HOLD`, visible copy, metadata, JSON-LD, HTML `lang`/`dir`, and `Content-Language` all remain canonical English.
- A HOLD route emits `noindex, nofollow, noarchive` in both HTML and the response header, is excluded from localized sitemap/hreflang discovery, and does not preload or request a non-English runtime payload.
- `ileriakil.com` is a Turkish-intent host, not an approved Turkish-language surface. While Turkish is `HOLD`, its pages use the same English fallback and `noindex` boundary.
- Cloudflare's `CF-IPCountry` country code selects the first visit's local default on the main page. The raw IP address is never read, stored, logged, or sent to this application.
- A saved `ia_language` cookie always wins. In multilingual countries, a locally appropriate `Accept-Language` preference may choose among the country's supported languages.
- Visitors on a non-English locale-intent route get a dismissible link back to the canonical English URL. It closes automatically after 15 seconds.

## Coverage

The route and catalog roster includes 50 locale codes: English, the current top global languages (including Nigerian Pidgin), Turkish, every national-language default needed for sovereign European countries, and every national-language default needed for sovereign countries in North, Central, South America, and the Caribbean. This is configured route coverage, not a claim that 50 translations have been reviewed or activated.

## Safety and review

- Brand and protocol terms such as `Internal Agency`, `STAR ASCENT`, `$IAT`, `$SOL`, `Solana`, `Genesis`, `APY`, and `CCC-Agent` are protected and checked before publication.
- Machine-generated, heuristic, or otherwise unreviewed copy is candidate material only. It must never become a runtime override, metadata value, or live payload cell.
- Production-imported source and built client assets contain no target-language draft copy. Historical candidates may remain only outside production import/public-static paths; the post-build quarantine scan blocks their re-entry.
- Review status is fail-closed. Do not infer approval from a filename, locale route, host, committed candidate, static payload, passing heuristic, or prior bilingual artifact. Only the evidence-bound policy can activate a non-English override.
- Downloadable disclosure artifacts remain their source-language files; links are never rewritten into nonexistent translated documents. Their existence does not establish native review of the surrounding UI.
- English is the only controlling operational UI language under the current policy. Turkish remains `HOLD` until separately tracked accountable review evidence is accepted.
- The wallet-signing `/mint` ceremony tool is deliberately not a search landing page: it is absent from the sitemap and carries `noindex` directives in both HTML and the response header.

## Maintenance

1. Run the local preview and `npm run extract:i18n` to refresh canonical English source keys after UI copy changes without calling a remote translation service.
2. Machine-draft generation entry points are disabled. Prepare any future candidate outside the production tree, then admit only exact overrides with accountable review evidence. The compiler must continue to emit canonical English for every HOLD cell.
3. Record accepted overrides and accountable review evidence through the reviewed-localization policy workflow; never claim native approval without that evidence.
4. Run the locale compiler, `npm run check:i18n`, the deep linguistic-integrity validator, rendered route matrix, full test suite, production build, and post-build bundle-quarantine scan. A HOLD route must prove English identity, `noindex`, and zero non-English payload requests.
5. Never add runtime translation credentials or weaken the fail-closed fallback to make coverage appear complete.
