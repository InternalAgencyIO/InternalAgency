#if !defined(_WIN32)
#define _POSIX_C_SOURCE 200809L
#endif

#include "iat_b3_containment.h"

#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(_WIN32)
#include <io.h>
#else
#include <time.h>
#include <unistd.h>
#endif

static int parse_u64(const char *text, uint64_t *value) {
  const unsigned char *cursor = (const unsigned char *)text;
  uint64_t parsed = 0;
  if (text == NULL || value == NULL || *cursor == '\0') return 0;
  if (cursor[0] == '0' && cursor[1] != '\0') return 0;
  while (*cursor != '\0') {
    unsigned digit;
    if (*cursor < '0' || *cursor > '9') return 0;
    digit = (unsigned)(*cursor - '0');
    if (parsed > (UINT64_MAX - digit) / 10ULL) return 0;
    parsed = parsed * 10ULL + digit;
    cursor += 1;
  }
  *value = parsed;
  return 1;
}

void iat_b3_stream_init(iat_b3_stream_observation *observation) {
  if (observation == NULL) return;
  memset(observation, 0, sizeof(*observation));
  iat_b3_sha256_init(&observation->sha);
}

void iat_b3_stream_update(iat_b3_stream_observation *observation,
                          const unsigned char *data, size_t length,
                          uint64_t cap_bytes) {
  size_t prefix_room;
  size_t prefix_copy;
  size_t tail_copy;
  uint64_t new_total;
  if (observation == NULL) return;
  if (data == NULL && length != 0U) {
    observation->sha.failed = 1;
    observation->cap_exceeded = 1;
    return;
  }
  if (UINT64_MAX - observation->bytes_observed < (uint64_t)length) {
    observation->sha.failed = 1;
    observation->cap_exceeded = 1;
    return;
  }
  new_total = observation->bytes_observed + (uint64_t)length;
  iat_b3_sha256_update(&observation->sha, data, length);
  prefix_room = IAT_B3_DIAGNOSTIC_EDGE_BYTES - observation->prefix_length;
  prefix_copy = length < prefix_room ? length : prefix_room;
  if (prefix_copy > 0) {
    memcpy(observation->prefix + observation->prefix_length, data, prefix_copy);
    observation->prefix_length += prefix_copy;
  }
  tail_copy = length < IAT_B3_DIAGNOSTIC_EDGE_BYTES
                  ? length
                  : IAT_B3_DIAGNOSTIC_EDGE_BYTES;
  if (tail_copy == length && observation->tail_length + tail_copy <=
                                 IAT_B3_DIAGNOSTIC_EDGE_BYTES) {
    memcpy(observation->tail + observation->tail_length, data, tail_copy);
    observation->tail_length += tail_copy;
  } else {
    size_t keep = IAT_B3_DIAGNOSTIC_EDGE_BYTES - tail_copy;
    if (keep > observation->tail_length) keep = observation->tail_length;
    if (keep > 0)
      memmove(observation->tail,
              observation->tail + observation->tail_length - keep, keep);
    memcpy(observation->tail + keep, data + length - tail_copy, tail_copy);
    observation->tail_length = keep + tail_copy;
  }
  observation->bytes_observed = new_total;
  if (new_total > cap_bytes) observation->cap_exceeded = 1;
}

void iat_b3_stream_finish(iat_b3_stream_observation *observation) {
  if (observation == NULL) return;
  iat_b3_sha256_final(&observation->sha, observation->digest);
}

