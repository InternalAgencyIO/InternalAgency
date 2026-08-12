import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PublicKey, SystemProgram } from "@solana/web3.js";

import {
  ORIGINAL_TOKEN_ACCOUNT_BYTES,
  ORIGINAL_TOKEN_MINT_BYTES,
  decodeOriginalTokenAccountInfo,
  decodeOriginalTokenMintInfo,
} from "../tools/iat-v2-admin-console/original-token-decode.mjs";
import { TOKEN_PROGRAM_ID } from "../programs/iat_v2/instructions.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(siteRoot, path), "utf8"));
const policy = readJson("public/audits/iat-v2-dependency-preconditions-20260805/policy.json");
const lock = readJson("package-lock.json");
const address = new PublicKey("11111111111111111111111111111111");

function accountInfo(bytes, owner = TOKEN_PROGRAM_ID) {
  return {
    data: Buffer.alloc(bytes),
    executable: false,
    lamports: 1,
    owner,
    rentEpoch: 0,
  };
}

function runtimeSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`runtime source cannot traverse symbolic link ${path}`);
    if (entry.isDirectory()) files.push(...runtimeSourceFiles(path));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

test("historical unpatched bigint-buffer advisory remains explicit and non-authorizing", () => {
  assert.equal(policy.schema, "iat-v2-dependency-advisory-preconditions/v1");
  assert.equal(policy.status, "DRAFT_QA_HOLD_UNPATCHED_DEPENDENCY");
  assert.equal(policy.mainnetStatus, "UNSCHEDULED_HOLD");
  assert.deepEqual(policy.advisory, {
    id: "GHSA-3gc7-fjrx-p6mg",
    severity: "HIGH",
    package: "bigint-buffer",
    affectedRange: "<=1.1.5",
    patchedVersions: "NONE_PUBLISHED",
    effect: "APPLICATION_AVAILABILITY_CRASH",
  });
  assert.equal(policy.assurance.dependencyPatched, false);
  assert.equal(policy.assurance.vulnerableFunctionUnreachableProven, false);
  assert.ok(Object.values(policy.assurance).every((value) => value === false));
});

test("current lock supersedes the historical bigint graph with the reviewed local remediation", () => {
  for (const [name, expected] of Object.entries(policy.lockedGraph)) {
    if (name === "bigint-buffer") continue;
    assert.equal(lock.packages[`node_modules/${name}`]?.version, expected, `${name} lock version drifted`);
  }
  assert.equal(policy.lockedGraph["bigint-buffer"], "1.1.5");
  assert.equal(lock.packages["node_modules/bigint-buffer"].version, "1.1.6");
  assert.equal(
    lock.packages["node_modules/bigint-buffer"].resolved,
    "file:vendor/bigint-buffer-1.1.6.tgz",
  );
  assert.match(
    lock.packages["node_modules/bigint-buffer"].integrity,
    /^sha512-[A-Za-z0-9+/]+={0,2}$/u,
  );
  assert.equal(lock.packages["node_modules/@solana/buffer-layout-utils/node_modules/bigint-buffer"], undefined);
  assert.equal(lock.packages["node_modules/@solana/spl-token"].dependencies["@solana/buffer-layout-utils"], "^0.3.0");
  assert.equal(lock.packages["node_modules/@solana/buffer-layout-utils"].dependencies["bigint-buffer"], "^1.1.5");
});

