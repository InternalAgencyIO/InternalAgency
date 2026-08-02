import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const tokenPattern = /(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu;
let invalidated = 0;

for (const [locale, messages] of Object.entries(catalog.messages)) {
  if (locale === "en") continue;
  for (const [source, translated] of Object.entries(messages)) {
    const required = source.match(tokenPattern) ?? [];
    if (required.some((token) => !translated.includes(token))) {
      messages[source] = "";
      invalidated += 1;
    }
  }
}

await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Invalidated ${invalidated} translations with changed numeric/unit tokens.`);