int iat_b3_parse_config(int argc, char **argv, iat_b3_config *config,
                        const char **error_code) {
  int index = 1;
  uint64_t parsed = 0;
  if (config == NULL || error_code == NULL || argv == NULL || argc < 1) {
    return 0;
  }
  memset(config, 0, sizeof(*config));
  config->startup_deadline_ms = IAT_B3_STARTUP_DEADLINE_MS;
  config->execution_deadline_ms = IAT_B3_DEFAULT_EXECUTION_DEADLINE_MS;
  config->finalization_deadline_ms = IAT_B3_FINALIZATION_DEADLINE_MS;
  config->teardown_observation_deadline_ms =
      IAT_B3_TEARDOWN_OBSERVATION_DEADLINE_MS;
  config->stdout_cap_bytes = IAT_B3_STREAM_CAP_BYTES;
  config->stderr_cap_bytes = IAT_B3_STREAM_CAP_BYTES;
  config->control_fd = IAT_B3_CONTROL_FD;
#define REQUIRE_FIXED(name, field, exact)                                    \
  do {                                                                        \
    if (index + 1 >= argc || strcmp(argv[index], name) != 0 ||               \
        !parse_u64(argv[index + 1], &parsed) ||                              \
        parsed != (uint64_t)(exact)) {                                       \
      *error_code = "MISSING_DUPLICATE_UNKNOWN_REORDERED_OR_RANGE_HOLD";     \
      return 0;                                                               \
    }                                                                         \
    config->field = parsed;                                                    \
    index += 2;                                                               \
  } while (0)
  REQUIRE_FIXED("--startup-ms", startup_deadline_ms,
                IAT_B3_STARTUP_DEADLINE_MS);
  if (index + 1 >= argc || strcmp(argv[index], "--execution-ms") != 0 ||
      !parse_u64(argv[index + 1], &parsed) ||
      (parsed != IAT_B3_DEFAULT_EXECUTION_DEADLINE_MS &&
       parsed != IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS)) {
    *error_code = "MISSING_DUPLICATE_UNKNOWN_REORDERED_OR_RANGE_HOLD";
    return 0;
  }
  config->execution_deadline_ms = parsed;
  index += 2;
  REQUIRE_FIXED("--finalization-ms", finalization_deadline_ms,
                IAT_B3_FINALIZATION_DEADLINE_MS);
  REQUIRE_FIXED("--teardown-ms", teardown_observation_deadline_ms,
                IAT_B3_TEARDOWN_OBSERVATION_DEADLINE_MS);
  REQUIRE_FIXED("--stdout-cap", stdout_cap_bytes, IAT_B3_STREAM_CAP_BYTES);
  REQUIRE_FIXED("--stderr-cap", stderr_cap_bytes, IAT_B3_STREAM_CAP_BYTES);
#undef REQUIRE_FIXED
  if (index >= argc || strcmp(argv[index], "--") != 0) {
    *error_code = "CHILD_COMMAND_SEPARATOR_REQUIRED";
    return 0;
  }
  index += 1;
  config->child_argc = argc - index;
  config->child_argv = argv + index;
  if (config->child_argc < 1) {
    *error_code = "CHILD_COMMAND_REQUIRED";
    return 0;
  }
  *error_code = NULL;
  return iat_b3_validate_config(config);
}

static int is_lower_hex_exact(const char *text, size_t length) {
  size_t index;
  if (text == NULL) return 0;
  for (index = 0; index < length; ++index) {
    unsigned char value = (unsigned char)text[index];
    if (!((value >= '0' && value <= '9') ||
          (value >= 'a' && value <= 'f'))) return 0;
  }
  return text[length] == '\0';
}

int iat_b3_is_lower_hex_git_object(const char *text) {
  return is_lower_hex_exact(text, IAT_B3_GIT_OBJECT_HEX_LENGTH);
}

int iat_b3_is_lower_hex_sha256(const char *text) {
  return is_lower_hex_exact(text, IAT_B3_SHA256_HEX_LENGTH);
}

