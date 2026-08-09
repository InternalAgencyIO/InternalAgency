# Internal Agency localization contract

`messages.json` is the single source-bound catalog for public UI localization. It contains every extracted English UI string and a static translation for every supported locale. The browser never calls a translation service.

## Public routing

- English keeps the canonical unprefixed route (`/`, `/future`, `/dossier`).
- Every other locale uses a stable prefix (`/es`, `/fr/future`, `/ar/dossier`).
- Public Dossier records keep stable nested locale routes (for example, `/fr/dossier/read/white-dossier`) and receive their own localized search metadata.
- Cloudflare's `CF-IPCountry` country code selects the first visit's local default on the main page. The raw IP address is never read, stored, logged, or sent to this application.
- A saved `ia_language` cookie always wins. In multilingual countries, a locally appropriate `Accept-Language` preference may choose among the country's supported languages.
- Non-English visitors get a dismissible English-return prompt. It closes automatically after 15 seconds.

## Coverage

The catalog includes English, the current top global languages (including Nigerian Pidgin), Turkish, every national-language default needed for sovereign European countries, and every national-language default needed for sovereign countries in North, Central, South America, and the Caribbean. Shared language routes use neutral public copy rather than pretending one translation represents every regional dialect.

## Safety and review

- Brand and protocol terms such as `Internal Agency`, `STAR ASCENT`, `$IAT`, `$SOL`, `Solana`, `Genesis`, `APY`, and `CCC-Agent` are protected during generation and checked before publication.
- Generated translations are static and auditable in Git. Native-speaker review can amend any catalog value without touching application components.
- Downloadable disclosure artifacts remain their signed/source-language files; links are never rewritten into nonexistent translated documents. The surrounding UI is localized.
- English and Turkish remain the controlling operational disclosure languages until a separately reviewed translation is explicitly designated authoritative.
- The wallet-signing `/mint` ceremony tool is deliberately not a search landing page: it is absent from the sitemap and carries `noindex` directives in both HTML and the response header.

## Maintenance

1. Run the local preview and `npm run extract:i18n` to refresh source keys after UI copy changes without calling a remote translation service.
2. Generate missing static locale values with `npm run generate:i18n:local`. The local NLLB runtime path can be supplied through `I18N_PYTHON_RUNTIME`; model cache location can be supplied through the normal Hugging Face cache environment.
3. Run `npm run check:i18n`, the full build/test suite, and the route tests.
4. Treat native-speaker corrections as ordinary reviewed catalog edits; never add runtime translation credentials.
