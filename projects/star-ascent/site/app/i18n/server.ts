import { headers } from "next/headers";
import { localeFromRequestHeaders } from "./config";
import localizedMetadata from "./metadata.generated.json";

type GeneratedLocaleMetadata = { seo: Record<string, string> };
const metadata = localizedMetadata as Record<string, GeneratedLocaleMetadata>;

export async function localizedSeoTexts(sources: readonly string[]): Promise<string[]> {
  const requestHeaders = await headers();
  const locale = localeFromRequestHeaders(
    requestHeaders.get("x-ia-locale"),
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
  return sources.map((source) => metadata[locale]?.seo?.[source] ?? source);
}
