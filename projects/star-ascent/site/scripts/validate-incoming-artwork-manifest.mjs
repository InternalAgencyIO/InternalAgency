#!/usr/bin/env node

import { readFileSync } from "node:fs";

const manifestPath = process.argv[2] ?? "launch/incoming-artwork-manifest.template.json";
const maxBytes = 3 * 1024 * 1024;
const maxPageArtworkBytes = 5 * 1024 * 1024;
const maxPreloadBytes = 3 * 1024 * 1024;
const maxPreloadAssets = 1;
const allowedPlacements = new Set(["hero", "arrival", "dossier", "shortcut", "social-card", "livestream"]);
const allowedLoading = new Set(["preload", "eager", "lazy"]);
const allowedHandoff = new Set(["NOT_REQUESTED", "REQUESTED", "DELIVERED", "HOLD"]);
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isCanonicalUtc = (value) => typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const findSecretBearingField = (value, path = "manifest") => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findSecretBearingField(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const fieldPath = `${path}.${name}`;
      if (secretBearingFieldName(name)) return fieldPath;
      const found = findSecretBearingField(item, fieldPath);
      if (found) return found;
    }
  }
  return null;
};
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,88}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = [0];
  for (const character of value) {
    let carry = alphabet.indexOf(character);
    for (let index = 0; index < decoded.length; index += 1) {
      carry += decoded[index] * 58;
      decoded[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      decoded.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0);
};
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && base58DecodedLength(value) === 64;
};
const findCredentialBearingValue = (value, path = "manifest") => {
  if (typeof value === "string") return credentialBearingValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findCredentialBearingValue(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const found = findCredentialBearingValue(item, `${path}.${name}`);
      if (found) return found;
    }
  }
  return null;
};
const isMnemonicShapedReviewer = (value) => {
  if (typeof value !== "string") return false;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]{3,8}$/i.test(word));
};

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  fail(`manifest must be readable JSON: ${manifestPath}`);
}

