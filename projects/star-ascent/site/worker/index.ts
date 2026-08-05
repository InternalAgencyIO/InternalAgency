/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { localeCodes, runtimeContentLocale, type LocaleCode } from "../app/i18n/config";

const supportedLocales = new Set<string>(localeCodes);

const countryLocale: Record<string, string> = {
  CN: "zh", TW: "zh", HK: "zh", SG: "zh",
  ES: "es", MX: "es", AR: "es", BO: "es", CL: "es", CO: "es", CR: "es", CU: "es", DO: "es", EC: "es", GT: "es", HN: "es", NI: "es", PA: "es", PE: "es", PR: "es", SV: "es", UY: "es", VE: "es",
  IN: "hi",
  FR: "fr", MC: "fr", SN: "fr", CI: "fr", CM: "fr", ML: "fr", NE: "fr", BF: "fr", TG: "fr", BJ: "fr", CD: "fr", CG: "fr", GA: "fr",
  SA: "ar", AE: "ar", BH: "ar", DZ: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", LB: "ar", LY: "ar", MA: "ar", OM: "ar", PS: "ar", QA: "ar", SD: "ar", SY: "ar", TN: "ar", YE: "ar",
  BD: "bn",
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  ID: "id",
  PK: "ur",
  RU: "ru", KZ: "ru", KG: "ru",
  DE: "de", AT: "de", LI: "de", CH: "de",
  JP: "ja",
  NG: "pcm",
  TR: "tr",
  AL: "sq", XK: "sq",
  AD: "ca",
  BY: "be",
  NL: "nl", BE: "nl", SR: "nl", AW: "nl", CW: "nl", SX: "nl", BQ: "nl",
  BA: "bs",
  BG: "bg",
  HR: "hr",
  GR: "el", CY: "el",
  CZ: "cs",
  DK: "da", GL: "da", FO: "da",
  EE: "et",
  FI: "fi",
  HU: "hu",
  IS: "is",
  IE: "en",
  IT: "it", SM: "it", VA: "it",
  LV: "lv",
  LT: "lt",
  LU: "lb",
  MK: "mk",
  MT: "mt",
  NO: "no",
  PL: "pl",
  RO: "ro", MD: "ro",
  RS: "sr", ME: "sr",
  SK: "sk",
  SI: "sl",
  SE: "sv",
  UA: "uk",
  GB: "en",
  HT: "ht",
  PY: "gn",
  AM: "hy",
  AZ: "az",
  GE: "ka",
  US: "en", CA: "en", AG: "en", BS: "en", BB: "en", BZ: "en", DM: "en", GD: "en", GY: "en", JM: "en", KN: "en", LC: "en", VC: "en", TT: "en",
  BM: "en", KY: "en", TC: "en", FK: "en", VG: "en", VI: "en",
  GF: "fr", GP: "fr", MQ: "fr", BL: "fr", MF: "fr",
};

// Countries with more than one locally appropriate supported language may
// honor the visitor's browser preference. Every other mapped country uses its
// country default first, matching the promised country-based landing behavior.
const countryLanguageChoices: Record<string, readonly string[]> = {
  BE: ["nl", "fr", "de"],
  BA: ["bs", "hr", "sr"],
  BO: ["es", "qu"],
  BY: ["be", "ru"],
  BZ: ["en", "es"],
  CA: ["en", "fr"],
  CH: ["de", "fr", "it"],
  CY: ["el", "tr"],
  FI: ["fi", "sv"],
  IE: ["en", "ga"],
  LU: ["lb", "fr", "de"],
  MD: ["ro", "ru", "uk"],
  ME: ["sr", "sq", "bs", "hr"],
  MK: ["mk", "sq"],
  MT: ["mt", "en"],
  PE: ["es", "qu"],
  PY: ["gn", "es"],
  SG: ["zh", "en"],
  ES: ["es", "ca"],
  UA: ["uk", "ru"],
  US: ["en", "es"],
  XK: ["sq", "sr"],
};

function cookieLanguage(request: Request): string | null {
  const match = request.headers.get("cookie")?.match(/(?:^|;\s*)ia_language=([a-z-]+)/i);
  const value = match?.[1]?.toLowerCase() ?? null;
  return value && supportedLocales.has(value) ? value : null;
}

