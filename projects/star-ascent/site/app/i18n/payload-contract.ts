import payloadContractJson from "./payload-contract.json";
import type { LocaleCode } from "./config";

export const localePayloadContract = payloadContractJson;
export const localePayloadRoot = `/${localePayloadContract.assetNamespace}/${localePayloadContract.payloadNamespaceSha256.slice(0, 16)}`;

export function localePayloadPath(locale: LocaleCode): string {
  return `${localePayloadRoot}/${locale}.json`;
}