if (manifest) {
  const secretBearingField = findSecretBearingField(manifest);
  if (secretBearingField) fail(`manifest must not contain credential-bearing field ${secretBearingField}`);
  else ok("no credential-bearing fields are present");
  const credentialBearingValuePath = findCredentialBearingValue(manifest);
  if (credentialBearingValuePath) fail(`manifest must not contain credential-bearing value at ${credentialBearingValuePath}`);
  else ok("no credential-bearing values are present");
  if (isMnemonicShapedReviewer(manifest.reviewer)) fail("manifest must not contain a mnemonic-shaped reviewer label");
  else ok("reviewer label is not mnemonic-shaped");

  if (manifest.version !== 1) fail("manifest version must be 1");
  if (!['HOLD', 'PENDING_REVIEW'].includes(manifest.status)) fail("manifest status must remain HOLD or PENDING_REVIEW; it cannot authorize publication");
  if (!Array.isArray(manifest.assets)) fail("assets must be an array");
  if (manifest.status === "HOLD" && manifest.assets?.length === 0) ok("empty HOLD intake is safe until artwork arrives");
  if (manifest.status === "PENDING_REVIEW" && (!isCanonicalUtc(manifest.reviewedAtUtc) || !hasText(manifest.reviewer))) fail("PENDING_REVIEW requires canonical reviewedAtUtc and a reviewer label");
  if (manifest.status === "HOLD" && (manifest.reviewedAtUtc || manifest.reviewer)) fail("HOLD must not imply a completed review");

  const filenames = new Set();
  const assetDigests = new Set();
  let pageArtworkBytes = 0;
  let preloadBytes = 0;
  let preloadAssets = 0;
  for (const [index, asset] of (manifest.assets ?? []).entries()) {
    const label = `assets[${index}]`;
    if (!hasText(asset?.filename) || !/^star-ascent-[a-z0-9-]+-v[1-9]\d*\.(png|webp)$/i.test(asset.filename)) fail(`${label}.filename must use star-ascent-<subject>-v<N>.png|webp`);
    else if (filenames.has(asset.filename.toLowerCase())) fail(`${label}.filename duplicates another asset`);
    else filenames.add(asset.filename.toLowerCase());
    if (!isSha256(asset?.sha256)) fail(`${label}.sha256 must be the exact 64-character SHA-256 digest of the delivered file`);
    else if (assetDigests.has(asset.sha256.toLowerCase())) fail(`${label}.sha256 duplicates another asset; use one canonical filename per delivered file`);
    else assetDigests.add(asset.sha256.toLowerCase());
    if (!allowedPlacements.has(asset?.placement)) fail(`${label}.placement is not an approved placement`);
    if (!allowedLoading.has(asset?.loading)) fail(`${label}.loading must be preload, eager, or lazy`);
    if (!Number.isInteger(asset?.width) || !Number.isInteger(asset?.height) || asset.width < 1 || asset.height < 1) fail(`${label} requires positive integer width and height`);
    if (!Number.isInteger(asset?.bytes) || asset.bytes < 1 || asset.bytes > maxBytes) fail(`${label}.bytes must be between 1 and ${maxBytes}`);
    else pageArtworkBytes += asset.bytes;
    if (!hasText(asset?.alt?.en) || !hasText(asset?.alt?.tr)) fail(`${label} requires non-empty English and Turkish alt text`);
    if (!asset?.safeArea
      || !Number.isInteger(asset.safeArea.left)
      || !Number.isInteger(asset.safeArea.right)
      || !Number.isInteger(asset.safeArea.top)
      || !Number.isInteger(asset.safeArea.bottom)
      || asset.safeArea.left < 0
      || asset.safeArea.right > 100
      || asset.safeArea.top < 0
      || asset.safeArea.bottom > 100
      || asset.safeArea.right - asset.safeArea.left < 70
      || asset.safeArea.bottom - asset.safeArea.top < 70) {
      fail(`${label}.safeArea must preserve horizontal and vertical 70% safe zones`);
    }
    if (!asset?.review || asset.review.generatedText !== false || asset.review.unlicensedMarks !== false || asset.review.personalData !== false || asset.review.rightsConfirmed !== true) fail(`${label}.review must explicitly clear unsafe generated text, marks, personal data, and rights`);
    if (asset?.placement === "hero" && asset?.loading !== "preload") fail(`${label} hero artwork must be preloaded`);
    if (["arrival", "dossier", "shortcut"].includes(asset?.placement) && asset?.loading !== "lazy") fail(`${label} editorial artwork must lazy-load`);
    if (["hero", "arrival", "social-card", "livestream"].includes(asset?.placement) && !(asset.width >= 2400 && asset.height >= 1350)) fail(`${label} landscape placement requires at least 2400 x 1350`);
    if (asset?.placement === "dossier" && !(asset.width >= 1350 && asset.height >= 1800)) fail(`${label} dossier placement requires a portrait master of at least 1350 x 1800`);
    if (asset?.loading === "preload" && Number.isInteger(asset?.bytes) && asset.bytes >= 1 && asset.bytes <= maxBytes) {
      preloadAssets += 1;
      preloadBytes += asset.bytes;
    }
  }

  if (pageArtworkBytes > maxPageArtworkBytes) fail(`combined artwork bytes must not exceed ${maxPageArtworkBytes}; split the delivery or defer non-critical assets`);
  else ok(`combined artwork payload is within the ${maxPageArtworkBytes}-byte page budget`);
  if (preloadAssets > maxPreloadAssets) fail(`at most ${maxPreloadAssets} artwork asset may preload`);
  if (preloadBytes > maxPreloadBytes) fail(`preloaded artwork bytes must not exceed ${maxPreloadBytes}`);
  else ok(`preloaded artwork payload is within the ${maxPreloadBytes}-byte critical-path budget`);

  for (const channel of ["socialCard", "livestream"]) {
    const handoff = manifest.handoff?.[channel];
    const expectedPlacement = channel === "socialCard" ? "social-card" : "livestream";
    if (!allowedHandoff.has(handoff?.status)) fail(`handoff.${channel}.status is invalid`);
    if (["REQUESTED", "DELIVERED"].includes(handoff?.status) && !hasText(handoff?.asset)) fail(`handoff.${channel} needs an asset filename when requested or delivered`);
    if (handoff?.status === "DELIVERED" && manifest.status !== "PENDING_REVIEW") fail(`handoff.${channel} cannot be DELIVERED until the intake has a pending independent review`);
    if (["NOT_REQUESTED", "HOLD"].includes(handoff?.status) && hasText(handoff?.asset)) fail(`handoff.${channel}.asset must be empty until the handoff is requested or delivered`);
    if (handoff?.asset && !filenames.has(handoff.asset.toLowerCase())) {
      fail(`handoff.${channel}.asset must name an asset in this manifest`);
    } else if (hasText(handoff?.asset)) {
      const referencedAsset = manifest.assets.find((asset) => asset?.filename?.toLowerCase() === handoff.asset.toLowerCase());
      if (referencedAsset?.placement !== expectedPlacement) fail(`handoff.${channel}.asset must use the ${expectedPlacement} placement, not ${referencedAsset?.placement ?? "an unknown"}`);
    }
  }
}

if (process.exitCode) console.error("\nArtwork intake remains HOLD. Correct the manifest before integrating any returned asset.");
else console.log("\nArtwork intake is internally consistent and remains non-publication guidance.");