function preferredLanguage(request: Request): string {
  const saved = cookieLanguage(request);
  if (saved) return saved;
  const accepted = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const languagePreferences = accepted
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.trim().split(";");
      const code = tag.split("-")[0];
      const qualityText = parameters.find((parameter) => parameter.trim().startsWith("q="))?.split("=")[1];
      const quality = qualityText === undefined ? 1 : Number(qualityText);
      return { code, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ code }) => supportedLocales.has(code));
  const rejectedLanguages = new Set(languagePreferences.filter(({ quality }) => quality <= 0).map(({ code }) => code));
  const acceptedLanguages = languagePreferences
    .filter(({ quality }) => quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(({ code }) => code)
    .filter((code, index, values) => values.indexOf(code) === index);
  // Crawlers commonly omit Accept-Language. Keep the canonical English root
  // stable for those requests; normal browsers still receive country routing.
  if (!acceptedLanguages.length) return "en";
  const country = request.headers.get("cf-ipcountry")?.toUpperCase();
  if (country) {
    const choices = countryLanguageChoices[country];
    const acceptedLocalLanguage = acceptedLanguages.find((choice) => choices?.includes(choice));
    if (acceptedLocalLanguage) return acceptedLocalLanguage;
    if (countryLocale[country] && !rejectedLanguages.has(countryLocale[country])) return countryLocale[country];
  }
  return acceptedLanguages[0] ?? "en";
}

function pathLocale(pathname: string): LocaleCode | null {
  const candidate = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return candidate && supportedLocales.has(candidate) ? candidate as LocaleCode : null;
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const originalPathname = url.pathname;

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const incomingLocale = pathLocale(url.pathname);
    const turkishHost = url.hostname.toLowerCase().includes("ileriakil");
    const strippedPathname = incomingLocale
      ? url.pathname.slice(incomingLocale.length + 1) || "/"
      : url.pathname;
    const englishOnlyCasinoDemo = strippedPathname === "/future/casino/demo";

    if (englishOnlyCasinoDemo && (incomingLocale || turkishHost)) {
      const destination = new URL("https://internalagency.io/future/casino/demo");
      destination.search = url.search;
      return new Response(null, {
        status: 308,
        headers: {
          Location: destination.toString(),
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    if (url.pathname === "/" && !turkishHost) {
      const preferred = preferredLanguage(request);
      if (preferred !== "en" && runtimeContentLocale(preferred as LocaleCode) === preferred) {
        const destination = new URL(request.url);
        destination.pathname = `/${preferred}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: destination.toString(),
            "Cache-Control": "private, no-store",
            Vary: "Accept-Language, CF-IPCountry, Cookie",
          },
        });
      }
    }

    if (incomingLocale) {
      url.pathname = strippedPathname.startsWith("/") ? strippedPathname : `/${strippedPathname}`;
    }

    const localizedHeaders = new Headers(request.headers);
    if (incomingLocale) localizedHeaders.set("x-ia-locale", incomingLocale);
    localizedHeaders.set("x-ia-path", url.pathname);
    request = new Request(new Request(url, request), { headers: localizedHeaders });

    const response = await handler.fetch(request, env, ctx);
    const responseHeaders = new Headers(response.headers);
    const contentType = responseHeaders.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const requestedLocale = incomingLocale ?? (turkishHost ? "tr" : "en");
      const contentLanguage = runtimeContentLocale(requestedLocale);
      responseHeaders.set("Content-Language", contentLanguage);
      if (!incomingLocale && !turkishHost) responseHeaders.append("Vary", "Accept-Language, CF-IPCountry, Cookie");
      const turkishHostReviewHold = turkishHost && runtimeContentLocale("tr") !== "tr";
      if (url.pathname === "/mint" || contentLanguage !== requestedLocale || turkishHostReviewHold) {
        responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
    }
    if (/^\/i18n-v2\/[a-f0-9]{16}\/[a-z-]+\.json$/i.test(originalPathname)) {
      responseHeaders.set("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    } else if (/^\/i18n\/[a-z-]+\.json$/i.test(originalPathname)) {
      responseHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};

export default worker;
