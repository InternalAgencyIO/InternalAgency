import futureCopy from "./future-copy.json";

export type FutureLanguage = keyof typeof futureCopy;

export async function getFutureLanguage(): Promise<FutureLanguage> {
  return "en";
}

export { futureCopy };
