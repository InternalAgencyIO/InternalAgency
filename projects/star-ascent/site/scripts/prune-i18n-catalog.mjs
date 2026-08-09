import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const sourceKeys = Object.keys(catalog.messages.en);
const retainedKeys = sourceKeys.filter((source) => !(
  source.length > 500
  && source.includes("{")
  && source.includes("}")
  && /(?:^|\s)[.#][a-z0-9_-]+(?:\s|>|\{|:)/i.test(source)
));

if (retainedKeys.length !== sourceKeys.length) {
  for (const locale of Object.keys(catalog.messages)) {
    catalog.messages[locale] = Object.fromEntries(
      retainedKeys.map((source) => [source, catalog.messages[locale][source]]),
    );
  }
  catalog.meta.sourceCount = retainedKeys.length;
  catalog.meta.prunedNonContentStrings = sourceKeys.length - retainedKeys.length;
  await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Pruned ${sourceKeys.length - retainedKeys.length} non-content source string(s).`);
} else {
  console.log("No non-content source strings required pruning.");
}
