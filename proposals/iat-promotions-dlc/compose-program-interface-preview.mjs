/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Deterministically composes the v0 interface and the unapplied verifier-key
 * lifecycle amendment. This module is network-free and cannot deploy, sign,
 * access a wallet, or construct a transaction.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE_PATH = fileURLToPath(new URL("./program-interface.v0.json", import.meta.url));
const AMENDMENT_PATH = fileURLToPath(
  new URL("./program-interface-key-lifecycle-amendment.v1.json", import.meta.url),
);
const BASE_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-vectors.v0.json", import.meta.url),
);
const AMENDMENT_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-key-lifecycle-vectors.v1.json", import.meta.url),
);
const PREVIEW_PATH = fileURLToPath(
  new URL("./program-interface-composition-preview.v1.json", import.meta.url),
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

const clone = (value) => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function exactIndex(items, predicate, description) {
  const indexes = items.flatMap((item, index) => (predicate(item) ? [index] : []));
  if (indexes.length !== 1) {
    throw new Error(`${description} must match exactly once; matched ${indexes.length}`);
  }
  return indexes[0];
}

function assertUnique(items, selector, description) {
  const values = items.map(selector);
  if (new Set(values).size !== values.length) {
    throw new Error(`${description} collision`);
  }
}

function tagged(entry, source, codecDomain) {
  return {
    ...clone(entry),
    compositionSource: source,
    codecDomain,
  };
}

function composeAccounts(base, amendment) {
  const accounts = base.accounts.map((account) =>
    tagged(account, "program-interface.v0.json", base.codec.discriminatorDomain),
  );
  const campaignIndex = exactIndex(
    accounts,
    (account) => account.name === "Campaign",
    "Campaign account",
  );
  const campaign = accounts[campaignIndex];
  const removal = amendment.baseInterfaceChanges.campaignFieldRemoval;
  const addition = amendment.baseInterfaceChanges.campaignFieldAddition;
  const fieldIndex = exactIndex(
    campaign.fields,
    (field) => field.name === removal.name && field.type === removal.type && field.sizeBytes === removal.sizeBytes,
    "Campaign inline verifier field",
  );
  if (addition.sizeBytes !== removal.sizeBytes) {
    throw new Error("Campaign field replacement must preserve size");
  }
  campaign.fields[fieldIndex] = clone(addition);

  accounts.push(
    ...amendment.accounts.map((account) =>
      tagged(
        account,
        "program-interface-key-lifecycle-amendment.v1.json",
        amendment.codec.discriminatorDomain,
      ),
    ),
  );
  assertUnique(accounts, (account) => account.name, "account name");
  assertUnique(accounts, (account) => account.discriminatorHex, "account discriminator");
  return accounts;
}

function composeInstructions(base, amendment) {
  const instructions = base.instructions.map((instruction) =>
    tagged(instruction, "program-interface.v0.json", base.codec.discriminatorDomain),
  );
  const changes = amendment.baseInterfaceChanges;
  const initializer = instructions[exactIndex(
    instructions,
    (instruction) => instruction.name === changes.initializerDataRemoval.instruction,
    "initializer instruction",
  )];
  const removedField = changes.initializerDataRemoval.field;
  const removedIndex = exactIndex(
    initializer.data,
    (field) => field.name === removedField.name && field.type === removedField.type,
    "initializer inline verifier argument",
  );
  initializer.data.splice(removedIndex, 1);

  for (const instructionName of changes.attestationInstructions) {
    const instruction = instructions[exactIndex(
      instructions,
      (candidate) => candidate.name === instructionName,
      `${instructionName} instruction`,
    )];
    const insertionIndex = exactIndex(
      instruction.accounts,
      (account) => account.name === changes.attestationAccountInsertionBefore,
      `${instructionName} account insertion point`,
    );
    const insertedAccounts = changes.requiredReadOnlyAccounts.map((name) => ({
      name,
      signer: false,
      writable: false,
    }));
    instruction.accounts.splice(insertionIndex, 0, ...insertedAccounts);
    instruction.guards.push(...changes.requiredAttestationGuards);
  }

  instructions.push(
    ...amendment.instructions.map((instruction) =>
      tagged(
        instruction,
        "program-interface-key-lifecycle-amendment.v1.json",
        amendment.codec.discriminatorDomain,
      ),
    ),
  );
  assertUnique(instructions, (instruction) => instruction.name, "instruction name");
  assertUnique(instructions, (instruction) => instruction.discriminatorHex, "instruction discriminator");
  return instructions;
}

function vectorNames(vectors) {
  return vectors.vectors.map((vector) => vector.name);
}

export function composeProgramInterfacePreview({ base, amendment, baseVectors, amendmentVectors }) {
  if (base.interfaceVersion !== amendment.baseInterfaceVersion) {
    throw new Error("base/amendment interface version mismatch");
  }
  if (amendment.status.amendmentApplied !== false || amendment.status.baseV0Deployable !== false) {
    throw new Error("composition requires unapplied amendment and held v0");
  }

  const accounts = composeAccounts(base, amendment);
  const instructions = composeInstructions(base, amendment);
  const expectedVectorNames = [
    ...base.instructions.map((instruction) => instruction.name),
    ...amendment.instructions.map((instruction) => instruction.name),
  ];
  const actualVectorNames = [...vectorNames(baseVectors), ...vectorNames(amendmentVectors)];
  if (JSON.stringify(actualVectorNames) !== JSON.stringify(expectedVectorNames)) {
    throw new Error("base/amendment vector coverage or order mismatch");
  }

  return {
    previewVersion: 1,
    previewId: "iat-promotions-dlc-composed-interface-v1-preview",
    status: {
      labels: STATUS_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      baseV0Deployable: false,
      amendmentApplied: false,
      compositionApplied: false,
    },
    compositionSources: [
      {
        path: "program-interface.v0.json",
        canonicalSha256: canonicalSha256(base),
      },
      {
        path: "program-interface-key-lifecycle-amendment.v1.json",
        canonicalSha256: canonicalSha256(amendment),
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
    codec: {
      discriminatorBytes: 8,
      integerEndian: "little",
      variableLengthFields: false,
      domains: [base.codec.discriminatorDomain, amendment.codec.discriminatorDomain],
    },
    economics: clone(base.economics),
    vaultBoundary: clone(base.vaultBoundary),
    accounts,
    instructions,
    events: clone(amendment.events),
    forbiddenCapabilities: [...new Set([
      ...base.forbiddenCapabilities,
      ...amendment.forbiddenCapabilities,
    ])],
    unresolvedReviewGates: clone(amendment.reviewGate),
  };
}

export function loadCompositionBundle() {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  return {
    base: parse(BASE_PATH),
    amendment: parse(AMENDMENT_PATH),
    baseVectors: parse(BASE_VECTORS_PATH),
    amendmentVectors: parse(AMENDMENT_VECTORS_PATH),
    preview: parse(PREVIEW_PATH),
    composedVectors: parse(COMPOSED_VECTORS_PATH),
  };
}

export function renderProgramInterfacePreview(bundle) {
  return `${JSON.stringify(composeProgramInterfacePreview(bundle), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  const bundle = {
    base: parse(BASE_PATH),
    amendment: parse(AMENDMENT_PATH),
    baseVectors: parse(BASE_VECTORS_PATH),
    amendmentVectors: parse(AMENDMENT_VECTORS_PATH),
  };
  const rendered = renderProgramInterfacePreview(bundle);
  if (process.argv.includes("--write")) {
    writeFileSync(PREVIEW_PATH, rendered, "utf8");
    console.log("Wrote deterministic composed-interface preview; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
