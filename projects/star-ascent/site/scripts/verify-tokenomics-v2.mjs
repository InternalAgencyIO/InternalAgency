#!/usr/bin/env node

import { readFileSync } from "node:fs";

const files = {
  page: readFileSync("app/tokenomics/page.tsx", "utf8"),
  rewards: readFileSync("app/rewards/page.tsx", "utf8"),
  dossier: readFileSync("app/dossier/page.tsx", "utf8"),
  reader: readFileSync("app/dossier/read/[slug]/page.tsx", "utf8"),
  en: readFileSync("archive/public-disclosures/source/iat-tokenomics-v2-en.txt", "utf8"),
  tr: readFileSync("archive/public-disclosures/source/iat-tokenomics-v2-tr.txt", "utf8"),
};
const reviewedPolicy = JSON.parse(readFileSync("app/i18n/reviewed-localization-policy.json", "utf8"));

const failures = [];
const requireIn = (name, fragments) => {
  for (const fragment of fragments) {
    if (!files[name].includes(fragment)) failures.push(`${name} is missing ${JSON.stringify(fragment)}`);
  }
};

requireIn("page", [
  "HOST-TESTED · NOT DEPLOYED · MAINNET HOLD",
  "400M REWARD RESERVE",
  "50M available at Genesis target",
  "37.5M available at Genesis target",
  "12.5M available at Genesis target",
  "17%",
  "10%",
  "28%",
  "20%",
  "without automatic compounding",
  "24 hours after Genesis",
  "every seven days after that",
  "operator cannot reroll",
  "all three lanes to reach zero",
  "complete maximum reward obligation",
  "immediately precede the decision snapshot in the same transaction",
  "fresh prior-slot seed is bound on-chain",
]);
requireIn("rewards", ["PROPOSED STAKING RATES // NOT ACTIVE", "400M IAT", "CCC AGENT", "CCC ASSOCIATE"]);
requireIn("dossier", ["every week", "MAINNET: HOLD"]);
requireIn("reader", ["POLICY V2 / NOT ACTIVE / MAINNET HOLD"]);
requireIn("en", ["Status: PROPOSED — NOT ACTIVE — MAINNET HOLD", "24 hours after Genesis", "every seven days after that", "operator cannot reroll", "all three lanes to reach zero"]);
requireIn("tr", ["Durum: ÖNERİ — AKTİF DEĞİL — MAINNET BEKLET", "Başlangıçtan 24 saat sonra", "her yedi günde", "yeniden çekiliş yapamaz", "üç hattın da sıfıra ulaşmasına"]);

if (
  reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedPolicy.machineDraftRuntimeAllowed !== false
  || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedPolicy.directComponentReviewBundleComplete !== false
  || Object.entries(reviewedPolicy.localeStatus).some(([locale, status]) => locale !== "en" && status !== "HOLD")
) failures.push("reviewed-localization policy is not globally fail closed");

const productionSource = [files.page, files.rewards, files.dossier, files.reader].join("\n");
if (/[ĞğİıŞş]|[Ͱ-ԯ԰-֏؀-ۿऀ-ൿႠ-ჿ぀-ヿ㐀-鿿]/u.test(productionSource)) {
  failures.push("production tokenomics surfaces contain unreviewed target-language copy");
}

const enRates = [...files.en.matchAll(/(?:Core team|Standard eligible user|Active CCC Agent|Eligible downstream CCC associate):[^\n]*?(\d+)%/g)].map((match) => Number(match[1]));
if (enRates.join(",") !== "17,10,28,20") failures.push(`unexpected English rate order: ${enRates.join(",")}`);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log("IAT Tokenomics V2 canonical-English production gate and paired-source archive checks pass in HOLD. No contract deployment or transaction is authorized.");
