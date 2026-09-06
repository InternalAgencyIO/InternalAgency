#include "iat_b3_containment.h"

#include <string.h>

static uint32_t rotate_right(uint32_t value, unsigned bits) {
  return (value >> bits) | (value << (32U - bits));
}

static const uint32_t round_constants[64] = {
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U,
    0x3956c25bU, 0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U,
    0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U,
    0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U, 0xc19bf174U,
    0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
    0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU,
    0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
    0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U,
    0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU, 0x53380d13U,
    0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
    0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U,
    0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U,
    0x19a4c116U, 0x1e376c08U, 0x2748774cU, 0x34b0bcb5U,
    0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
    0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
    0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};

static void transform(iat_b3_sha256 *context, const unsigned char block[64]) {
  uint32_t schedule[64];
  uint32_t a, b, c, d, e, f, g, h;
  unsigned index;
  for (index = 0; index < 16; ++index) {
    size_t offset = (size_t)index * 4U;
    schedule[index] = ((uint32_t)block[offset] << 24U) |
                      ((uint32_t)block[offset + 1U] << 16U) |
                      ((uint32_t)block[offset + 2U] << 8U) |
                      (uint32_t)block[offset + 3U];
  }
  for (; index < 64; ++index) {
    uint32_t s0 = rotate_right(schedule[index - 15U], 7U) ^
                  rotate_right(schedule[index - 15U], 18U) ^
                  (schedule[index - 15U] >> 3U);
    uint32_t s1 = rotate_right(schedule[index - 2U], 17U) ^
                  rotate_right(schedule[index - 2U], 19U) ^
                  (schedule[index - 2U] >> 10U);
    schedule[index] = schedule[index - 16U] + s0 +
                      schedule[index - 7U] + s1;
  }
  a = context->state[0]; b = context->state[1];
  c = context->state[2]; d = context->state[3];
  e = context->state[4]; f = context->state[5];
  g = context->state[6]; h = context->state[7];
  for (index = 0; index < 64; ++index) {
    uint32_t sum1 = rotate_right(e, 6U) ^ rotate_right(e, 11U) ^
                    rotate_right(e, 25U);
    uint32_t choose = (e & f) ^ ((~e) & g);
    uint32_t temporary1 = h + sum1 + choose + round_constants[index] +
                          schedule[index];
    uint32_t sum0 = rotate_right(a, 2U) ^ rotate_right(a, 13U) ^
                    rotate_right(a, 22U);
    uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temporary2 = sum0 + majority;
    h = g; g = f; f = e; e = d + temporary1;
    d = c; c = b; b = a; a = temporary1 + temporary2;
  }
  context->state[0] += a; context->state[1] += b;
  context->state[2] += c; context->state[3] += d;
  context->state[4] += e; context->state[5] += f;
  context->state[6] += g; context->state[7] += h;
}

void iat_b3_sha256_init(iat_b3_sha256 *context) {
  static const uint32_t initial[8] = {
      0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
      0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U};
  memcpy(context->state, initial, sizeof(initial));
  context->total_bytes = 0;
  context->block_length = 0;
  context->failed = 0;
  memset(context->block, 0, sizeof(context->block));
}

void iat_b3_sha256_update(iat_b3_sha256 *context, const unsigned char *data,
                          size_t length) {
  size_t offset = 0;
  if (context == NULL || context->failed) return;
  if (data == NULL && length != 0U) {
    context->failed = 1;
    return;
  }
  if ((uint64_t)length > UINT64_MAX / 8ULL - context->total_bytes) {
    context->failed = 1;
    return;
  }
  context->total_bytes += (uint64_t)length;
  while (offset < length) {
    size_t remaining = 64U - context->block_length;
    size_t copy = length - offset < remaining ? length - offset : remaining;
    memcpy(context->block + context->block_length, data + offset, copy);
    context->block_length += copy;
    offset += copy;
    if (context->block_length == 64U) {
      transform(context, context->block);
      context->block_length = 0;
    }
  }
}

void iat_b3_sha256_final(iat_b3_sha256 *context, unsigned char digest[32]) {
  uint64_t bit_length;
  unsigned char one = 0x80U;
  unsigned char zero = 0;
  unsigned char length_bytes[8];
  unsigned index;
  if (digest == NULL) return;
  if (context == NULL || context->failed ||
      context->total_bytes > UINT64_MAX / 8ULL) {
    if (context != NULL) context->failed = 1;
    memset(digest, 0, 32U);
    return;
  }
  bit_length = context->total_bytes * 8ULL;
  /* Padding bytes are not part of the caller-observed length. */
  context->total_bytes = 0;
  iat_b3_sha256_update(context, &one, 1U);
  while (context->block_length != 56U) iat_b3_sha256_update(context, &zero, 1U);
  for (index = 0; index < 8U; ++index)
    length_bytes[7U - index] = (unsigned char)(bit_length >> (index * 8U));
  iat_b3_sha256_update(context, length_bytes, sizeof(length_bytes));
  for (index = 0; index < 8U; ++index) {
    digest[index * 4U] = (unsigned char)(context->state[index] >> 24U);
    digest[index * 4U + 1U] = (unsigned char)(context->state[index] >> 16U);
    digest[index * 4U + 2U] = (unsigned char)(context->state[index] >> 8U);
    digest[index * 4U + 3U] = (unsigned char)context->state[index];
  }
}
