# 50-locale SEO contract

This is the release gate for multilingual discovery. It applies to every localized public route, not only the home page.

## Implemented

- Stable language URLs (`/es`, `/fr`, `/zh`, `/pcm`, and equivalent nested routes).
- Self-referencing canonical URLs on every locale/route pair.
- Reciprocal equivalent-route `hreflang` annotations, plus `x-default` to the English route.
- Script-specific tags where material (`zh-Hans`, `sr-Cyrl`) and `dir="rtl"` for Arabic and Urdu.
- Nigerian Pidgin remains available at `/pcm` with a self-canonical, `lang="pcm"`, sitemap discovery, and explicit language-selector links. It is deliberately omitted from Google `hreflang` because Google accepts ISO 639-1 there and `pcm` is ISO 639-3; emitting an invalid tag would be fake coverage.
- Locale- and route-specific title, description, Open Graph image alt, canonical URL, WebSite/WebPage JSON-LD, and `Content-Language` across all 23 indexable public routes.
- XML sitemap entries for all public route/locale pairs, with equivalent-route alternates for every Google-supported language tag.
- Crawlable `<a href>` language choices on every page. JavaScript enhances preference storage but is not required to discover locale URLs.
- Localized head metadata is server-rendered. Visible page copy is hydrated from a same-origin, static locale payload; Google renders that JavaScript content, while the canonical/hreflang/sitemap discovery layer never depends on client execution.
- Locale payloads are preloaded and cacheable. English fallback copy remains visible while localization hydrates, so a slow or blocked payload never produces a blank page.
- The root country redirect only runs for requests that present a browser language. Requests without `Accept-Language` keep the stable English root, so crawlers can reach the canonical fallback while sitemaps and alternates expose every locale.
- `robots.txt` allows the site and names both public sitemap URLs.
- The wallet-signing `/mint` ceremony tool is intentionally absent from the sitemap and emits both an HTML `noindex` directive and `X-Robots-Tag: noindex, nofollow, noarchive`.

## Validation gates

- Every locale must have all canonical source strings and a compiled static payload.
- Every Europe/Americas sovereign-country ISO code must resolve to a supported default.
- Every localized page must self-canonicalize and expose the same reciprocal alternate cluster.
- `x-default`, `zh-Hans`, and `sr-Cyrl` must be present; invalid `hreflang="pcm"` must be absent.
- Locale pages must return `200`, the matching `Content-Language`, and the matching HTML `lang`/`dir`.
- Country routing must yield to a saved choice and must not redirect a crawler-style request with no browser language.
- Protocol names, URLs, dates, times, and numeric tokens must survive translation byte-for-byte.

## Honest boundaries

- Search engines determine language primarily from visible page content, not just URL or `lang`; that is why full-content catalog coverage and rendered-content tests are required. The present visible-body localization still depends on JavaScript execution even though metadata and discovery do not.
- IP-derived country selection is a user convenience, not an SEO signal. Locale URLs, canonicals, alternates, links, and sitemaps are the indexing contract.
- Machine-generated copy remains reviewable static content. Native-speaker editorial review can improve cadence without changing routes or SEO relationships.
