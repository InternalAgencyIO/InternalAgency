#ifndef IAT_B3_CONTAINMENT_H
#define IAT_B3_CONTAINMENT_H

#include <stddef.h>
#include <stdint.h>

#define IAT_B3_CONTAINMENT_PROTOCOL "iat-b3-mandatory-ci-containment/v1"
#define IAT_B3_READY_FRAME "IAT_B3_CONTAINMENT_READY_V1"
#define IAT_B3_FINAL_FRAME "IAT_B3_CONTAINMENT_FINAL_V1"
#define IAT_B3_STARTUP_DEADLINE_MS 10000ULL
#define IAT_B3_DEFAULT_EXECUTION_DEADLINE_MS 120000ULL
#define IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS 180000ULL
#define IAT_B3_FINALIZATION_DEADLINE_MS 5000ULL
#define IAT_B3_TEARDOWN_OBSERVATION_DEADLINE_MS 15000ULL
#define IAT_B3_PARENT_GUARD_MS 5000ULL
#define IAT_B3_DEFAULT_OUTER_DEADLINE_MS 155000ULL
#define IAT_B3_ALL_FEATURE_OUTER_DEADLINE_MS 215000ULL
#define IAT_B3_STREAM_CAP_BYTES (64ULL * 1024ULL * 1024ULL)
#define IAT_B3_DIAGNOSTIC_EDGE_BYTES 2048U
#define IAT_B3_CONTROL_FD 3
#define IAT_B3_PHASE_A_EXECUTION_ENABLED 0
#define IAT_B3_CANONICAL_TAP_MANIFEST_BOUND 1
#define IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE 0
#define IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND 0
#define IAT_B3_CANONICAL_TAP_SOURCE_PATH \
  "tests/iat-b3-mandatory-ci-containment.test.mjs"
#define IAT_B3_CANONICAL_TAP_SOURCE_SHA256 \
  "437571821a14eb60de550bac204b2f8e3885766760a30f32296db57076df2813"
#define IAT_B3_CANONICAL_TAP_SOURCE_BYTES 18044ULL
#define IAT_B3_CANONICAL_TAP_ORDERED_NAMES_SHA256 \
  "7262d1251645ce869697b6afc6aa446951c3f72184b14a772a4fa2553c846e33"
#define IAT_B3_CANONICAL_TAP_ORDERED_NAMES_JSON_BYTES 1855U
#define IAT_B3_CANONICAL_TAP_CASE_COUNT 30U
#define IAT_B3_CANONICAL_TAP_VERSION_LINE "TAP version 13"
#define IAT_B3_CANONICAL_TAP_PLAN_LINE "1..30"
#define IAT_B3_CANONICAL_TAP_SUMMARY_LINE_COUNT 8U
#define IAT_B3_CANONICAL_TAP_PLAN_LINE_FROM_EOF 9U
#define IAT_B3_CANONICAL_TAP_SUBTEST_PREFIX "# Subtest: "
#define IAT_B3_CANONICAL_TAP_OK_PREFIX "ok "
#define IAT_B3_CANONICAL_TAP_SUMMARY_TESTS "# tests 30"
#define IAT_B3_CANONICAL_TAP_SUMMARY_SUITES "# suites 0"
#define IAT_B3_CANONICAL_TAP_SUMMARY_PASS "# pass 30"
#define IAT_B3_CANONICAL_TAP_SUMMARY_FAIL "# fail 0"
#define IAT_B3_CANONICAL_TAP_SUMMARY_CANCELLED "# cancelled 0"
#define IAT_B3_CANONICAL_TAP_SUMMARY_SKIPPED "# skipped 0"
#define IAT_B3_CANONICAL_TAP_SUMMARY_TODO "# todo 0"
#define IAT_B3_CANONICAL_TAP_SUMMARY_DURATION_PREFIX "# duration_ms "
#define IAT_B3_CANONICAL_TAP_DIRECTIVES_ALLOWED 0
#define IAT_B3_CANONICAL_TAP_BAILOUT_ALLOWED 0
#define IAT_B3_CANONICAL_TAP_TRAILING_LINES_ALLOWED 0
#define IAT_B3_CANONICAL_TAP_ARG_TEST "--test"
#define IAT_B3_CANONICAL_TAP_ARG_REPORTER "--test-reporter=tap"
#define IAT_B3_CANONICAL_TAP_ARG_CONCURRENCY "--test-concurrency=1"
#define IAT_B3_GIT_OBJECT_HEX_LENGTH 40U
#define IAT_B3_SHA256_HEX_LENGTH 64U
#define IAT_B3_EXIT_PASS 0
#define IAT_B3_EXIT_INTERNAL 1
#define IAT_B3_EXIT_HOLD 2