test("runtime source has no direct low-level bigint decoder import", () => {
  const forbidden = /\bfrom\s+["'](?:bigint-buffer|@solana\/buffer-layout-utils)["']/u;
  const offenders = ["app", "programs", "tools"]
    .flatMap((root) => runtimeSourceFiles(resolve(siteRoot, root)))
    .filter((path) => forbidden.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
});

test("installed SPL bigint layout keeps project-used scalar decodes fixed to eight bytes", () => {
  const source = readFileSync(resolve(siteRoot, "node_modules/@solana/buffer-layout-utils/lib/esm/bigint.mjs"), "utf8");
  assert.match(source, /const layout = blob\(length, property\)/u);
  assert.match(source, /const src = decode\(buffer, offset\)/u);
  assert.match(source, /toBigIntLE\(Buffer\.from\(src\)\)/u);
  assert.match(source, /export const u64 = [^\r\n]*bigInt\(8\)/u);
  assert.equal(policy.preconditions.splScalarDecodeBytes, 8);
});

test("original Token account decode accepts only one exact verified snapshot", () => {
  assert.equal(ORIGINAL_TOKEN_ACCOUNT_BYTES, policy.preconditions.originalTokenAccountBytes);
  const decoded = decodeOriginalTokenAccountInfo({
    address,
    info: accountInfo(ORIGINAL_TOKEN_ACCOUNT_BYTES),
    programId: TOKEN_PROGRAM_ID,
  });
  assert.equal(decoded.amount, 0n);
  assert.throws(
    () => decodeOriginalTokenAccountInfo({ address, info: accountInfo(ORIGINAL_TOKEN_ACCOUNT_BYTES - 1), programId: TOKEN_PROGRAM_ID }),
    /expected exactly 165/u,
  );
  assert.throws(
    () => decodeOriginalTokenAccountInfo({ address, info: accountInfo(ORIGINAL_TOKEN_ACCOUNT_BYTES + 1), programId: TOKEN_PROGRAM_ID }),
    /expected exactly 165/u,
  );
  assert.throws(
    () => decodeOriginalTokenAccountInfo({ address, info: accountInfo(ORIGINAL_TOKEN_ACCOUNT_BYTES, SystemProgram.programId), programId: TOKEN_PROGRAM_ID }),
    /wrong program owner/u,
  );
});

test("original Token mint decode accepts only one exact verified snapshot", () => {
  assert.equal(ORIGINAL_TOKEN_MINT_BYTES, policy.preconditions.originalTokenMintBytes);
  const decoded = decodeOriginalTokenMintInfo({
    address,
    info: accountInfo(ORIGINAL_TOKEN_MINT_BYTES),
    programId: TOKEN_PROGRAM_ID,
  });
  assert.equal(decoded.supply, 0n);
  assert.throws(
    () => decodeOriginalTokenMintInfo({ address, info: accountInfo(ORIGINAL_TOKEN_MINT_BYTES - 1), programId: TOKEN_PROGRAM_ID }),
    /expected exactly 82/u,
  );
  assert.throws(
    () => decodeOriginalTokenMintInfo({ address, info: accountInfo(ORIGINAL_TOKEN_MINT_BYTES + 1), programId: TOKEN_PROGRAM_ID }),
    /expected exactly 82/u,
  );
  assert.throws(
    () => decodeOriginalTokenMintInfo({ address, info: null, programId: TOKEN_PROGRAM_ID }),
    /is missing/u,
  );
});

test("admin source decodes the checked account snapshot without a second RPC read", () => {
  const source = readFileSync(resolve(siteRoot, "tools/iat-v2-admin-console/main.jsx"), "utf8");
  assert.doesNotMatch(source, /\bgetAccount\s*\(/u);
  assert.doesNotMatch(source, /\bgetMint\s*\(/u);
  assert.match(source, /decodeOriginalTokenAccountInfo\(\{\s*address,\s*info,/u);
  assert.match(source, /decodeOriginalTokenMintInfo\(\{\s*address: mint,\s*info: mintInfo,/u);
  assert.equal(statSync(resolve(siteRoot, "tools/iat-v2-admin-console/original-token-decode.mjs")).isFile(), true);
  assert.equal(policy.preconditions.decodeUsesAlreadyVerifiedRpcSnapshot, true);
  assert.equal(policy.preconditions.secondRpcReadBeforeDecodeAllowed, false);
});