int iat_b3_validate_config(const iat_b3_config *config) {
  if (config == NULL) return 0;
  return config->startup_deadline_ms == IAT_B3_STARTUP_DEADLINE_MS &&
         (config->execution_deadline_ms ==
              IAT_B3_DEFAULT_EXECUTION_DEADLINE_MS ||
          config->execution_deadline_ms ==
              IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS) &&
         config->finalization_deadline_ms ==
             IAT_B3_FINALIZATION_DEADLINE_MS &&
         config->teardown_observation_deadline_ms ==
             IAT_B3_TEARDOWN_OBSERVATION_DEADLINE_MS &&
         config->stdout_cap_bytes == IAT_B3_STREAM_CAP_BYTES &&
         config->stderr_cap_bytes == IAT_B3_STREAM_CAP_BYTES &&
         config->control_fd == IAT_B3_CONTROL_FD &&
         config->child_argc > 0 && config->child_argv != NULL;
}

static int is_boolean(int value) { return value == 0 || value == 1; }

static int stream_invariants(const iat_b3_stream_observation *observation,
                             uint64_t cap_bytes) {
  static const unsigned char empty_sha256[32] = {
      0xe3U, 0xb0U, 0xc4U, 0x42U, 0x98U, 0xfcU, 0x1cU, 0x14U,
      0x9aU, 0xfbU, 0xf4U, 0xc8U, 0x99U, 0x6fU, 0xb9U, 0x24U,
      0x27U, 0xaeU, 0x41U, 0xe4U, 0x64U, 0x9bU, 0x93U, 0x4cU,
      0xa4U, 0x95U, 0x99U, 0x1bU, 0x78U, 0x52U, 0xb8U, 0x55U};
  size_t expected_edge;
  if (observation == NULL || observation->sha.failed ||
      observation->prefix_length > IAT_B3_DIAGNOSTIC_EDGE_BYTES ||
      observation->tail_length > IAT_B3_DIAGNOSTIC_EDGE_BYTES ||
      !is_boolean(observation->cap_exceeded) ||
      observation->bytes_observed > cap_bytes * 2ULL ||
      (observation->bytes_observed == 0ULL &&
       memcmp(observation->digest, empty_sha256, sizeof(empty_sha256)) != 0)) {
    return 0;
  }
  expected_edge = observation->bytes_observed < IAT_B3_DIAGNOSTIC_EDGE_BYTES
                      ? (size_t)observation->bytes_observed
                      : IAT_B3_DIAGNOSTIC_EDGE_BYTES;
  return observation->prefix_length == expected_edge &&
         observation->tail_length == expected_edge &&
         observation->cap_exceeded ==
             (observation->bytes_observed > cap_bytes ? 1 : 0);
}

