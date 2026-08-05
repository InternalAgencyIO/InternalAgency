# 50-locale-intent SEO contract

This is the release gate for locale discovery. It applies to every public route, not only the home page, and is subordinate to `reviewed-localization-policy.json`.

The current `GLOBAL_FAIL_CLOSED` state has one indexable content locale: English. All 49 non-English locales, including Turkish, are `HOLD` and serve canonical English fallback with `noindex`.

## Implemented

- Stable locale-intent URLs (`/es`, `/fr`, `/zh`, `/pcm`, and equivalent nested routes) remain navigable while review is pending.
- Each response emits exactly one canonical URL. A HOLD route canonicalizes to the corresponding unprefixed English route on `internalagency.io`; `noindex` and exclusion from hreflang/sitemaps prevent its locale-intent alias from being advertised as reviewed localized content.
- Head alternates contain only review-approved content locales plus `x-default`. In the current state that means English and `x-default`; `zh-Hans`, `sr-Cyrl`, `tr-TR`, and every other non-English tag are absent.
- A language-selector option may link to a HOLD locale-intent route, but it must not use `hreflang` to claim that the target resource is written in that language.
- Every HOLD page uses canonical English title, description, Open Graph alt, visible copy, WebSite/WebPage JSON-LD `inLanguage`, `Content-Language: en`, `<html lang="en" dir="ltr">`, and both meta/header `noindex, nofollow, noarchive`.
- A compiled locale artifact may exist for integrity verification, but a HOLD page neither preloads nor fetches a non-English payload. Its runtime cells must remain canonical English unless an exact reviewed override is active.
- The XML sitemap contains only review-approved routes and alternates. Nigerian Pidgin, Turkish, and every other HOLD route are currently absent.
- `ileriakil.com` is a Turkish-intent host under review HOLD. It serves English fallback with `noindex`; its sitemap is not advertised by `robots.txt` until Turkish becomes evidence-bound `REVIEWED`.
- The root country redirect runs only for requests that present a browser language. A redirect records locale intent only and must not change the effective English fallback or indexing boundary for a HOLD locale.
- `robots.txt` currently names only the review-approved `https://internalagency.io/sitemap.xml`.
- The wallet-signing `/mint` ceremony tool is intentionally absent from the sitemap and emits both an HTML `noindex` directive and `X-Robots-Tag: noindex, nofollow, noarchive`.

## Validation gates

- Every locale must have all canonical source strings; any compiled payload must exactly follow reviewed-or-fallback policy.
- Every Europe/Americas sovereign-country ISO code must resolve to a supported default.
- Every route must emit one canonical, but only review-approved content locales may enter reciprocal hreflang clusters or the sitemap.
- `x-default` must be present. `zh-Hans`, `sr-Cyrl`, `tr-TR`, and other non-English tags must remain absent while their locales are HOLD; invalid `hreflang="pcm"` is always absent.
- Locale-intent pages must return `200` with `Content-Language`, HTML `lang`/`dir`, metadata, JSON-LD, payload use, and indexing directives derived from the effective reviewed-or-fallback content locale.
- Every HOLD page must have both meta and response-header `noindex`, must request zero non-English runtime payloads, and must contain no unreviewed target-language prose.
- Both public hosts must agree on the runtime bundle, catalog digest, fallback semantics, and freshness-safe cache policy. The Turkish-intent host must not bypass review.
- Country routing must yield to a saved choice and must not redirect a crawler-style request with no browser language.
- Protocol names, URLs, dates, times, placeholders, markup, and numeric tokens must survive every reviewed override byte-for-byte where required.

## Honest boundaries

- A locale-looking URL, native language name, compiled artifact, or machine-generated candidate is not evidence of approval.
- Search engines determine language primarily from visible content. Therefore HOLD pages state their actual English identity and remain non-indexable rather than pretending that route intent is translated content.
- IP-derived country selection is a user convenience, not an SEO signal. Review status controls content language and discovery.
- Machine-generated copy may be retained only outside production-imported and public-static paths as quarantined review input. It cannot enter a built client asset, visible copy, metadata, JSON-LD, or a differing runtime payload cell without accountable, source-bound review evidence.
