import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const relativePath = "assets/lore/starlight-era/world-x-publish-ledger.json";
const ledgerPath = `${repo}/${relativePath}`;

const targetText = await readFile(ledgerPath, "utf8");
const target = JSON.parse(targetText);
const baseText = execFileSync("git", ["show", `HEAD:${relativePath}`], {
  cwd: repo,
  encoding: "utf8"
});
const base = JSON.parse(baseText);

function scanJsonValueEnd(text, start) {
  const first = text[start];
  if (first === '"') {
    for (let index = start + 1, escaped = false; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') return index + 1;
    }
  }

  if (first === "{" || first === "[") {
    const closing = first === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === first) depth += 1;
      else if (char === closing && --depth === 0) return index + 1;
    }
  }

  let end = start;
  while (end < text.length && !",}]\r\n".includes(text[end])) end += 1;
  return end;
}

function propertyRange(text, key) {
  const marker = `"${key}"`;
  const keyStart = text.indexOf(marker);
  if (keyStart < 0) throw new Error(`Missing property ${key}`);
  const colon = text.indexOf(":", keyStart + marker.length);
  let start = colon + 1;
  while (/\s/.test(text[start])) start += 1;
  return {
    keyStart,
    start,
    end: scanJsonValueEnd(text, start),
    indent: keyStart - (text.lastIndexOf("\n", keyStart) + 1)
  };
}

function formatValue(value, indent) {
  return JSON.stringify(value, null, 2).replaceAll("\n", `\n${" ".repeat(indent)}`);
}

function replaceProperty(text, key, value) {
  const range = propertyRange(text, key);
  return `${text.slice(0, range.start)}${formatValue(value, range.indent)}${text.slice(range.end)}`;
}

function appendArrayEntries(text, key, entries) {
  if (!entries.length) return text;
  const range = propertyRange(text, key);
  if (text[range.start] !== "[") throw new Error(`${key} is not an array`);
  const close = range.end - 1;
  let insertAt = close;
  while (/\s/.test(text[insertAt - 1])) insertAt -= 1;
  const hasEntries = text.slice(range.start + 1, insertAt).trim().length > 0;
  const elementIndent = range.indent + 2;
  const block = entries
    .map((entry) => `${" ".repeat(elementIndent)}${formatValue(entry, elementIndent)}`)
    .join(",\n");
  return `${text.slice(0, insertAt)}${hasEntries ? "," : ""}\n${block}${text.slice(insertAt)}`;
}

function appendTopLevelProperties(text, entries) {
  const trimmed = text.trimEnd();
  const close = trimmed.lastIndexOf("}");
  const prefix = trimmed.slice(0, close).trimEnd();
  const block = entries
    .map(([key, value]) => `  "${key}": ${formatValue(value, 2)}`)
    .join(",\n");
  return `${prefix},\n${block}\n}\n`;
}

const baseExceptionKeys = new Set((base.auditExceptions ?? []).map((entry) => entry.postUrl ?? JSON.stringify(entry)));
const addedExceptions = (target.auditExceptions ?? []).filter(
  (entry) => !baseExceptionKeys.has(entry.postUrl ?? JSON.stringify(entry))
);
const basePostUrls = new Set((base.posts ?? []).map((entry) => entry.postUrl));
const addedPosts = (target.posts ?? []).filter((entry) => !basePostUrls.has(entry.postUrl));

let repaired = baseText;
repaired = replaceProperty(repaired, "maxPostsPerRun", target.maxPostsPerRun);
repaired = replaceProperty(repaired, "backlogDrainPolicy", target.backlogDrainPolicy);
repaired = replaceProperty(repaired, "heartCycle", target.captionPolicy.heartCycle);
repaired = appendArrayEntries(repaired, "auditExceptions", addedExceptions);
repaired = appendArrayEntries(repaired, "posts", addedPosts);
repaired = appendTopLevelProperties(repaired, [
  ["latestAssistedDrain", target.latestAssistedDrain],
  ["deferredPostCheckpoint", target.deferredPostCheckpoint],
  ["continuousDrainPolicy", target.continuousDrainPolicy],
  ["latestContinuousDrain", target.latestContinuousDrain]
]);

const repairedObject = JSON.parse(repaired);
if (JSON.stringify(repairedObject) !== JSON.stringify(target)) {
  const mismatches = [];
  const compare = (left, right, pointer = "") => {
    if (mismatches.length >= 40) return;
    if (Object.is(left, right)) return;
    if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
      mismatches.push({ pointer, left, right });
      return;
    }
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) compare(left[key], right[key], `${pointer}/${key}`);
  };
  compare(repairedObject, target);
  if (mismatches.length) {
    throw new Error(`Compact ledger reconstruction mismatch: ${JSON.stringify(mismatches)}`);
  }
}

await writeFile(ledgerPath, repaired, "utf8");
console.log(JSON.stringify({
  addedExceptions: addedExceptions.length,
  addedPosts: addedPosts.length,
  logicalStatePreserved: true
}, null, 2));
