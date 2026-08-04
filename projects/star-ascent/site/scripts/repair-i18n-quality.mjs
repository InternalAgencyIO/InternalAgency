import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
let invalidated = 0;

for (const [locale, messages] of Object.entries(catalog.messages)) {
  if (locale === "en") continue;
  for (const [source, translated] of Object.entries(messages)) {
    const expansionRatio = translated.length / Math.max(1, source.length);
    if (translated.length > 800 || (source.length > 40 && expansionRatio > 4)) {
      messages[source] = "";
      invalidated += 1;
    }
  }
}

await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Invalidated ${invalidated} suspiciously expanded translations.`);
