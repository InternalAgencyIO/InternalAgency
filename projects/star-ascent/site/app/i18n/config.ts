import reviewedLocalizationPolicy from "./reviewed-localization-policy.json";
import { runtimeContentLocaleForPolicy } from "./runtime-content-policy.js";

export const localeCodes = [
  "en",
  "zh",
  "es",
  "hi",
  "fr",
  "ar",
  "bn",
  "pt",
  "id",
  "ur",
  "ru",
  "de",
  "ja",
  "pcm",
  "tr",
  "sq",
  "ca",
  "be",
  "nl",
  "bs",
  "bg",
  "hr",
  "el",
  "cs",
  "da",
  "et",
  "fi",
  "hu",
  "is",
  "ga",
  "it",
  "lv",
  "lt",
  "lb",
  "mk",
  "mt",
  "no",
  "pl",
  "ro",
  "sr",
  "sk",
  "sl",
  "sv",
  "uk",
  "ht",
  "gn",
  "qu",
  "hy",
  "az",
  "ka",
] as const;

export type LocaleCode = (typeof localeCodes)[number];

export type LocaleDefinition = {
  code: LocaleCode;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  googleCode: string;
};

export const locales: readonly LocaleDefinition[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr", googleCode: "en" },
  { code: "zh", name: "Mandarin Chinese", nativeName: "Mandarin Chinese", dir: "ltr", googleCode: "zh-CN" },
  { code: "es", name: "Spanish", nativeName: "Spanish", dir: "ltr", googleCode: "es" },
  { code: "hi", name: "Hindi", nativeName: "Hindi", dir: "ltr", googleCode: "hi" },
  { code: "fr", name: "French", nativeName: "French", dir: "ltr", googleCode: "fr" },
  { code: "ar", name: "Modern Standard Arabic", nativeName: "Modern Standard Arabic", dir: "rtl", googleCode: "ar" },
  { code: "bn", name: "Bengali", nativeName: "Bengali", dir: "ltr", googleCode: "bn" },
  { code: "pt", name: "Portuguese", nativeName: "Portuguese", dir: "ltr", googleCode: "pt" },
  { code: "id", name: "Indonesian", nativeName: "Indonesian", dir: "ltr", googleCode: "id" },
  { code: "ur", name: "Urdu", nativeName: "Urdu", dir: "rtl", googleCode: "ur" },
  { code: "ru", name: "Russian", nativeName: "Russian", dir: "ltr", googleCode: "ru" },
  { code: "de", name: "German", nativeName: "German", dir: "ltr", googleCode: "de" },
  { code: "ja", name: "Japanese", nativeName: "Japanese", dir: "ltr", googleCode: "ja" },
  { code: "pcm", name: "Nigerian Pidgin", nativeName: "Nigerian Pidgin", dir: "ltr", googleCode: "pcm" },
  { code: "tr", name: "Turkish", nativeName: "Turkish", dir: "ltr", googleCode: "tr" },
  { code: "sq", name: "Albanian", nativeName: "Albanian", dir: "ltr", googleCode: "sq" },
  { code: "ca", name: "Catalan", nativeName: "Catalan", dir: "ltr", googleCode: "ca" },
  { code: "be", name: "Belarusian", nativeName: "Belarusian", dir: "ltr", googleCode: "be" },
  { code: "nl", name: "Dutch", nativeName: "Dutch", dir: "ltr", googleCode: "nl" },
  { code: "bs", name: "Bosnian", nativeName: "Bosnian", dir: "ltr", googleCode: "bs" },
  { code: "bg", name: "Bulgarian", nativeName: "Bulgarian", dir: "ltr", googleCode: "bg" },
  { code: "hr", name: "Croatian", nativeName: "Croatian", dir: "ltr", googleCode: "hr" },
  { code: "el", name: "Greek", nativeName: "Greek", dir: "ltr", googleCode: "el" },
  { code: "cs", name: "Czech", nativeName: "Czech", dir: "ltr", googleCode: "cs" },
  { code: "da", name: "Danish", nativeName: "Danish", dir: "ltr", googleCode: "da" },
  { code: "et", name: "Estonian", nativeName: "Estonian", dir: "ltr", googleCode: "et" },
  { code: "fi", name: "Finnish", nativeName: "Finnish", dir: "ltr", googleCode: "fi" },
  { code: "hu", name: "Hungarian", nativeName: "Hungarian", dir: "ltr", googleCode: "hu" },
  { code: "is", name: "Icelandic", nativeName: "Icelandic", dir: "ltr", googleCode: "is" },
  { code: "ga", name: "Irish", nativeName: "Irish", dir: "ltr", googleCode: "ga" },
  { code: "it", name: "Italian", nativeName: "Italian", dir: "ltr", googleCode: "it" },
  { code: "lv", name: "Latvian", nativeName: "Latvian", dir: "ltr", googleCode: "lv" },
  { code: "lt", name: "Lithuanian", nativeName: "Lithuanian", dir: "ltr", googleCode: "lt" },
  { code: "lb", name: "Luxembourgish", nativeName: "Luxembourgish", dir: "ltr", googleCode: "lb" },
  { code: "mk", name: "Macedonian", nativeName: "Macedonian", dir: "ltr", googleCode: "mk" },
  { code: "mt", name: "Maltese", nativeName: "Maltese", dir: "ltr", googleCode: "mt" },
  { code: "no", name: "Norwegian", nativeName: "Norwegian", dir: "ltr", googleCode: "no" },
  { code: "pl", name: "Polish", nativeName: "Polish", dir: "ltr", googleCode: "pl" },
  { code: "ro", name: "Romanian", nativeName: "Romanian", dir: "ltr", googleCode: "ro" },
  { code: "sr", name: "Serbian (Cyrillic)", nativeName: "Serbian (Cyrillic)", dir: "ltr", googleCode: "sr" },
  { code: "sk", name: "Slovak", nativeName: "Slovak", dir: "ltr", googleCode: "sk" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenian", dir: "ltr", googleCode: "sl" },
  { code: "sv", name: "Swedish", nativeName: "Swedish", dir: "ltr", googleCode: "sv" },
  { code: "uk", name: "Ukrainian", nativeName: "Ukrainian", dir: "ltr", googleCode: "uk" },
  { code: "ht", name: "Haitian Creole", nativeName: "Haitian Creole", dir: "ltr", googleCode: "ht" },
  { code: "gn", name: "Guarani", nativeName: "Guarani", dir: "ltr", googleCode: "gn" },
  { code: "qu", name: "Quechua", nativeName: "Quechua", dir: "ltr", googleCode: "qu" },
  { code: "hy", name: "Armenian", nativeName: "Armenian", dir: "ltr", googleCode: "hy" },
  { code: "az", name: "Azerbaijani", nativeName: "Azerbaijani", dir: "ltr", googleCode: "az" },
  { code: "ka", name: "Georgian", nativeName: "Georgian", dir: "ltr", googleCode: "ka" },
] as const;

const supported = new Set<string>(localeCodes);

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && supported.has(value.toLowerCase()));
}

