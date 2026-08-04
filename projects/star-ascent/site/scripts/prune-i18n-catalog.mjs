import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const forbiddenControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/gu;
const pairedDelimiters = [["(", ")"], ["[", "]"], ["{", "}"], ["“", "”"], ["«", "»"], ["「", "」"], ["『", "』"]];
const sourceKeys = Object.keys(catalog.messages.en);
const retainedKeys = sourceKeys.filter(
  (source) =>
    !(
      (source.length > 500 &&
        source.includes("{") &&
        source.includes("}") &&
        /(?:^|\s)[.#][a-z0-9_-]+(?:\s|>|\{|:)/i.test(source)) ||
      /^(?:a|button|input|select|textarea)(?:\[|:)[^\n]+(?:\]|\))(?:\s*,\s*(?:a|button|input|select|textarea)(?:\[|:)[^\n]+(?:\]|\)))*$/i.test(
        source,
      )
    ),
);

function occurrences(value, token) {
  return value.split(token).length - 1;
}

function repairBalancedDelimiters(value) {
  const sequenceMarker = value.match(/^\[\d{1,3}\]\s*/u)?.[0] ?? "";
  let repaired = sequenceMarker ? value.slice(sequenceMarker.length) : value;
  for (const [open, close] of pairedDelimiters) {
    let openCount = occurrences(repaired, open);
    let closeCount = occurrences(repaired, close);
    while (closeCount > openCount) {
      repaired = repaired.replace(close, "");
      closeCount -= 1;
    }
    if (openCount > closeCount) repaired += close.repeat(openCount - closeCount);
  }
  if ((repaired.match(/"/gu) ?? []).length % 2 !== 0) {
    const lastQuote = repaired.lastIndexOf('"');
    repaired = `${repaired.slice(0, lastQuote)}${repaired.slice(lastQuote + 1)}`;
  }
  return `${sequenceMarker}${repaired}`;
}

function questionPattern(locale) {
  return locale === "el" ? /[?？؟՞;]/u : /[?？؟՞]/u;
}

let sanitizedBidiControls = 0;
let normalizedUnicodeStrings = 0;
let balancedDelimiterStrings = 0;
let restoredSentenceIntent = 0;
let restoredSequenceMarkers = 0;
let restoredStructuralSeparators = 0;
for (const [locale, messages] of Object.entries(catalog.messages)) {
  for (const [source, translation] of Object.entries(messages)) {
    let normalized = translation.normalize("NFC");
    if (normalized !== translation) {
      normalizedUnicodeStrings += 1;
    }
    normalized = normalized.replace(forbiddenControls, "");
    if (normalized !== translation) {
      sanitizedBidiControls += 1;
    }

    const sourceSequenceMarker = source.match(
      /^(\[\d{1,3}\]|\d{2}\s*\/\/)\s*/u,
    )?.[1];
    if (sourceSequenceMarker && !normalized.startsWith(sourceSequenceMarker)) {
      const withoutTranslatedMarker = normalized.replace(
        /^\s*(?:[\[(]?\p{Nd}{1,3}[\])\].:-]?|\p{Nd}{2}\s*[/\\|:.-]{1,2})\s*/u,
        "",
      );
      normalized = `${sourceSequenceMarker} ${withoutTranslatedMarker}`.trimEnd();
      restoredSequenceMarkers += 1;
    }

    const balanced = repairBalancedDelimiters(normalized);
    if (balanced !== normalized) {
      normalized = balanced;
      balancedDelimiterStrings += 1;
    }

    if (source.includes("?") && !questionPattern(locale).test(normalized)) {
      normalized = `${normalized.trimEnd()}?`;
      restoredSentenceIntent += 1;
    }
    if (source.includes("!") && !/[!！՜]/u.test(normalized)) {
      normalized = `${normalized.trimEnd()}!`;
      restoredSentenceIntent += 1;
    }

    const sourceDoubleSlashCount = (source.match(/\/\//gu) ?? []).length;
    let translationDoubleSlashCount = (normalized.match(/\/\//gu) ?? []).length;
    while (translationDoubleSlashCount < sourceDoubleSlashCount) {
      const restored = normalized.replace(
        /\s+(?:\/|[-–—|:])\s+/u,
        " // ",
      );
      if (restored === normalized) break;
      normalized = restored;
      translationDoubleSlashCount += 1;
      restoredStructuralSeparators += 1;
    }

    if (source.trimEnd().endsWith("→") && !normalized.trimEnd().endsWith("→")) {
      normalized = `${normalized.trimEnd().replace(/[>»]\s*$/u, "").trimEnd()} →`;
      restoredStructuralSeparators += 1;
    }

    if (source.trimStart().startsWith("•") && !normalized.trimStart().startsWith("•")) {
      normalized = `• ${normalized.trimStart()}`;
      restoredStructuralSeparators += 1;
    }

    if (normalized !== translation) {
      messages[source] = normalized;
    }
  }
}

if (
  retainedKeys.length !== sourceKeys.length ||
  normalizedUnicodeStrings > 0 ||
  sanitizedBidiControls > 0 ||
  balancedDelimiterStrings > 0 ||
  restoredSentenceIntent > 0 ||
  restoredSequenceMarkers > 0 ||
  restoredStructuralSeparators > 0
) {
  for (const locale of Object.keys(catalog.messages)) {
    catalog.messages[locale] = Object.fromEntries(
      retainedKeys.map((source) => [source, catalog.messages[locale][source]]),
    );
  }
  catalog.meta.sourceCount = retainedKeys.length;
    catalog.meta.prunedNonContentStrings = sourceKeys.length - retainedKeys.length;
    catalog.meta.normalizedUnicodeStrings = normalizedUnicodeStrings;
    catalog.meta.sanitizedBidiControls = sanitizedBidiControls;
    catalog.meta.balancedDelimiterStrings = balancedDelimiterStrings;
    catalog.meta.restoredSentenceIntent = restoredSentenceIntent;
  catalog.meta.restoredSequenceMarkers = restoredSequenceMarkers;
  catalog.meta.restoredStructuralSeparators = restoredStructuralSeparators;
  await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(
    `Pruned ${sourceKeys.length - retainedKeys.length} non-content source string(s); normalized ${normalizedUnicodeStrings} Unicode string(s); sanitized ${sanitizedBidiControls} bidi-control translation(s); balanced ${balancedDelimiterStrings} delimiter string(s); restored ${restoredSentenceIntent} sentence-intent mark(s), ${restoredSequenceMarkers} sequence marker(s), and ${restoredStructuralSeparators} structural separator(s).`,
  );
} else {
  console.log(
    "No non-content strings, Unicode normalization, bidi-control translations, delimiters, sentence-intent marks, or sequence markers required normalization.",
  );
}
