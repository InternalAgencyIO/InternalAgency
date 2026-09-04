import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * BP03 structural source only.  This module names the reviewed synthetic cases
 * but implements none of them.  The companion static test owns the strict v1
 * plan and binds these exact bytes as self-authored, non-evidence input.
 */
export const BP03_SOURCE_ID = "PRIMARY";
export const BP03_STRUCTURAL_SOURCE_ONLY = true;
export const BP03_FIXTURE_EXECUTION_ENABLED = false;
export const BP03_FIXTURE_STATUS = "HOLD_TEST";

export const BP03_CASE_IDS = Object.freeze([
  "TAP_PARTIAL_EOF",
  "TAP_FORGED_CASE_IDENTITY",
  "TAP_BAILOUT",
  "TAP_TRAILING_OR_DUPLICATE_STRUCTURE",
  "TAP_FORBIDDEN_DIRECTIVE_OR_SUMMARY",
  "EXECUTION_DEADLINE",
  "IGNORED_TERMINATION_AFTER_DEADLINE",
  "DESCENDANT_RETAINED",
  "ZOMBIE_DESCENDANT",
  "SUCCESS_PATH_INTERVENTION",
]);

function isDirectExecution() {
  return process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  process.stderr.write(
    "IAT_B3_BP03_FIXTURE_HOLD_TEST:STRUCTURAL_SOURCE_ONLY_NON_EVIDENCE\n",
  );
  process.exitCode = 2;
}
