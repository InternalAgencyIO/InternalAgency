/*
 * STAR ASCENT / $IAT ALLOCATION VALIDATOR SCAFFOLD
 * Version 0.1 — 27 July 2026
 *
 * DESIGN AND LOCAL TEST CODE ONLY. This module cannot connect to a wallet,
 * sign a transaction, broadcast a transaction, mint a token, or deploy code.
 * It accepts public identifiers and integer base-unit strings only.
 */

const BASE_UNITS = /^(0|[1-9][0-9]*)$/;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty public identifier`);
  }
  return value.trim();
}

function baseUnits(value, field, { allowZero = false } = {}) {
  if (typeof value !== "string" || !BASE_UNITS.test(value)) {
    throw new TypeError(`${field} must be a canonical integer base-unit string`);
  }
  const amount = BigInt(value);
  if (!allowZero && amount === 0n) {
    throw new RangeError(`${field} must be greater than zero`);
  }
  return amount;
}

export function validateAllocationManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("manifest must be an object");
  }

  const supply = baseUnits(manifest.supplyBaseUnits, "supplyBaseUnits");
  if (!Array.isArray(manifest.categories) || manifest.categories.length === 0) {
    throw new TypeError("categories must be a non-empty array");
  }

  const categoryIds = new Set();
  const recipientWallets = new Set();
  let manifestTotal = 0n;

  for (const [categoryIndex, category] of manifest.categories.entries()) {
    const categoryId = requiredText(category?.id, `categories[${categoryIndex}].id`);
    if (categoryIds.has(categoryId)) {
      throw new Error(`duplicate category id: ${categoryId}`);
    }
    categoryIds.add(categoryId);

    if (!Array.isArray(category.recipients) || category.recipients.length === 0) {
      throw new TypeError(`${categoryId}.recipients must be a non-empty array`);
    }

    let categoryTotal = 0n;
    for (const [recipientIndex, recipient] of category.recipients.entries()) {
      const wallet = requiredText(
        recipient?.publicWallet,
        `${categoryId}.recipients[${recipientIndex}].publicWallet`,
      );
      if (recipientWallets.has(wallet)) {
        throw new Error(`duplicate recipient wallet: ${wallet}`);
      }
      recipientWallets.add(wallet);
      categoryTotal += baseUnits(
        recipient?.amountBaseUnits,
        `${categoryId}.recipients[${recipientIndex}].amountBaseUnits`,
      );
    }

    const declaredTotal = baseUnits(category.totalBaseUnits, `${categoryId}.totalBaseUnits`);
    if (categoryTotal !== declaredTotal) {
      throw new Error(`${categoryId} recipient total does not match category total`);
    }
    manifestTotal += categoryTotal;
  }

  if (manifestTotal !== supply) {
    throw new Error("allocation total does not match supply");
  }

  return Object.freeze({
    categoryCount: categoryIds.size,
    recipientCount: recipientWallets.size,
    supplyBaseUnits: supply.toString(),
    totalBaseUnits: manifestTotal.toString(),
  });
}
