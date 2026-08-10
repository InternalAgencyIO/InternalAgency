import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_REVISION } from "./lib/integrity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheRoot = path.resolve("E:\\CodexCache");

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--model-dir") throw new Error("usage: node verify-model-files.mjs --model-dir E:\\CodexCache\\...");
  return path.resolve(argv[1]);
}

function assertCacheChild(target) {
  const relative = path.relative(cacheRoot, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`model directory must be a child of ${cacheRoot}`);
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

const requestedModelDir = parseArgs(process.argv.slice(2));
assertCacheChild(requestedModelDir);
const modelDir = await realpath(requestedModelDir);
assertCacheChild(modelDir);
const provenance = JSON.parse(await readFile(path.join(here, "model-provenance.json"), "utf8"));
if (provenance.model.revision !== MODEL_REVISION || provenance.activationAllowed !== false) throw new Error("provenance invariant failed");

const verified = [];
for (const expected of provenance.files) {
  const filePath = path.join(modelDir, expected.path);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) throw new Error(`missing pinned model file: ${expected.path}`);
  if (fileStat.size !== expected.bytes) throw new Error(`${expected.path} size ${fileStat.size} != ${expected.bytes}`);
  const actualSha256 = await hashFile(filePath);
  if (actualSha256 !== expected.sha256) throw new Error(`${expected.path} sha256 ${actualSha256} != ${expected.sha256}`);
  verified.push({ path: expected.path, bytes: fileStat.size, sha256: actualSha256 });
}

const index = JSON.parse(await readFile(path.join(modelDir, "model.safetensors.index.json"), "utf8"));
const shards = [...new Set(Object.values(index.weight_map ?? {}))].sort();
if (shards.length !== 1 || shards[0] !== "model.safetensors-00001-of-00001.safetensors") {
  throw new Error(`unexpected safetensors shard map: ${JSON.stringify(shards)}`);
}
if (index.metadata?.total_size !== 1746882752) throw new Error(`unexpected declared tensor size ${index.metadata?.total_size}`);

const config = JSON.parse(await readFile(path.join(modelDir, "config.json"), "utf8"));
if (config.model_type !== "qwen3_5" || config.architectures?.[0] !== "Qwen3_5ForConditionalGeneration") {
  throw new Error("unexpected model architecture metadata");
}

console.log(JSON.stringify({
  status: "PINNED_MODEL_FILES_VERIFIED",
  modelDir,
  repository: provenance.model.repository,
  revision: MODEL_REVISION,
  declaredLicense: provenance.model.declaredLicense,
  fileCount: verified.length,
  totalBytes: verified.reduce((sum, file) => sum + file.bytes, 0),
  files: verified,
  activationAllowed: false,
  bulkGenerationAllowed: false,
}));