int iat_b3_validate_result_invariants(const iat_b3_config *config,
                                      const iat_b3_result *result) {
  int outcome_value;
  uint64_t outer_deadline;
  if (!IAT_B3_CANONICAL_TAP_MANIFEST_BOUND ||
      !IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE ||
      !IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND ||
      !iat_b3_validate_config(config) || result == NULL ||
      !iat_b3_is_lower_hex_sha256(IAT_B3_CONTAINMENT_CONTRACT_SHA256)) {
    return 0;
  }
  outcome_value = (int)result->outcome;
  if (outcome_value < (int)IAT_B3_OUTCOME_PASS ||
      outcome_value > (int)IAT_B3_OUTCOME_INTERNAL_HOLD ||
      !is_boolean(result->root_terminal_observed) ||
      !is_boolean(result->direct_child_reaped) ||
      !is_boolean(result->containment_empty) ||
      !is_boolean(result->descendant_leak_observed) ||
      !is_boolean(result->workload_resumed) ||
      !is_boolean(result->intervention_used) ||
      !is_boolean(result->startup_deadline_expired) ||
      !is_boolean(result->execution_deadline_expired) ||
      !is_boolean(result->finalization_deadline_expired) ||
      !is_boolean(result->teardown_deadline_expired) ||
      !is_boolean(result->strict_tap_validated) ||
      !is_boolean(result->protocol_validated) ||
      !is_boolean(result->absence_proof_observed) ||
      result->root_exit_code < -1 ||
      result->root_signal < 0 || result->root_signal > 255 ||
      result->zombie_descendant_count > 1000000ULL ||
      !stream_invariants(&result->stdout_observation,
                         config->stdout_cap_bytes) ||
      !stream_invariants(&result->stderr_observation,
                         config->stderr_cap_bytes)) {
    return 0;
  }
  outer_deadline = config->execution_deadline_ms ==
                           IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS
                       ? IAT_B3_ALL_FEATURE_OUTER_DEADLINE_MS
                       : IAT_B3_DEFAULT_OUTER_DEADLINE_MS;
  if (result->elapsed_ms > outer_deadline) return 0;
  if ((!result->root_terminal_observed &&
       (result->root_exit_code != -1 || result->root_signal != 0)) ||
      (result->root_terminal_observed && result->root_signal == 0 &&
       result->root_exit_code < 0) ||
      (result->root_terminal_observed && result->root_signal > 0 &&
       result->root_exit_code != -1) ||
      (result->direct_child_reaped && !result->root_terminal_observed) ||
      (result->containment_empty &&
       (!result->direct_child_reaped || result->descendant_leak_observed ||
        result->zombie_descendant_count != 0 ||
        !result->absence_proof_observed)) ||
      (result->absence_proof_observed && !result->containment_empty) ||
      (result->strict_tap_validated &&
       (!result->root_terminal_observed || result->root_exit_code != 0 ||
        result->root_signal != 0)) ||
      (result->startup_deadline_expired && result->workload_resumed) ||
      (result->execution_deadline_expired && !result->workload_resumed) ||
      (result->teardown_deadline_expired &&
       result->absence_proof_observed)) {
    return 0;
  }
  switch (result->outcome) {
    case IAT_B3_OUTCOME_PASS:
      /* The admitted Phase-A control parser rejects PASS categorically. */
      return 0;
    case IAT_B3_OUTCOME_TIMEOUT:
      return result->execution_deadline_expired;
    case IAT_B3_OUTCOME_OUTPUT_LIMIT:
      return result->stdout_observation.cap_exceeded ||
             result->stderr_observation.cap_exceeded;
    case IAT_B3_OUTCOME_SIGNAL:
      return result->root_terminal_observed && result->root_exit_code == -1 &&
             result->root_signal > 0;
    case IAT_B3_OUTCOME_NONZERO:
      return result->root_terminal_observed && result->root_exit_code > 0 &&
             result->root_signal == 0;
    case IAT_B3_OUTCOME_INCOMPLETE_TAP:
      return !result->strict_tap_validated;
    case IAT_B3_OUTCOME_SPAWN_ERROR:
      return !result->workload_resumed &&
             !result->root_terminal_observed;
    case IAT_B3_OUTCOME_CONTAINMENT_HOLD:
    case IAT_B3_OUTCOME_INTERNAL_HOLD:
      return 1;
  }
  return 0;
}

int iat_b3_write_all(int fd, const void *data, size_t length) {
  const unsigned char *cursor = (const unsigned char *)data;
  while (length > 0) {
#if defined(_WIN32)
    int written = _write(fd, cursor,
                         length > (size_t)INT_MAX ? INT_MAX : (unsigned)length);
#else
    ssize_t written = write(fd, cursor, length);
#endif
    if (written < 0 && errno == EINTR) continue;
    if (written <= 0) return 0;
    cursor += (size_t)written;
    length -= (size_t)written;
  }
  return 1;
}

static void hex_digest(const unsigned char digest[32], char output[65]) {
  static const char digits[] = "0123456789abcdef";
  size_t index;
  for (index = 0; index < 32U; ++index) {
    output[index * 2U] = digits[digest[index] >> 4U];
    output[index * 2U + 1U] = digits[digest[index] & 0x0fU];
  }
  output[64] = '\0';
}