#ifndef IAT_B3_CONTAINMENT_CONTRACT_SHA256
#define IAT_B3_CONTAINMENT_CONTRACT_SHA256 "UNBOUND_CONTRACT"
#endif

typedef enum iat_b3_outcome {
  IAT_B3_OUTCOME_PASS = 0,
  IAT_B3_OUTCOME_TIMEOUT,
  IAT_B3_OUTCOME_OUTPUT_LIMIT,
  IAT_B3_OUTCOME_SPAWN_ERROR,
  IAT_B3_OUTCOME_SIGNAL,
  IAT_B3_OUTCOME_NONZERO,
  IAT_B3_OUTCOME_INCOMPLETE_TAP,
  IAT_B3_OUTCOME_CONTAINMENT_HOLD,
  IAT_B3_OUTCOME_INTERNAL_HOLD
} iat_b3_outcome;

typedef struct iat_b3_sha256 {
  uint32_t state[8];
  uint64_t total_bytes;
  unsigned char block[64];
  size_t block_length;
  int failed;
} iat_b3_sha256;

typedef struct iat_b3_stream_observation {
  uint64_t bytes_observed;
  unsigned char digest[32];
  unsigned char prefix[IAT_B3_DIAGNOSTIC_EDGE_BYTES];
  unsigned char tail[IAT_B3_DIAGNOSTIC_EDGE_BYTES];
  size_t prefix_length;
  size_t tail_length;
  int cap_exceeded;
  iat_b3_sha256 sha;
} iat_b3_stream_observation;

typedef struct iat_b3_config {
  uint64_t startup_deadline_ms;
  uint64_t execution_deadline_ms;
  uint64_t finalization_deadline_ms;
  uint64_t teardown_observation_deadline_ms;
  uint64_t stdout_cap_bytes;
  uint64_t stderr_cap_bytes;
  int control_fd;
  int child_argc;
  char **child_argv;
} iat_b3_config;

typedef struct iat_b3_result {
  iat_b3_outcome outcome;
  int root_terminal_observed;
  int root_exit_code;
  int root_signal;
  int direct_child_reaped;
  int containment_empty;
  int descendant_leak_observed;
  int workload_resumed;
  int intervention_used;
  int startup_deadline_expired;
  int execution_deadline_expired;
  int finalization_deadline_expired;
  int teardown_deadline_expired;
  int strict_tap_validated;
  int protocol_validated;
  int absence_proof_observed;
  uint64_t zombie_descendant_count;
  uint64_t elapsed_ms;
  iat_b3_stream_observation stdout_observation;
  iat_b3_stream_observation stderr_observation;
} iat_b3_result;

void iat_b3_sha256_init(iat_b3_sha256 *context);
void iat_b3_sha256_update(iat_b3_sha256 *context, const unsigned char *data,
                          size_t length);
void iat_b3_sha256_final(iat_b3_sha256 *context, unsigned char digest[32]);

void iat_b3_stream_init(iat_b3_stream_observation *observation);
void iat_b3_stream_update(iat_b3_stream_observation *observation,
                          const unsigned char *data, size_t length,
                          uint64_t cap_bytes);
void iat_b3_stream_finish(iat_b3_stream_observation *observation);
int iat_b3_parse_config(int argc, char **argv, iat_b3_config *config,
                        const char **error_code);
int iat_b3_is_lower_hex_git_object(const char *text);
int iat_b3_is_lower_hex_sha256(const char *text);
int iat_b3_validate_config(const iat_b3_config *config);
int iat_b3_validate_result_invariants(const iat_b3_config *config,
                                      const iat_b3_result *result);
uint64_t iat_b3_monotonic_ms(void);
int iat_b3_write_all(int fd, const void *data, size_t length);
int iat_b3_emit_ready_frame(const iat_b3_config *config);
int iat_b3_emit_final_frame(const iat_b3_config *config,
                            const iat_b3_result *result);
const char *iat_b3_outcome_name(iat_b3_outcome outcome);
int iat_b3_validate_tap_transcript(const unsigned char *bytes, size_t length,
                                   const char **error_code);
int iat_b3_platform_run(const iat_b3_config *config, iat_b3_result *result);

#endif
