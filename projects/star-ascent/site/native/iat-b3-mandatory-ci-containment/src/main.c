#include "iat_b3_containment.h"

#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
#if !IAT_B3_PHASE_A_EXECUTION_ENABLED
  (void)argc;
  (void)argv;
  fputs("IAT_B3_CONTAINMENT_PHASE_A_HARD_DISABLED_HOLD\n", stderr);
  return IAT_B3_EXIT_HOLD;
#else
  iat_b3_config config;
  iat_b3_result result;
  const char *error_code = NULL;
  int platform_status;
  if (!iat_b3_parse_config(argc, argv, &config, &error_code)) {
    fprintf(stderr, "IAT_B3_CONTAINMENT_ARGUMENT_HOLD:%s\n",
            error_code == NULL ? "UNCLASSIFIED" : error_code);
    return IAT_B3_EXIT_HOLD;
  }
  memset(&result, 0, sizeof(result));
  result.outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD;
  result.root_exit_code = -1;
  iat_b3_stream_init(&result.stdout_observation);
  iat_b3_stream_init(&result.stderr_observation);
  if (!iat_b3_emit_ready_frame(&config)) return IAT_B3_EXIT_HOLD;
  platform_status = iat_b3_platform_run(&config, &result);
  iat_b3_stream_finish(&result.stdout_observation);
  iat_b3_stream_finish(&result.stderr_observation);
  if (platform_status != 0 || result.outcome != IAT_B3_OUTCOME_PASS ||
      !result.root_terminal_observed || !result.direct_child_reaped ||
      !result.containment_empty || result.descendant_leak_observed ||
      result.zombie_descendant_count != 0 || !result.workload_resumed ||
      result.intervention_used || result.startup_deadline_expired ||
      result.execution_deadline_expired || result.finalization_deadline_expired ||
      result.teardown_deadline_expired || !result.strict_tap_validated ||
      !result.protocol_validated || !result.absence_proof_observed) {
    result.outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD;
  }
  if (!iat_b3_validate_result_invariants(&config, &result)) {
    return IAT_B3_EXIT_HOLD;
  }
  if (!iat_b3_emit_final_frame(&config, &result)) return IAT_B3_EXIT_INTERNAL;
  if (result.outcome != IAT_B3_OUTCOME_PASS) return IAT_B3_EXIT_HOLD;
  return IAT_B3_EXIT_PASS;
#endif
}
