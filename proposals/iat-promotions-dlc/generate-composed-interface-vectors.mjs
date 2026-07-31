/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Generates vectors for the held composed interface. It deliberately removes
 * only the obsolete v0 initializer verifier-key argument declared by the
 * amendment. It has no network, wallet, signer, or transaction capability.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { encodeInstruction } from "./program-interface-codec.mjs";

const PREVIEW_PATH = fileURLToPath(
  new URL("./program-interface-composition-preview.v1.json", import.meta.url),
);
const BASE_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-vectors.v0.json", import.meta.url),
);
const AMENDMENT_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-key-lifecycle-vectors.v1.json", import.meta.url),
);
const COMPOSED_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-composition-vectors.v1.json", import.meta.url),
);

const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];

function sourceVectorMap(baseVectors, amendmentVectors) {
  const map = new Map();
  for (const vector of [...baseVectors.vectors, ...amendmentVectors.vectors]) {
    if (map.has(vector.name)) throw new Error(`duplicate source vector: ${vector.name}`);
    map.set(vector.name, vector);
  }
  return map;
}

function composedData(instruction, sourceVector) {
  const expectedNames = instruction.data.map((field) => field.name);
  const missing = expectedNames.filter((name) => !(name in sourceVector.data));
  if (missing.length) throw new Error(`${instruction.name} source vector missing: ${missing.join(",")}`);
  const extras = Object.keys(sourceVector.data).filter((name) => !expectedNames.includes(name));
  const allowedExtras =
    instruction.name === "initialize_campaign" ? ["verifier_ed25519_key"] : [];
  if (JSON.stringify(extras) !== JSON.stringify(allowedExtras)) {
    throw new Error(`${instruction.name} unexpected source-vector fields: ${extras.join(",")}`);
  }
  return Object.fromEntries(expectedNames.map((name) => [name, sourceVector.data[name]]));
}

export function generateComposedInterfaceVectors({ preview, baseVectors, amendmentVectors }) {
  if (
    preview?.status?.deployable !== false ||
    preview?.status?.amendmentApplied !== false ||
    preview?.status?.compositionApplied !== false
  ) {
    throw new Error("composed vectors require a held, unapplied preview");
  }
  const sourceVectors = sourceVectorMap(baseVectors, amendmentVectors);
  if (sourceVectors.size !== preview.instructions.length) {
    throw new Error("source vector count does not match composed instructions");
  }
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-composed-interface-vectors-v1",
    status: {
      labels: STATUS_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      amendmentApplied: false,
      compositionApplied: false,
    },
    sources: [
      {
        path: "program-interface-composition-preview.v1.json",
        canonicalSha256: canonicalSha256(preview),
      },
      {
        path: "program-interface-vectors.v0.json",
        canonicalSha256: canonicalSha256(baseVectors),
      },
      {
        path: "program-interface-key-lifecycle-vectors.v1.json",
        canonicalSha256: canonicalSha256(amendmentVectors),
      },
    ],
    vectors: preview.instructions.map((instruction) => {
      const sourceVector = sourceVectors.get(instruction.name);
      if (!sourceVector) throw new Error(`${instruction.name} source vector missing`);
      const data = composedData(instruction, sourceVector);
      return {
        name: instruction.name,
        data,
        expectedHex: encodeInstruction(instruction.name, data, preview).toString("hex"),
      };
    }),
  };
}

export function loadComposedVectorBundle() {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  return {
    preview: parse(PREVIEW_PATH),
    baseVectors: parse(BASE_VECTORS_PATH),
    amendmentVectors: parse(AMENDMENT_VECTORS_PATH),
    composedVectors: parse(COMPOSED_VECTORS_PATH),
  };
}

export function renderComposedInterfaceVectors(bundle) {
  return `${JSON.stringify(generateComposedInterfaceVectors(bundle), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  const bundle = {
    preview: parse(PREVIEW_PATH),
    baseVectors: parse(BASE_VECTORS_PATH),
    amendmentVectors: parse(AMENDMENT_VECTORS_PATH),
  };
  const rendered = renderComposedInterfaceVectors(bundle);
  if (process.argv.includes("--write")) {
    writeFileSync(COMPOSED_VECTORS_PATH, rendered, "utf8");
    console.log("Wrote deterministic composed vectors; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
