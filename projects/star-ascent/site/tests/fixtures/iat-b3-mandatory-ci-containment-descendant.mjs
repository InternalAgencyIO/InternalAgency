import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * BP03 structural descendant source only.  No child process, signal, wait,
 * heartbeat, leak, or zombie behavior is implemented or authorized here.
 */
export const BP03_SOURCE_ID = "DESCENDANT";
export const BP03_STRUCTURAL_SOURCE_ONLY = true;
export const BP03_DESCENDANT_EXECUTION_ENABLED = false;
export const BP03_DESCENDANT_STATUS = "HOLD_TEST";

export const BP03_DESCENDANT_CASE_IDS = Object.freeze([
  "DESCENDANT_RETAINED",
  "ZOMBIE_DESCENDANT",
]);

function isDirectExecution() {
  return process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  process.stderr.write(
    "IAT_B3_BP03_DESCENDANT_HOLD_TEST:STRUCTURAL_SOURCE_ONLY_NON_EVIDENCE\n",
  );
  process.exitCode = 2;
}
