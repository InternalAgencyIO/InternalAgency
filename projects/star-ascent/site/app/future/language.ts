import { headers } from "next/headers";
import futureCopy from "./future-copy.json";
import { localeFromRequestHeaders } from "../i18n/config";

export type FutureLanguage = keyof typeof futureCopy;

export async function getFutureLanguage(): Promise<FutureLanguage> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return localeFromRequestHeaders(requestHeaders.get("x-ia-locale"), host) === "tr" ? "tr" : "en";
}

export { futureCopy };
