import { PublicKey } from "@solana/web3.js";

export const IAT_V2_SENTINEL_PROGRAM_ID =
  "6T8qyz4ZSEK8x72hTK1c8rqvEfUX6zGbUsHDUUjpw6tY";
export const SWITCHBOARD_MAINNET_PROGRAM_ID =
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv";
export const SWITCHBOARD_DEVNET_PROGRAM_ID =
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export function validateDeployableProgramId(value) {
  let normalized;
  try {
    normalized = new PublicKey(value).toBase58();
  } catch {
    throw new Error("Program ID must be a canonical Solana public key");
  }
  if (
    [
      IAT_V2_SENTINEL_PROGRAM_ID,
      SWITCHBOARD_MAINNET_PROGRAM_ID,
      SWITCHBOARD_DEVNET_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
    ].includes(normalized)
  ) {
    throw new Error("Program ID is reserved or non-deployable");
  }
  return normalized;
}

export function bindProgramSource(source, programId) {
  const current = `declare_id!("${IAT_V2_SENTINEL_PROGRAM_ID}")`;
  if (source.split(current).length !== 2) {
    throw new Error("Program source is not at the one-time sentinel binding state");
  }
  return source.replace(current, `declare_id!("${programId}")`);
}

export function bindAnchorConfig(source, programId) {
  const expectedSections = ["localnet", "devnet", "mainnet"];
  let bound = source.replaceAll("\r\n", "\n");
  for (const section of expectedSections) {
    const current = `[programs.${section}]\niat_v2 = "${IAT_V2_SENTINEL_PROGRAM_ID}"`;
    if (bound.split(current).length !== 2) {
      throw new Error(`Anchor.toml ${section} program binding is not at the sentinel state`);
    }
    bound = bound.replace(current, `[programs.${section}]\niat_v2 = "${programId}"`);
  }
  return bound;
}

export function bindPolicyJson(source, programId) {
  const policy = JSON.parse(source);
  if (
    policy.program?.programId !== null
    || policy.program?.randomnessProgramId !== null
  ) {
    throw new Error("Policy program binding is not empty");
  }
  policy.program.programId = programId;
  policy.program.randomnessProgramId = SWITCHBOARD_MAINNET_PROGRAM_ID;
  return `${JSON.stringify(policy, null, 2)}\n`;
}

export function bindAllocationPlanJson(source, programId) {
  const plan = JSON.parse(source);
  if (
    plan.program?.programId !== null
    || plan.program?.randomnessProgramId !== null
  ) {
    throw new Error("Allocation-plan program binding is not empty");
  }
  plan.program.programId = programId;
  plan.program.randomnessProgramId = SWITCHBOARD_MAINNET_PROGRAM_ID;
  return `${JSON.stringify(plan, null, 2)}\n`;
}
