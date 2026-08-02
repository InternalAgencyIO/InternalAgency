import { headers } from "next/headers";
import futureCopy from "./future-copy.json";

export type FutureLanguage = keyof typeof futureCopy;

export async function getFutureLanguage(): Promise<FutureLanguage> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return host?.toLowerCase().includes("ileriakil") ? "tr" : "en";
}

export { futureCopy };