export function localeFromPath(pathname: string): LocaleCode | null {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return isLocaleCode(first) ? first : null;
}

export function runtimeContentLocale(locale: LocaleCode): LocaleCode {
  return runtimeContentLocaleForPolicy(reviewedLocalizationPolicy, locale) as LocaleCode;
}

export function sourceLanguageForClientPath(_pathname: string, _hostname: string): "en" {
  // Direct component copy has no per-string review binding. It therefore stays
  // canonical English; reviewed non-English content is applied only through the
  // evidence-bound runtime catalog.
  void _pathname;
  void _hostname;
  return "en";
}

export function stripLocalePrefix(pathname: string): string {
  const locale = localeFromPath(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.slice(locale.length + 1);
  return stripped.startsWith("/") ? stripped : stripped ? `/${stripped}` : "/";
}

export function localePath(locale: LocaleCode, pathname: string): string {
  const plain = stripLocalePrefix(pathname);
  if (locale === "en") return plain;
  return `/${locale}${plain === "/" ? "" : plain}`;
}

export function localeDirection(locale: LocaleCode): "ltr" | "rtl" {
  return locales.find((entry) => entry.code === locale)?.dir ?? "ltr";
}

export function htmlLanguageTag(locale: LocaleCode): string {
  if (locale === "zh") return "zh-Hans";
  if (locale === "sr") return "sr-Cyrl";
  return locale;
}

export function googleHreflangTag(locale: LocaleCode): string | null {
  // Google accepts ISO 639-1 language identifiers. Nigerian Pidgin's ISO
  // 639-3 code remains a valid public/HTML locale, but not a Google hreflang.
  return locale === "pcm" ? null : htmlLanguageTag(locale);
}

export function localeFromRequestHeaders(
  headerLocale: string | null,
  host: string | null,
): LocaleCode {
  if (isLocaleCode(headerLocale)) return headerLocale;
  return host?.toLowerCase().includes("ileriakil") ? "tr" : "en";
}
