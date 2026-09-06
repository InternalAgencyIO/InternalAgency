#include "iat_b3_containment.h"

#include <string.h>

/* Exact order recovered only from the admitted, hash-bound native test file. */
static const char *const canonical_case_names[] = {
    "timing contract fixes startup, execution, finalization, teardown, and outer ceilings",
    "source closure contains exactly the approved 17 paths",
    "source closure directly hashes every approved current file",
    "checked-in null toolchain policy remains HOLD",
    "40-hex Git head and tree are distinct from 64-hex artifact digests",
    "wrong-length Git object IDs fail closed",
    "build authorization is a conjunction and Phase A still hard-disables it",
    "hard-disable returns before an injected executor or output root is touched",
    "build CLI grammar has no override or output-path surface",
    "build preflight CLI is an exact machine HOLD",
    "compile recipes retain strict flags and remove the mismatched municode entry",
    "build environment is exact and excludes inherited loader/network variables",
    "canonical JSON is deterministic and integer-only",
    "strict JSON parsing rejects duplicate keys at every depth",
    "PE parser rejects malformed bytes",
    "PE structural parse cannot claim final policy validation in Phase A",
    "ELF parser rejects malformed bytes",
    "ELF structural parse cannot claim final policy validation in Phase A",
    "receipt exact schema rejects unknown semantic fields",
    "receipt validates Git and artifact digest lengths independently",
    "receipt rejects a self-rehashed semantic mutation",
    "receipt requires complete direct artifact and log paths",
    "receipt remains observer-owned HOLD even when structural fields are coherent",
    "exact HOLD control frames parse with complete exact keys",
    "control frames reject duplicate and unknown fields",
    "Phase A control parser categorically rejects PASS",
    "external execution candidates always remain HOLD",
    "platform sources are categorical no-process Phase-A state machines",
    "main initializes HOLD and validates every invariant before FINAL",
    "native and build sources expose no shell network loader key or legacy PID cleanup surface"};

/*
 * The admitted material binds the outer TAP v13 shape, the exact ordered case
 * names, and their source file.  It does not bind the nested diagnostic-line
 * grammar or a complete transcript digest.  Accepting a transcript without
 * those literals would turn unreviewed bytes into evidence, so both remain
 * independent compile-time HOLD barriers.
 */
#if IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE || \
    IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND
#error "Bind reviewed TAP diagnostic grammar and transcript identity before enabling"
#endif

static int contains_ascii(const unsigned char *bytes, size_t length,
                          const char *needle) {
  size_t needle_length = strlen(needle);
  size_t index;
  if (needle_length == 0U || needle_length > length) return 0;
  for (index = 0; index <= length - needle_length; ++index) {
    if (memcmp(bytes + index, needle, needle_length) == 0) return 1;
  }
  return 0;
}

static int manifest_shape_is_exact(void) {
  size_t index;
  if (sizeof(canonical_case_names) / sizeof(canonical_case_names[0]) !=
      IAT_B3_CANONICAL_TAP_CASE_COUNT) {
    return 0;
  }
  if (!iat_b3_is_lower_hex_sha256(IAT_B3_CANONICAL_TAP_SOURCE_SHA256) ||
      !iat_b3_is_lower_hex_sha256(
          IAT_B3_CANONICAL_TAP_ORDERED_NAMES_SHA256)) {
    return 0;
  }
  for (index = 0; index < IAT_B3_CANONICAL_TAP_CASE_COUNT; ++index) {
    if (canonical_case_names[index] == NULL ||
        canonical_case_names[index][0] == '\0') {
      return 0;
    }
  }
  return 1;
}

int iat_b3_validate_tap_transcript(const unsigned char *bytes, size_t length,
                                   const char **error_code) {
  size_t index;
  if (error_code == NULL) return 0;
  *error_code = "CANONICAL_TAP_MANIFEST_INVALID_HOLD";
  if (!IAT_B3_CANONICAL_TAP_MANIFEST_BOUND || !manifest_shape_is_exact()) {
    return 0;
  }
  if (bytes == NULL || length == 0U) {
    *error_code = "TAP_INPUT_MISSING_HOLD";
    return 0;
  }
  if (bytes[length - 1U] != '\n') {
    *error_code = "TAP_EOF_INVALID_HOLD";
    return 0;
  }
  for (index = 0; index < length; ++index) {
    if (bytes[index] != '\n' &&
        (bytes[index] < 0x20U || bytes[index] > 0x7eU)) {
      *error_code = "TAP_LEXICAL_INVALID_HOLD";
      return 0;
    }
  }
  if (contains_ascii(bytes, length, "Bail out!")) {
    *error_code = "TAP_BAILOUT_HOLD";
    return 0;
  }
  *error_code =
      "CANONICAL_TAP_DIAGNOSTIC_GRAMMAR_OR_TRANSCRIPT_DIGEST_UNBOUND_HOLD";
  return 0;
}