int iat_b3_emit_ready_frame(const iat_b3_config *config) {
  char frame[512];
  int length;
  if (!IAT_B3_CANONICAL_TAP_MANIFEST_BOUND ||
      !IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE ||
      !IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND ||
      !iat_b3_validate_config(config) ||
      !iat_b3_is_lower_hex_sha256(IAT_B3_CONTAINMENT_CONTRACT_SHA256)) {
    return 0;
  }
  length = snprintf(
      frame, sizeof(frame),
      IAT_B3_READY_FRAME
      " protocol=%s contract=%s startup=%llu execution=%llu finalization=%llu teardown=%llu\n",
      IAT_B3_CONTAINMENT_PROTOCOL, IAT_B3_CONTAINMENT_CONTRACT_SHA256,
      (unsigned long long)config->startup_deadline_ms,
      (unsigned long long)config->execution_deadline_ms,
      (unsigned long long)config->finalization_deadline_ms,
      (unsigned long long)config->teardown_observation_deadline_ms);
  return length > 0 && (size_t)length < sizeof(frame) &&
         iat_b3_write_all(config->control_fd, frame, (size_t)length);
}

int iat_b3_emit_final_frame(const iat_b3_config *config,
                            const iat_b3_result *result) {
  char stdout_sha[65], stderr_sha[65], frame[1024];
  int length;
  if (!iat_b3_validate_result_invariants(config, result)) return 0;
  hex_digest(result->stdout_observation.digest, stdout_sha);
  hex_digest(result->stderr_observation.digest, stderr_sha);
  length = snprintf(
      frame, sizeof(frame),
      IAT_B3_FINAL_FRAME
      " protocol=%s contract=%s outcome=%s elapsed=%llu rootTerminal=%d rootExit=%d rootSignal=%d reaped=%d empty=%d leak=%d zombies=%llu resumed=%d intervention=%d startupExpired=%d executionExpired=%d finalizationExpired=%d teardownExpired=%d strictTap=%d protocolValid=%d absence=%d stdoutBytes=%llu stdoutSha256=%s stdoutTruncated=%d stderrBytes=%llu stderrSha256=%s stderrTruncated=%d\n",
      IAT_B3_CONTAINMENT_PROTOCOL, IAT_B3_CONTAINMENT_CONTRACT_SHA256,
      iat_b3_outcome_name(result->outcome),
      (unsigned long long)result->elapsed_ms,
      result->root_terminal_observed, result->root_exit_code,
      result->root_signal, result->direct_child_reaped,
      result->containment_empty, result->descendant_leak_observed,
      (unsigned long long)result->zombie_descendant_count,
      result->workload_resumed, result->intervention_used,
      result->startup_deadline_expired, result->execution_deadline_expired,
      result->finalization_deadline_expired, result->teardown_deadline_expired,
      result->strict_tap_validated, result->protocol_validated,
      result->absence_proof_observed,
      (unsigned long long)result->stdout_observation.bytes_observed, stdout_sha,
      result->stdout_observation.cap_exceeded,
      (unsigned long long)result->stderr_observation.bytes_observed, stderr_sha,
      result->stderr_observation.cap_exceeded);
  return length > 0 && (size_t)length < sizeof(frame) &&
         iat_b3_write_all(config->control_fd, frame, (size_t)length);
}

const char *iat_b3_outcome_name(iat_b3_outcome outcome) {
  static const char *names[] = {"PASS", "TIMEOUT", "OUTPUT_LIMIT",
                                "SPAWN_ERROR", "SIGNAL", "NONZERO",
                                "INCOMPLETE_TAP", "CONTAINMENT_HOLD",
                                "INTERNAL_HOLD"};
  return outcome >= IAT_B3_OUTCOME_PASS && outcome <= IAT_B3_OUTCOME_INTERNAL_HOLD
             ? names[(unsigned)outcome]
             : "INTERNAL_HOLD";
}

uint64_t iat_b3_monotonic_ms(void) {
#if defined(_WIN32)
  extern uint64_t iat_b3_windows_monotonic_ms(void);
  return iat_b3_windows_monotonic_ms();
#else
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return 0;
  return (uint64_t)now.tv_sec * 1000ULL + (uint64_t)now.tv_nsec / 1000000ULL;
#endif
}
