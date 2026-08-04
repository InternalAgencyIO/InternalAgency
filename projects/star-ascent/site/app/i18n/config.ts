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
  { code: "zh", name: "Mandarin Chinese", nativeName: "简体中文", dir: "ltr", googleCode: "zh-CN" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr", googleCode: "es" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", googleCode: "hi" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", googleCode: "fr" },
  { code: "ar", name: "Modern Standard Arabic", nativeName: "العربية", dir: "rtl", googleCode: "ar" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr", googleCode: "bn" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr", googleCode: "pt" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr", googleCode: "id" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl", googleCode: "ur" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr", googleCode: "ru" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr", googleCode: "de" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", googleCode: "ja" },
  { code: "pcm", name: "Nigerian Pidgin", nativeName: "Naijá Píjin", dir: "ltr", googleCode: "pcm" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", googleCode: "tr" },
  { code: "sq", name: "Albanian", nativeName: "Shqip", dir: "ltr", googleCode: "sq" },
  { code: "ca", name: "Catalan", nativeName: "Català", dir: "ltr", googleCode: "ca" },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", dir: "ltr", googleCode: "be" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr", googleCode: "nl" },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski", dir: "ltr", googleCode: "bs" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", dir: "ltr", googleCode: "bg" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", dir: "ltr", googleCode: "hr" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", dir: "ltr", googleCode: "el" },
  { code: "cs", name: "Czech", nativeName: "Čeština", dir: "ltr", googleCode: "cs" },
  { code: "da", name: "Danish", nativeName: "Dansk", dir: "ltr", googleCode: "da" },
  { code: "et", name: "Estonian", nativeName: "Eesti", dir: "ltr", googleCode: "et" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", dir: "ltr", googleCode: "fi" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", dir: "ltr", googleCode: "hu" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", dir: "ltr", googleCode: "is" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", dir: "ltr", googleCode: "ga" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", googleCode: "it" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", dir: "ltr", googleCode: "lv" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", dir: "ltr", googleCode: "lt" },
  { code: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch", dir: "ltr", googleCode: "lb" },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", dir: "ltr", googleCode: "mk" },
  { code: "mt", name: "Maltese", nativeName: "Malti", dir: "ltr", googleCode: "mt" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", dir: "ltr", googleCode: "no" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr", googleCode: "pl" },
  { code: "ro", name: "Romanian", nativeName: "Română", dir: "ltr", googleCode: "ro" },
  { code: "sr", name: "Serbian (Cyrillic)", nativeName: "Српски", dir: "ltr", googleCode: "sr" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", dir: "ltr", googleCode: "sk" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", dir: "ltr", googleCode: "sl" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", dir: "ltr", googleCode: "sv" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr", googleCode: "uk" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl ayisyen", dir: "ltr", googleCode: "ht" },
  { code: "gn", name: "Guaraní", nativeName: "Avañe'ẽ", dir: "ltr", googleCode: "gn" },
  { code: "qu", name: "Quechua", nativeName: "Runa Simi", dir: "ltr", googleCode: "qu" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", dir: "ltr", googleCode: "hy" },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycanca", dir: "ltr", googleCode: "az" },
  { code: "ka", name: "Georgian", nativeName: "ქართული", dir: "ltr", googleCode: "ka" },
] as const;

const supported = new Set<string>(localeCodes);

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && supported.has(value.toLowerCase()));
}

export function localeFromPath(pathname: string): LocaleCode | null {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return isLocaleCode(first) ? first : null;
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
