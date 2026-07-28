import { createHash } from "node:crypto";

const DISPLAY_MULTIPLIER = 1_000_000_000n;
const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const policyHash = (policy) => sha256(JSON.stringify(policy));
export const baseUnits = (displayUnits) => {
  if (!Number.isInteger(displayUnits) || displayUnits <= 0) throw new Error("display units must be a positive integer");
  return (BigInt(displayUnits) * DISPLAY_MULTIPLIER).toString();
};

export function validateRows(rows, maximumClaims) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("epoch requires at least one eligible row");
  if (rows.length > maximumClaims) throw new Error(`epoch has ${rows.length} rows, exceeding ${maximumClaims}`);
  const seen = new Set();
  for (const row of rows) {
    if (!base58.test(row.wallet ?? "")) throw new Error(`invalid public wallet: ${row.wallet}`);
    if (seen.has(row.wallet)) throw new Error(`duplicate wallet: ${row.wallet}`);
    seen.add(row.wallet);
    baseUnits(row.amountDisplayUnits);
  }
}

export function leafHash({ epoch, wallet, amountBaseUnits, policyHash: hash }) {
  return sha256(`star-ascent/iat-claim/v1|${epoch}|${wallet}|${amountBaseUnits}|${hash}`);
}

const parentHash = (left, right) => sha256(left < right ? `${left}${right}` : `${right}${left}`);

export function buildMerkle(leaves) {
  if (leaves.length === 0) throw new Error("cannot build a Merkle tree without leaves");
  let level = [...leaves].sort();
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) next.push(index + 1 < level.length ? parentHash(level[index], level[index + 1]) : level[index]);
    level = next;
    levels.push(level);
  }
  return { root: level[0], levels };
}

export function proofForLeaf(leaf, tree) {
  let target = leaf;
  const proof = [];
  for (const level of tree.levels.slice(0, -1)) {
    const index = level.indexOf(target);
    if (index < 0) throw new Error("leaf is absent from tree");
    const sibling = index % 2 === 0 ? level[index + 1] : level[index - 1];
    if (sibling) proof.push(sibling);
    target = sibling ? parentHash(target, sibling) : target;
  }
  return proof;
}

export function verifyProof({ leaf, proof, root }) {
  return proof.reduce((current, sibling) => parentHash(current, sibling), leaf) === root;
}

export function buildEpoch({ epoch, mint, policyHash: hash, rows, maximumClaims }) {
  validateRows(rows, maximumClaims);
  const claims = rows.map((row) => ({
    wallet: row.wallet,
    amountDisplayUnits: row.amountDisplayUnits,
    amountBaseUnits: baseUnits(row.amountDisplayUnits),
    sourcePostIds: [...new Set(row.sourcePostIds ?? [])].sort(),
  })).sort((a, b) => a.wallet.localeCompare(b.wallet));
  const leaves = claims.map((claim) => leafHash({ epoch, wallet: claim.wallet, amountBaseUnits: claim.amountBaseUnits, policyHash: hash }));
  const tree = buildMerkle(leaves);
  return {
    epoch,
    mint,
    policyHash: hash,
    eligibleWalletCount: claims.length,
    totalClaimableBaseUnits: claims.reduce((total, claim) => total + BigInt(claim.amountBaseUnits), 0n).toString(),
    merkleRoot: tree.root,
    claims: claims.map((claim, index) => ({ ...claim, leaf: leaves[index], merkleProof: proofForLeaf(leaves[index], tree) })),
  };
}
