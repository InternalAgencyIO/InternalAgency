#define _GNU_SOURCE
#include <arpa/inet.h>
#include <endian.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <linux/kcmp.h>
#include <linux/openat2.h>
#include <linux/stat.h>
#include <openssl/evp.h>
#include <poll.h>
#include <signal.h>
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <sys/timerfd.h>
#include <sys/wait.h>
#include <sys/syscall.h>
#include <sys/sysmacros.h>
#include <sys/types.h>
#include <sys/xattr.h>
#include <time.h>
#include <unistd.h>

#ifndef RENAME_NOREPLACE
#define RENAME_NOREPLACE (1U << 0)
#endif
#ifndef F_SEAL_FUTURE_WRITE
#define F_SEAL_FUTURE_WRITE 0x0010
#endif

#define BPS09_SCHEMA "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored/v1"
#define BPS09_MAX_BOOTSTRAP_BYTES (1024U * 1024U)
#define BPS09_MAX_ARTIFACT_BYTES (256ULL * 1024ULL * 1024ULL)
#define BPS09_FD_BOOTSTRAP 3
#define BPS09_FD_SOURCE_ARTIFACT 4
#define BPS09_FD_INSTALL_PARENT 5
#define BPS09_FD_WATCHDOG 6
#define BPS09_FD_OBSERVER 7
#define BPS09_FD_CUSTODIAN 8
#define BPS09_FD_OPERATION_TIMER 9
#define BPS09_FD_TEARDOWN_TIMER 10
#define BPS09_FD_ANCHOR_RECEIPT 11
#define BPS09_FD_OWNER_ROOT_KEY_ANCHOR 12
#define BPS09_FD_WATCHDOG_PIDFD 13
#define BPS09_FD_OBSERVER_PIDFD 14
#define BPS09_FD_CUSTODIAN_PIDFD 15
#define BPS09_FD_ONE_SHOT_CAS_TOKEN 16
#define BPS09_FD_RUNTIME_BINDING_RECEIPT 17
#define BPS09_FD_EVIDENCE 20
#define BPS09_FD_SELF_IMAGE 21
#define BPS09_FD_RECOVERY_QUARANTINE 22
#define BPS09_FD_KERNEL_BINDING_DESCRIPTOR 23
#define BPS09_FD_RUNTIME_BINDING_PROVIDER 24
#define BPS09_REQUIRED_MEMFD_SEALS (F_SEAL_SEAL | F_SEAL_SHRINK | F_SEAL_GROW | F_SEAL_WRITE | F_SEAL_FUTURE_WRITE)
#define BPS09_BPK00_COMMIT "512b347ebf4de80bf5a50e0d8491f14eeef0f9f0"
#define BPS09_BPK00_TREE "c4e8e6ca1c54e9154743dd2fea7b434307d74676"
#define BPS09_BPK00_BLOB "8e38e773ed4f11a4aefd8787c63c535775056c1a"
#define BPS09_BPK00_FILE_SHA256 "7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21"
#define BPS09_BPK00_FILE_BYTES "1001"
#define BPS09_BPK00_PATH "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor.v1.json"
#define BPS09_ROOT_PUBLIC_KEY_HEX "60fa8f2c48a8bc6d2ad476b094bb2f569f020211bf834deb144d2e2958ac4230"
#define BPS09_ROOT_FINGERPRINT_SHA256 "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1"
#define BPS09_OWNER_PROVISIONING_RECEIPT_SHA256 "3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a"
#define BPS09_BPK00_OUTCOME "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_FD12_OWNER_ROOT_PUBLIC_KEY_ANCHOR_CHECKPOINT_COMMITTED"
#define BPS09_BPS08_ANCHOR_SCHEMA "iat-b3-bps08-compile-peer-anchor-receipt/v1"
#define BPS09_BPS08_SUBJECT_DOMAIN "IAT_B3_BPS08_ANCHOR_SUBJECT_V1"
#define BPS09_BPS08_BODY_PREFIX "IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:"
#define BPS09_CAPABILITY_DOMAIN "INSTALL_OR_RECOVER_ONLY"
#define BPS09_COMPILE_REVIEW_OUTCOME "POST_CHECKPOINT_PACKAGE_BOUND_FD12_TRUST_ANCHORED_DETERMINISTIC_COMPILE_ARTIFACT_REVIEW_ACCEPTED_HOLD"
#define BPS09_BPS05_MANIFEST_SHA256 "09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b"
#define BPS09_BPS06_MANIFEST_SHA256 "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c"
#define BPS09_BPC01_COMMIT "fd47774fe6523e181b792d187a4bae708f96ad9d"
#define BPS09_BPC01_TREE "1a81c083b9207eaa6f0d4dd74c4c562aa9268201"
#define BPS09_BPC01_MANIFEST_SHA256 "504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513"
#define BPS09_RECOVERY_PRODUCER_SET_SHA256 "fff1277da2f8badfacf5dc6fb20e02db516dd3f6132cfe3b8fa59bf66dec1f48"

enum bps09_mode { BPS09_MODE_INVALID = 0, BPS09_MODE_INSTALL = 1, BPS09_MODE_RECOVER = 2 };
enum bps09_phase {
  BPS09_PHASE_UNSTARTED = 0, BPS09_PHASE_FD12_VERIFIED,
  BPS09_PHASE_FD11_OCMS_VERIFIED, BPS09_PHASE_BOOTSTRAP_VALIDATED,
  BPS09_PHASE_COMPILE_REVIEW_ACCEPTED, BPS09_PHASE_SOURCE_REPLAYED,
  BPS09_PHASE_CAS_ACQUIRED, BPS09_PHASE_PARENT_REPLAYED,
  BPS09_PHASE_TEMP_CREATED, BPS09_PHASE_BYTES_WRITTEN,
  BPS09_PHASE_TEMP_SYNCED, BPS09_PHASE_PUBLISHED,
  BPS09_PHASE_PARENT_SYNCED, BPS09_PHASE_FINAL_REOPENED,
  BPS09_PHASE_CUSTODY_ACKED, BPS09_PHASE_ZERO_VERIFIED,
  BPS09_PHASE_HOLD_PERSISTED, BPS09_PHASE_ABORT_LATCHED
};

struct bps09_file_claim {
  char path[4096]; char sha256[65], handle_sha256[65], ofd_sha256[65];
  uint64_t byte_length, dev, ino, mount_id, nlink;
  uint32_t mode, uid, gid;
};

struct bps09_native_bootstrap {
  enum bps09_mode mode;
  char attempt_id[128], run_id[128], session_id[128];
  char temp_name[192], final_name[192];
  char compile_review_sha256[65], compile_review_subject_sha256[65];
  char actual_prior_receipt_sha256[65], actual_prior_subject_sha256[65], actual_prior_producer[96];
  char accepted_producer_set_sha256[65], publication_cas_sha256[65];
  struct bps09_file_claim target, installer, parent, recovery_temp, recovery_final;
  uint64_t deadline_ns, timer_dev, timer_ino;
  bool recovery_temp_claim_present, recovery_final_claim_present;
};

struct bps09_runtime {
  struct bps09_native_bootstrap bootstrap;
  enum bps09_phase phase;
  int temp_fd, final_fd;
  bool cas_held, custody_acked, published;
  uint64_t copied_bytes;
  uint64_t watchdog_sequence, custodian_sequence;
  char bootstrap_sha256[65], final_subject_sha256[65];
  struct bps09_file_claim final_claim;
};

struct bps09_trust_anchor {
  bool fd12_verified, fd11_verified, one_use_consumed, runtime_binding_verified;
  unsigned char root_public_key[32];
  char root_public_key_hex[65], root_fingerprint_sha256[65], provisioning_receipt_sha256[65];
  char content_sha256[65], handle_sha256[65], ofd_sha256[65], descriptor_sha256[65];
  char attempt_id[128], run_id[128], session_id[128];
  char anchor_nonce_hex[65], anchor_cas_key_sha256[65], anchor_cas_acquire_receipt_sha256[65];
  uint64_t anchor_expires_at_monotonic_ns, operation_deadline_monotonic_ns, teardown_deadline_monotonic_ns;
  struct ucred watchdog_credentials, observer_credentials, custodian_credentials;
  unsigned char role_public_keys[3][32], principal_sha256_raw[3][32];
  char watchdog_channel_ofd_sha256[65], observer_channel_ofd_sha256[65], custodian_channel_ofd_sha256[65];
  char watchdog_principal_sha256[65], observer_principal_sha256[65], custodian_principal_sha256[65];
  char operation_timer_ofd_sha256[65], teardown_timer_ofd_sha256[65];
  uint64_t dev, ino, mount_id;
};

struct bps09_rpc {
  uint32_t version, operation, from_phase, to_phase;
  uint64_t sequence;
  uint32_t state;
  uint64_t pidfd_dev, pidfd_ino, resource_dev, resource_ino, resource_mount_id;
  char attempt_id[128], run_id[128], session_id[128], receipt_sha256[65], producer_set_sha256[65];
  char producer[96], prior_producer[96], outcome[160];
  char fd_ledger_sha256[65], process_ledger_sha256[65], mount_ledger_sha256[65], entry_ledger_sha256[65], cache_ledger_sha256[65];
  char decision[8], authority[8];
  unsigned char signature[64];
};

struct __attribute__((packed)) bps09_peer_wire {
  uint64_t pid_be, uid_be, gid_be, start_ticks_be, channel_dev_be, channel_ino_be, pidfd_dev_be, pidfd_ino_be;
  unsigned char executable_sha256[32], security_label_sha256[32], namespace_projection_sha256[32];
  unsigned char cgroup_projection_sha256[32], authority_projection_sha256[32], channel_ofd_projection_sha256[32];
};

struct __attribute__((packed)) bps09_dir_wire { uint64_t dev_be, ino_be, mode_be; };

struct __attribute__((packed)) bps09_kernel_descriptor_v1 {
  unsigned char magic[8];
  uint32_t version_be, byte_length_be;
  struct bps09_peer_wire peers[3];
  struct bps09_dir_wire directories[4];
  uint64_t target_dev_be, target_ino_be, target_mount_id_be;
  unsigned char cas_token_sha256[32], ledger_identity_sha256[32], target_name_sha256[32], tombstone_name_sha256[32];
  uint64_t timer_deadline_ns_be[2];
  unsigned char timer_ofd_sha256[2][32], runtime_receipt_sha256[32], provider_executable_sha256[32];
  unsigned char role_public_keys[3][32], principal_sha256[3][32], role_signatures[3][64];
};

_Static_assert(sizeof(struct bps09_kernel_descriptor_v1)==1560U,"kernel descriptor v1 wire size");

static struct bps09_runtime g_runtime = { .phase = BPS09_PHASE_UNSTARTED, .temp_fd = -1, .final_fd = -1 };
static struct bps09_rpc g_cas_reply, g_publication_reply, g_custody_reply, g_zero_reply;
static struct bps09_rpc g_abort_reply, g_cleanup_reply, g_parent_fsync_reply, g_terminal_evidence_ack;
static struct bps09_trust_anchor g_trust_anchor;
static int compute_recovery_ledger_subject(char output[65]);
static int verify_beneath_identity_or_absence(const char *name,const struct bps09_file_claim *claim,bool claim_present);
static int replay_fd12_owner_root_key_anchor_same_handle(void);
static int verify_fd11_anchor_receipt_ocms_v1(void);
static int verify_runtime_binding_before_fd3(void);

static bool canonical_name(const char *value) {
  return value != NULL && value[0] != '\0' && strlen(value) < 192U && strcmp(value, ".") != 0 && strcmp(value, "..") != 0 && strchr(value, '/') == NULL && strchr(value, '\n') == NULL && strchr(value, '\r') == NULL;
}

static bool canonical_absolute_path(const char *value) {
  if (value == NULL || value[0] != '/' || value[1] == '/' || value[1] == '\0' || value[strlen(value) - 1U] == '/') return false;
  if (strstr(value, "/../") != NULL || (strlen(value) >= 3U && strcmp(value + strlen(value) - 3U, "/..") == 0) || strstr(value, "//") != NULL) return false;
  for (const unsigned char *p = (const unsigned char *)value; *p != '\0'; ++p) if (*p < 0x20U || *p == 0x7fU || *p == '"' || *p == '\\') return false;
  return true;
}

static int parse_mode_text(const char *value, uint32_t *output) {
  if (value == NULL || strlen(value) != 4U) return -1;
  uint32_t parsed = 0U;
  for (size_t index = 0U; index < 4U; ++index) {
    if (value[index] < '0' || value[index] > '7') return -1;
    parsed = parsed * 8U + (uint32_t)(value[index] - '0');
  }
  *output = parsed; return 0;
}

static bool lowercase_sha256(const char *value) {
  if (value == NULL || strlen(value) != 64U) return false;
  for (size_t i = 0; i < 64U; ++i) if (!((value[i] >= '0' && value[i] <= '9') || (value[i] >= 'a' && value[i] <= 'f'))) return false;
  return true;
}

static bool nonzero_lower_hex_32(const char *value) {
  if(!lowercase_sha256(value))return false;
  for(size_t index=0U;index<64U;++index)if(value[index]!='0')return true;
  return false;
}

static int base58_encode_32(const unsigned char input[32],char output[64]) {
  static const char alphabet[]="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  unsigned char digits[45]={0U};size_t used=1U,leading=0U;
  while(leading<32U&&input[leading]==0U)++leading;
  for(size_t index=leading;index<32U;++index){unsigned carry=input[index];for(size_t digit=0U;digit<used;++digit){carry+=(unsigned)digits[digit]*256U;digits[digit]=(unsigned char)(carry%58U);carry/=58U;}while(carry>0U){if(used>=sizeof digits)return -1;digits[used++]=(unsigned char)(carry%58U);carry/=58U;}}
  size_t bytes=0U;for(size_t index=0U;index<leading;++index)output[bytes++]='1';for(size_t index=used;index>0U;--index)output[bytes++]=alphabet[digits[index-1U]];output[bytes]='\0';return bytes>0U?0:-1;
}

struct bps09_sha256_context { uint32_t state[8]; uint64_t bit_count; unsigned char block[64]; size_t used; };
static uint32_t bps09_rotr32(uint32_t value, unsigned count) { return (value >> count) | (value << (32U - count)); }
static void bps09_sha256_transform(struct bps09_sha256_context *context, const unsigned char block[64]) {
  static const uint32_t constants[64] = {
    0x428a2f98U,0x71374491U,0xb5c0fbcfU,0xe9b5dba5U,0x3956c25bU,0x59f111f1U,0x923f82a4U,0xab1c5ed5U,
    0xd807aa98U,0x12835b01U,0x243185beU,0x550c7dc3U,0x72be5d74U,0x80deb1feU,0x9bdc06a7U,0xc19bf174U,
    0xe49b69c1U,0xefbe4786U,0x0fc19dc6U,0x240ca1ccU,0x2de92c6fU,0x4a7484aaU,0x5cb0a9dcU,0x76f988daU,
    0x983e5152U,0xa831c66dU,0xb00327c8U,0xbf597fc7U,0xc6e00bf3U,0xd5a79147U,0x06ca6351U,0x14292967U,
    0x27b70a85U,0x2e1b2138U,0x4d2c6dfcU,0x53380d13U,0x650a7354U,0x766a0abbU,0x81c2c92eU,0x92722c85U,
    0xa2bfe8a1U,0xa81a664bU,0xc24b8b70U,0xc76c51a3U,0xd192e819U,0xd6990624U,0xf40e3585U,0x106aa070U,
    0x19a4c116U,0x1e376c08U,0x2748774cU,0x34b0bcb5U,0x391c0cb3U,0x4ed8aa4aU,0x5b9cca4fU,0x682e6ff3U,
    0x748f82eeU,0x78a5636fU,0x84c87814U,0x8cc70208U,0x90befffaU,0xa4506cebU,0xbef9a3f7U,0xc67178f2U
  };
  uint32_t words[64];
  for (size_t index = 0U; index < 16U; ++index) words[index] = ((uint32_t)block[index * 4U] << 24U) | ((uint32_t)block[index * 4U + 1U] << 16U) | ((uint32_t)block[index * 4U + 2U] << 8U) | (uint32_t)block[index * 4U + 3U];
  for (size_t index = 16U; index < 64U; ++index) {
    uint32_t s0 = bps09_rotr32(words[index - 15U], 7U) ^ bps09_rotr32(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
    uint32_t s1 = bps09_rotr32(words[index - 2U], 17U) ^ bps09_rotr32(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
    words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
  }
  uint32_t a=context->state[0],b=context->state[1],c=context->state[2],d=context->state[3],e=context->state[4],f=context->state[5],g=context->state[6],h=context->state[7];
  for (size_t index = 0U; index < 64U; ++index) {
    uint32_t sum1=bps09_rotr32(e,6U)^bps09_rotr32(e,11U)^bps09_rotr32(e,25U), choice=(e&f)^((~e)&g);
    uint32_t temp1=h+sum1+choice+constants[index]+words[index], sum0=bps09_rotr32(a,2U)^bps09_rotr32(a,13U)^bps09_rotr32(a,22U), majority=(a&b)^(a&c)^(b&c), temp2=sum0+majority;
    h=g; g=f; f=e; e=d+temp1; d=c; c=b; b=a; a=temp1+temp2;
  }
  context->state[0]+=a; context->state[1]+=b; context->state[2]+=c; context->state[3]+=d; context->state[4]+=e; context->state[5]+=f; context->state[6]+=g; context->state[7]+=h;
}
static void bps09_sha256_init(struct bps09_sha256_context *context) {
  *context=(struct bps09_sha256_context){ .state={0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U} };
}
static void bps09_sha256_update(struct bps09_sha256_context *context, const void *input, size_t bytes) {
  const unsigned char *cursor=input; context->bit_count += (uint64_t)bytes * 8U;
  while (bytes > 0U) { size_t take=sizeof context->block-context->used; if (take>bytes) take=bytes; memcpy(context->block+context->used,cursor,take); context->used+=take; cursor+=take; bytes-=take; if(context->used==sizeof context->block){bps09_sha256_transform(context,context->block);context->used=0U;} }
}
static void bps09_sha256_final(struct bps09_sha256_context *context, unsigned char output[32]) {
  uint64_t bits=context->bit_count; context->block[context->used++]=0x80U;
  if(context->used>56U){while(context->used<64U)context->block[context->used++]=0U;bps09_sha256_transform(context,context->block);context->used=0U;}
  while(context->used<56U)context->block[context->used++]=0U;
  for(size_t index=0U;index<8U;++index)context->block[56U+index]=(unsigned char)(bits>>(56U-index*8U));
  bps09_sha256_transform(context,context->block);
  for(size_t index=0U;index<8U;++index){output[index*4U]=(unsigned char)(context->state[index]>>24U);output[index*4U+1U]=(unsigned char)(context->state[index]>>16U);output[index*4U+2U]=(unsigned char)(context->state[index]>>8U);output[index*4U+3U]=(unsigned char)context->state[index];}
}
static void bps09_digest_hex(const unsigned char digest[32], char output[65]) { static const char hex[]="0123456789abcdef"; for(size_t index=0U;index<32U;++index){output[index*2U]=hex[digest[index]>>4U];output[index*2U+1U]=hex[digest[index]&15U];} output[64]='\0'; }
static void bps09_sha256_bytes_hex(const void *bytes, size_t length, char output[65]) { struct bps09_sha256_context context; unsigned char digest[32]; bps09_sha256_init(&context); bps09_sha256_update(&context,bytes,length); bps09_sha256_final(&context,digest); bps09_digest_hex(digest,output); }
static int bps09_sha256_fd_hex(int fd, uint64_t expected_bytes, char output[65]) {
  struct bps09_sha256_context context; unsigned char digest[32],buffer[65536]; uint64_t offset=0U; bps09_sha256_init(&context);
  while(offset<expected_bytes){size_t wanted=sizeof buffer;if((uint64_t)wanted>expected_bytes-offset)wanted=(size_t)(expected_bytes-offset);ssize_t got=pread(fd,buffer,wanted,(off_t)offset);if(got<0&&errno==EINTR)continue;if(got<=0||(size_t)got>wanted)return -1;bps09_sha256_update(&context,buffer,(size_t)got);offset+=(uint64_t)got;}
  unsigned char extra; ssize_t trailing; do { trailing=pread(fd,&extra,1U,(off_t)expected_bytes); } while(trailing<0&&errno==EINTR); if(trailing!=0)return -1;
  bps09_sha256_final(&context,digest);bps09_digest_hex(digest,output);return 0;
}

static int read_exact_fd(int fd, void *buffer, size_t bytes) {
  unsigned char *cursor = buffer;
  while (bytes > 0U) {
    ssize_t got = read(fd, cursor, bytes);
    if (got < 0 && errno == EINTR) continue;
    if (got <= 0) return -1;
    cursor += (size_t)got; bytes -= (size_t)got;
  }
  return 0;
}

static int write_exact_fd(int fd, const void *buffer, size_t bytes) {
  const unsigned char *cursor = buffer;
  while (bytes > 0U) {
    ssize_t wrote = write(fd, cursor, bytes);
    if (wrote < 0 && errno == EINTR) continue;
    if (wrote <= 0) return -1;
    cursor += (size_t)wrote; bytes -= (size_t)wrote;
  }
  return 0;
}

static int basename_beneath_claim(const struct bps09_file_claim *parent, const struct bps09_file_claim *child, char *output, size_t output_bytes) {
  size_t prefix = strlen(parent->path);
  if (prefix == 0U || strncmp(parent->path, child->path, prefix) != 0 || child->path[prefix] != '/') return -1;
  const char *name = child->path + prefix + 1U;
  if (!canonical_name(name) || strlen(name) >= output_bytes) return -1;
  memcpy(output, name, strlen(name) + 1U); return 0;
}

static int parse_u64(const char *value, uint64_t *output) {
  if (value == NULL || value[0] == '\0' || (value[0] == '0' && value[1] != '\0')) return -1;
  uint64_t parsed = 0U;
  for (const char *p = value; *p != '\0'; ++p) {
    if (*p < '0' || *p > '9') return -1;
    unsigned digit = (unsigned)(*p - '0');
    if (parsed > (UINT64_MAX - digit) / 10U) return -1;
    parsed = parsed * 10U + digit;
  }
  *output = parsed; return 0;
}

static int load_json_record(int fd, char **output, size_t *output_bytes) {
  struct stat st;
  if (fstat(fd, &st) != 0 || !S_ISREG(st.st_mode) || st.st_size <= 1 || (uint64_t)st.st_size > BPS09_MAX_BOOTSTRAP_BYTES || lseek(fd, 0, SEEK_SET) < 0) return -1;
  size_t bytes = (size_t)st.st_size; char *buffer = calloc(bytes + 1U, 1U);
  if (buffer == NULL || read_exact_fd(fd, buffer, bytes) != 0) { free(buffer); return -1; }
  if (buffer[bytes - 1U] != '\n' || memchr(buffer, '\r', bytes) != NULL || memchr(buffer, '\0', bytes) != NULL || memchr(buffer, '\n', bytes - 1U) != NULL || buffer[0] != '{' || buffer[bytes - 2U] != '}') { free(buffer); return -1; }
  buffer[bytes - 1U] = '\0'; *output = buffer; *output_bytes = bytes - 1U; return 0;
}

enum bps09_json_type { BPS09_JSON_OBJECT, BPS09_JSON_ARRAY, BPS09_JSON_STRING, BPS09_JSON_NUMBER, BPS09_JSON_TRUE, BPS09_JSON_FALSE, BPS09_JSON_NULL };
struct bps09_json_node { enum bps09_json_type type; char *key; char *string; int first_child; int next_sibling; };
struct bps09_json_parser { char *cursor; char *end; struct bps09_json_node nodes[1024]; size_t used; };

static int json_new_node(struct bps09_json_parser *parser, enum bps09_json_type type) {
  if (parser->used >= sizeof parser->nodes / sizeof parser->nodes[0]) return -1;
  int index = (int)parser->used++;
  parser->nodes[index] = (struct bps09_json_node){ .type = type, .first_child = -1, .next_sibling = -1 };
  return index;
}

static int json_string_token(struct bps09_json_parser *parser, char **output) {
  if (parser->cursor >= parser->end || *parser->cursor++ != '"') return -1;
  char *start = parser->cursor;
  while (parser->cursor < parser->end && *parser->cursor != '"') {
    unsigned char value = (unsigned char)*parser->cursor;
    if (value < 0x20U || value == '\\') return -1;
    ++parser->cursor;
  }
  if (parser->cursor >= parser->end || parser->cursor == start) return -1;
  *parser->cursor++ = '\0'; *output = start; return 0;
}

static int json_parse_value(struct bps09_json_parser *parser);

static int json_parse_object(struct bps09_json_parser *parser) {
  int object = json_new_node(parser, BPS09_JSON_OBJECT);
  if (object < 0 || parser->cursor >= parser->end || *parser->cursor++ != '{') return -1;
  if (parser->cursor < parser->end && *parser->cursor == '}') { ++parser->cursor; return object; }
  int previous = -1;
  for (;;) {
    char *key = NULL;
    if (json_string_token(parser, &key) != 0 || parser->cursor >= parser->end || *parser->cursor++ != ':') return -1;
    int child = json_parse_value(parser);
    if (child < 0) return -1;
    parser->nodes[child].key = key;
    if (previous < 0) parser->nodes[object].first_child = child; else parser->nodes[previous].next_sibling = child;
    previous = child;
    if (parser->cursor >= parser->end) return -1;
    if (*parser->cursor == '}') { ++parser->cursor; return object; }
    if (*parser->cursor++ != ',') return -1;
  }
}

static int json_parse_array(struct bps09_json_parser *parser) {
  int array = json_new_node(parser, BPS09_JSON_ARRAY);
  if (array < 0 || parser->cursor >= parser->end || *parser->cursor++ != '[') return -1;
  if (parser->cursor < parser->end && *parser->cursor == ']') { ++parser->cursor; return array; }
  int previous = -1;
  for (;;) {
    int child = json_parse_value(parser);
    if (child < 0) return -1;
    if (previous < 0) parser->nodes[array].first_child = child; else parser->nodes[previous].next_sibling = child;
    previous = child;
    if (parser->cursor >= parser->end) return -1;
    if (*parser->cursor == ']') { ++parser->cursor; return array; }
    if (*parser->cursor++ != ',') return -1;
  }
}

static int json_parse_value(struct bps09_json_parser *parser) {
  if (parser->cursor >= parser->end) return -1;
  if (*parser->cursor == '{') return json_parse_object(parser);
  if (*parser->cursor == '[') return json_parse_array(parser);
  if (*parser->cursor == '"') {
    int node = json_new_node(parser, BPS09_JSON_STRING);
    if (node < 0 || json_string_token(parser, &parser->nodes[node].string) != 0) return -1;
    return node;
  }
  if (*parser->cursor >= '0' && *parser->cursor <= '9') {
    int node = json_new_node(parser, BPS09_JSON_NUMBER);
    if (node < 0) return -1;
    char *start = parser->cursor;
    if (*parser->cursor == '0') ++parser->cursor;
    else while (parser->cursor < parser->end && *parser->cursor >= '0' && *parser->cursor <= '9') ++parser->cursor;
    if (parser->cursor < parser->end && *parser->cursor >= '0' && *parser->cursor <= '9') return -1;
    if (parser->cursor < parser->end) { char delimiter=*parser->cursor; *parser->cursor='\0'; parser->nodes[node].string=start; *parser->cursor=delimiter; }
    else parser->nodes[node].string=start;
    return node;
  }
  struct { const char *literal; enum bps09_json_type type; } literals[] = { { "true", BPS09_JSON_TRUE }, { "false", BPS09_JSON_FALSE }, { "null", BPS09_JSON_NULL } };
  for (size_t index = 0U; index < sizeof literals / sizeof literals[0]; ++index) {
    size_t length = strlen(literals[index].literal);
    if ((size_t)(parser->end - parser->cursor) >= length && memcmp(parser->cursor, literals[index].literal, length) == 0) { parser->cursor += length; return json_new_node(parser, literals[index].type); }
  }
  return -1;
}

static int json_parse_exact(char *json, size_t bytes, struct bps09_json_parser *parser) {
  memset(parser, 0, sizeof *parser); parser->cursor = json; parser->end = json + bytes;
  int root = json_parse_value(parser);
  return root >= 0 && parser->cursor == parser->end ? root : -1;
}

static int json_object_exact(struct bps09_json_parser *parser, int object, const char *const *keys, size_t count) {
  if (object < 0 || parser->nodes[object].type != BPS09_JSON_OBJECT) return -1;
  int child = parser->nodes[object].first_child;
  for (size_t index = 0U; index < count; ++index) {
    if (child < 0 || parser->nodes[child].key == NULL || strcmp(parser->nodes[child].key, keys[index]) != 0) return -1;
    child = parser->nodes[child].next_sibling;
  }
  return child == -1 ? 0 : -1;
}

static int json_child(struct bps09_json_parser *parser, int object, const char *key) {
  if (object < 0 || parser->nodes[object].type != BPS09_JSON_OBJECT) return -1;
  for (int child = parser->nodes[object].first_child; child >= 0; child = parser->nodes[child].next_sibling) if (parser->nodes[child].key != NULL && strcmp(parser->nodes[child].key, key) == 0) return child;
  return -1;
}

static const char *json_string_value(struct bps09_json_parser *parser, int object, const char *key) {
  int child = json_child(parser, object, key);
  return child >= 0 && parser->nodes[child].type == BPS09_JSON_STRING ? parser->nodes[child].string : NULL;
}
static int json_number_equals(struct bps09_json_parser *parser,int object,const char *key,const char *expected) {
  int child=json_child(parser,object,key);
  if(child<0||parser->nodes[child].type!=BPS09_JSON_NUMBER||parser->nodes[child].string==NULL)return -1;
  const char *value=parser->nodes[child].string;size_t length=0U;while(value[length]>='0'&&value[length]<='9')++length;
  return strlen(expected)==length&&memcmp(value,expected,length)==0?0:-1;
}
static bool json_string_equals(struct bps09_json_parser *parser, int object, const char *key, const char *expected) {
  const char *value = json_string_value(parser, object, key);
  return value != NULL && strcmp(value, expected) == 0;
}

static int copy_json_string(struct bps09_json_parser *parser, int object, const char *key, char *output, size_t output_bytes) {
  const char *value = json_string_value(parser, object, key);
  if (value == NULL || strlen(value) >= output_bytes) return -1;
  memcpy(output, value, strlen(value) + 1U); return 0;
}

static int parse_claim_node(struct bps09_json_parser *parser, int node, struct bps09_file_claim *claim) {
  static const char *const keys[] = { "path", "sha256", "byteLength", "mode", "uid", "gid", "dev", "ino", "mountId", "nlink", "handleSha256", "openFileDescriptionSha256", "sameHandleReplayRequired" };
  char mode[8], uid[32], gid[32], byte_length[32], dev[32], ino[32], mount[32], nlink[32]; uint64_t parsed_uid, parsed_gid;
  if (json_object_exact(parser, node, keys, sizeof keys / sizeof keys[0]) != 0 ||
      copy_json_string(parser, node, "path", claim->path, sizeof claim->path) != 0 || copy_json_string(parser, node, "sha256", claim->sha256, sizeof claim->sha256) != 0 ||
      copy_json_string(parser, node, "mode", mode, sizeof mode) != 0 || copy_json_string(parser, node, "byteLength", byte_length, sizeof byte_length) != 0 ||
      copy_json_string(parser, node, "uid", uid, sizeof uid) != 0 || copy_json_string(parser, node, "gid", gid, sizeof gid) != 0 ||
      copy_json_string(parser, node, "dev", dev, sizeof dev) != 0 || copy_json_string(parser, node, "ino", ino, sizeof ino) != 0 || copy_json_string(parser, node, "mountId", mount, sizeof mount) != 0 || copy_json_string(parser, node, "nlink", nlink, sizeof nlink) != 0 ||
      copy_json_string(parser, node, "handleSha256", claim->handle_sha256, sizeof claim->handle_sha256) != 0 || copy_json_string(parser, node, "openFileDescriptionSha256", claim->ofd_sha256, sizeof claim->ofd_sha256) != 0 ||
      !canonical_absolute_path(claim->path) || !lowercase_sha256(claim->sha256) || !lowercase_sha256(claim->handle_sha256) || !lowercase_sha256(claim->ofd_sha256) || parser->nodes[json_child(parser, node, "sameHandleReplayRequired")].type != BPS09_JSON_TRUE ||
      parse_mode_text(mode, &claim->mode) != 0 || parse_u64(byte_length, &claim->byte_length) != 0 || parse_u64(uid, &parsed_uid) != 0 || parse_u64(gid, &parsed_gid) != 0 || parse_u64(dev, &claim->dev) != 0 || parse_u64(ino, &claim->ino) != 0 || parse_u64(mount, &claim->mount_id) != 0 || parse_u64(nlink, &claim->nlink) != 0 || parsed_uid > UINT32_MAX || parsed_gid > UINT32_MAX) return -1;
  claim->uid = (uint32_t)parsed_uid; claim->gid = (uint32_t)parsed_gid; return 0;
}

static int parse_deadline_node(struct bps09_json_parser *parser, int node) {
  static const char *const keys[] = { "clock", "absoluteNanoseconds", "timerFd", "timerDev", "timerIno", "timerFirst" };
  char deadline[32], timer_fd[32], timer_dev[32], timer_ino[32]; uint64_t parsed_fd;
  if (json_object_exact(parser, node, keys, sizeof keys / sizeof keys[0]) != 0 || !json_string_equals(parser, node, "clock", "CLOCK_MONOTONIC") ||
      copy_json_string(parser, node, "absoluteNanoseconds", deadline, sizeof deadline) != 0 || copy_json_string(parser, node, "timerFd", timer_fd, sizeof timer_fd) != 0 || copy_json_string(parser, node, "timerDev", timer_dev, sizeof timer_dev) != 0 || copy_json_string(parser, node, "timerIno", timer_ino, sizeof timer_ino) != 0 ||
      parse_u64(deadline, &g_runtime.bootstrap.deadline_ns) != 0 || parse_u64(timer_fd, &parsed_fd) != 0 || parsed_fd != BPS09_FD_TEARDOWN_TIMER || parse_u64(timer_dev, &g_runtime.bootstrap.timer_dev) != 0 || parse_u64(timer_ino, &g_runtime.bootstrap.timer_ino) != 0 || parser->nodes[json_child(parser, node, "timerFirst")].type != BPS09_JSON_TRUE) return -1;
  struct stat timer_stat; char timer_target[64],timer_path[64]; struct pollfd timer_poll={.fd=BPS09_FD_TEARDOWN_TIMER,.events=POLLIN|POLLERR|POLLHUP};struct itimerspec timer_spec;struct timespec now;
  int timer_path_bytes=snprintf(timer_path,sizeof timer_path,"/proc/self/fd/%d",BPS09_FD_TEARDOWN_TIMER);if(timer_path_bytes<=0||(size_t)timer_path_bytes>=sizeof timer_path)return -1;
  ssize_t target_bytes=readlink(timer_path,timer_target,sizeof timer_target-1U); if(target_bytes<=0||(size_t)target_bytes>=sizeof timer_target)return -1;timer_target[target_bytes]='\0';
  int flags=fcntl(BPS09_FD_TEARDOWN_TIMER,F_GETFL); int ready=poll(&timer_poll,1,0);
  if(fstat(BPS09_FD_TEARDOWN_TIMER,&timer_stat)!=0||(uint64_t)timer_stat.st_dev!=g_runtime.bootstrap.timer_dev||(uint64_t)timer_stat.st_ino!=g_runtime.bootstrap.timer_ino||strcmp(timer_target,"anon_inode:[timerfd]")!=0||flags<0||(flags&O_NONBLOCK)==0||ready!=0||timerfd_gettime(BPS09_FD_TEARDOWN_TIMER,&timer_spec)!=0||clock_gettime(CLOCK_MONOTONIC,&now)!=0||timer_spec.it_interval.tv_sec!=0||timer_spec.it_interval.tv_nsec!=0||(timer_spec.it_value.tv_sec==0&&timer_spec.it_value.tv_nsec==0)||now.tv_sec<0)return -1;
  uint64_t now_ns=(uint64_t)now.tv_sec*1000000000ULL+(uint64_t)now.tv_nsec,remaining_ns=(uint64_t)timer_spec.it_value.tv_sec*1000000000ULL+(uint64_t)timer_spec.it_value.tv_nsec;if(now_ns>=g_runtime.bootstrap.deadline_ns||remaining_ns>g_runtime.bootstrap.deadline_ns-now_ns)return -1;
  return 0;
}

static int parse_receipt_node(struct bps09_json_parser *parser, int node, const char *required_producer, const char *required_outcome, char *sha_output, char *subject_output) {
  static const char *const keys[] = { "sha256", "byteLength", "producer", "outcome", "subjectSha256", "attemptId", "runId", "sessionId", "decision", "authority" };
  char receipt_bytes[32]; uint64_t ignored;
  if (json_object_exact(parser, node, keys, sizeof keys / sizeof keys[0]) != 0 || copy_json_string(parser, node, "sha256", sha_output, 65U) != 0 || copy_json_string(parser, node, "subjectSha256", subject_output, 65U) != 0 || !lowercase_sha256(sha_output) || !lowercase_sha256(subject_output) ||
      copy_json_string(parser, node, "byteLength", receipt_bytes, sizeof receipt_bytes) != 0 || parse_u64(receipt_bytes, &ignored) != 0 ||
      !json_string_equals(parser, node, "producer", required_producer) || !json_string_equals(parser, node, "outcome", required_outcome) ||
      !json_string_equals(parser, node, "attemptId", g_runtime.bootstrap.attempt_id) || !json_string_equals(parser, node, "runId", g_runtime.bootstrap.run_id) || !json_string_equals(parser, node, "sessionId", g_runtime.bootstrap.session_id) ||
      !json_string_equals(parser, node, "decision", "HOLD") || !json_string_equals(parser, node, "authority", "NONE")) return -1;
  return 0;
}

static bool accepted_recovery_producer(const char *value) {
  static const char *const accepted[] = { "INSTALL_WATCHDOG_PUBLICATION_RECEIPT", "EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT", "INSTALL_WATCHDOG_ABORT_RECEIPT", "EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT" };
  for (size_t index = 0U; index < sizeof accepted / sizeof accepted[0]; ++index) if (strcmp(value, accepted[index]) == 0) return true;
  return false;
}

static int json_array_exact_strings(struct bps09_json_parser *parser, int array, const char *const *values, size_t count) {
  if (array < 0 || parser->nodes[array].type != BPS09_JSON_ARRAY) return -1;
  int child = parser->nodes[array].first_child;
  for (size_t index = 0U; index < count; ++index) {
    if (child < 0 || parser->nodes[child].type != BPS09_JSON_STRING || strcmp(parser->nodes[child].string, values[index]) != 0) return -1;
    child = parser->nodes[child].next_sibling;
  }
  return child == -1 ? 0 : -1;
}

struct bps09_linux_dirent64 { uint64_t ino; int64_t off; unsigned short reclen; unsigned char type; char name[]; };

static int verify_exact_inherited_fd_table(void) {
  int directory_fd = open("/proc/self/fd", O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (directory_fd < 0) return -1;
  static const int required[] = {
    0, 1, 2, BPS09_FD_BOOTSTRAP, BPS09_FD_SOURCE_ARTIFACT, BPS09_FD_INSTALL_PARENT,
    BPS09_FD_WATCHDOG, BPS09_FD_OBSERVER, BPS09_FD_CUSTODIAN,
    BPS09_FD_OPERATION_TIMER, BPS09_FD_TEARDOWN_TIMER, BPS09_FD_ANCHOR_RECEIPT,
    BPS09_FD_OWNER_ROOT_KEY_ANCHOR, BPS09_FD_WATCHDOG_PIDFD, BPS09_FD_OBSERVER_PIDFD,
    BPS09_FD_CUSTODIAN_PIDFD, BPS09_FD_ONE_SHOT_CAS_TOKEN, BPS09_FD_RUNTIME_BINDING_RECEIPT,
    BPS09_FD_EVIDENCE, BPS09_FD_SELF_IMAGE, BPS09_FD_RECOVERY_QUARANTINE,
    BPS09_FD_KERNEL_BINDING_DESCRIPTOR, BPS09_FD_RUNTIME_BINDING_PROVIDER
  };
  bool seen[25] = { false }, required_map[25] = { false };
  for(size_t index=0U;index<sizeof required/sizeof required[0];++index)required_map[required[index]]=true;
  unsigned char buffer[4096];
  for (;;) {
    long bytes = syscall(SYS_getdents64, directory_fd, buffer, sizeof buffer);
    if (bytes < 0 && errno == EINTR) continue;
    if (bytes < 0) { close(directory_fd); return -1; }
    if (bytes == 0) break;
    for (long offset = 0; offset < bytes;) {
      struct bps09_linux_dirent64 *entry = (struct bps09_linux_dirent64 *)(void *)(buffer + offset);
      if (entry->reclen == 0U || offset + entry->reclen > bytes) { close(directory_fd); return -1; }
      if (strcmp(entry->name, ".") != 0 && strcmp(entry->name, "..") != 0) {
        char *end = NULL; errno = 0; long parsed = strtol(entry->name, &end, 10);
        if (errno != 0 || end == entry->name || *end != '\0' || parsed < 0 || (parsed != directory_fd && (parsed > 24 || !required_map[parsed]))) { close(directory_fd); return -1; }
        if (parsed != directory_fd) { if (seen[parsed]) { close(directory_fd); return -1; } seen[parsed] = true; }
      }
      offset += entry->reclen;
    }
  }
  if (close(directory_fd) != 0) return -1;
  for (size_t index = 0U; index < sizeof required/sizeof required[0]; ++index) if (!seen[required[index]]) return -1;
  struct stat st;
  char target[64],path[64];
  const int sockets[]={BPS09_FD_WATCHDOG,BPS09_FD_OBSERVER,BPS09_FD_CUSTODIAN};
  const int timers[]={BPS09_FD_OPERATION_TIMER,BPS09_FD_TEARDOWN_TIMER};
  const int pidfds[]={BPS09_FD_WATCHDOG_PIDFD,BPS09_FD_OBSERVER_PIDFD,BPS09_FD_CUSTODIAN_PIDFD};
  const int regulars[]={BPS09_FD_BOOTSTRAP,BPS09_FD_SOURCE_ARTIFACT,BPS09_FD_ANCHOR_RECEIPT,BPS09_FD_OWNER_ROOT_KEY_ANCHOR,BPS09_FD_RUNTIME_BINDING_RECEIPT,BPS09_FD_EVIDENCE,BPS09_FD_SELF_IMAGE,BPS09_FD_KERNEL_BINDING_DESCRIPTOR,BPS09_FD_RUNTIME_BINDING_PROVIDER};
  if(fstat(BPS09_FD_INSTALL_PARENT,&st)!=0||!S_ISDIR(st.st_mode)||fstat(BPS09_FD_RECOVERY_QUARANTINE,&st)!=0||!S_ISDIR(st.st_mode))return -1;
  for(size_t index=0U;index<sizeof regulars/sizeof regulars[0];++index)if(fstat(regulars[index],&st)!=0||!S_ISREG(st.st_mode))return -1;
  for(size_t index=0U;index<sizeof sockets/sizeof sockets[0];++index){int type=0;socklen_t length=sizeof type;if(fstat(sockets[index],&st)!=0||!S_ISSOCK(st.st_mode)||(fcntl(sockets[index],F_GETFL)&O_NONBLOCK)==0||getsockopt(sockets[index],SOL_SOCKET,SO_TYPE,&type,&length)!=0||type!=SOCK_SEQPACKET)return -1;}
  for(size_t index=0U;index<sizeof timers/sizeof timers[0];++index){int length=snprintf(path,sizeof path,"/proc/self/fd/%d",timers[index]);if(length<=0||(size_t)length>=sizeof path)return -1;ssize_t bytes=readlink(path,target,sizeof target-1U);if(bytes<=0||(size_t)bytes>=sizeof target)return -1;target[bytes]='\0';if(strcmp(target,"anon_inode:[timerfd]")!=0||(fcntl(timers[index],F_GETFL)&O_NONBLOCK)==0)return -1;}
  for(size_t index=0U;index<sizeof pidfds/sizeof pidfds[0];++index){int length=snprintf(path,sizeof path,"/proc/self/fd/%d",pidfds[index]);if(length<=0||(size_t)length>=sizeof path)return -1;ssize_t bytes=readlink(path,target,sizeof target-1U);if(bytes<=0||(size_t)bytes>=sizeof target)return -1;target[bytes]='\0';if(strcmp(target,"anon_inode:[pidfd]")!=0)return -1;struct pollfd live={.fd=pidfds[index],.events=0};if(poll(&live,1,0)!=0||live.revents!=0)return -1;}
  if(fstat(BPS09_FD_ONE_SHOT_CAS_TOKEN,&st)!=0||!S_ISFIFO(st.st_mode))return -1;
  for(size_t left=3U;left<sizeof required/sizeof required[0];++left)for(size_t right=left+1U;right<sizeof required/sizeof required[0];++right)if(syscall(SYS_kcmp,getpid(),getpid(),KCMP_FILE,(unsigned long)required[left],(unsigned long)required[right])==0)return -1;
  return 0;
}

static int validate_install_or_recover_invocation(int argc, char **argv) {
  if (argc != 2 || argv == NULL || argv[1] == NULL) return -1;
  if (strcmp(argv[1], "--install") == 0) g_runtime.bootstrap.mode = BPS09_MODE_INSTALL;
  else if (strcmp(argv[1], "--recover") == 0) g_runtime.bootstrap.mode = BPS09_MODE_RECOVER;
  else return -1;
  if (verify_exact_inherited_fd_table() != 0) return -1;
  if (replay_fd12_owner_root_key_anchor_same_handle() != 0 || verify_fd11_anchor_receipt_ocms_v1() != 0 || verify_runtime_binding_before_fd3() != 0) return -1;
  static const int inherited[]={3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,20,21,22,23,24};
  for (size_t index=0U;index<sizeof inherited/sizeof inherited[0];++index) { int fd=inherited[index];
    int flags = fcntl(fd, F_GETFD);
    if (flags < 0 || (flags & FD_CLOEXEC) != 0 || fcntl(fd, F_SETFD, flags | FD_CLOEXEC) != 0 || (fcntl(fd, F_GETFD) & FD_CLOEXEC) == 0) return -1;
  }
  return 0;
}

static int load_and_validate_native_bootstrap(void) {
  static const char *const install_keys[] = { "schema", "kind", "attemptId", "runId", "sessionId", "compileReviewReceipt", "targetArtifact", "installerArtifact", "destinationParent", "tempName", "finalName", "deadline", "capabilityDomain", "toolchainFields", "decision", "authority" };
  static const char *const recovery_keys[] = { "schema", "kind", "attemptId", "runId", "sessionId", "actualPriorReceipt", "acceptedProducerTypes", "acceptedProducerSetSha256", "identityLedger", "tempName", "finalName", "deadline", "capabilityDomain", "toolchainFields", "decision", "authority" };
  static const char *const ledger_keys[] = { "parent", "temp", "final", "publicationCasSha256" };
  static const char *const recovery_producers[] = { "INSTALL_WATCHDOG_PUBLICATION_RECEIPT", "EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT", "INSTALL_WATCHDOG_ABORT_RECEIPT", "EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT" };
  char *json = NULL; size_t bytes = 0U; struct bps09_json_parser parser;
  if (load_json_record(BPS09_FD_BOOTSTRAP, &json, &bytes) != 0) return -1;
  {struct bps09_sha256_context context;unsigned char digest[32];bps09_sha256_init(&context);bps09_sha256_update(&context,json,bytes);bps09_sha256_update(&context,"\n",1U);bps09_sha256_final(&context,digest);bps09_digest_hex(digest,g_runtime.bootstrap_sha256);}
  int root = json_parse_exact(json, bytes, &parser);
  bool ok = root >= 0 && json_string_equals(&parser, root, "schema", BPS09_SCHEMA) &&
    g_trust_anchor.fd12_verified && g_trust_anchor.fd11_verified && g_runtime.phase == BPS09_PHASE_FD11_OCMS_VERIFIED &&
    copy_json_string(&parser, root, "attemptId", g_runtime.bootstrap.attempt_id, sizeof g_runtime.bootstrap.attempt_id) == 0 &&
    copy_json_string(&parser, root, "runId", g_runtime.bootstrap.run_id, sizeof g_runtime.bootstrap.run_id) == 0 &&
    copy_json_string(&parser, root, "sessionId", g_runtime.bootstrap.session_id, sizeof g_runtime.bootstrap.session_id) == 0 &&
    strcmp(g_runtime.bootstrap.attempt_id,g_trust_anchor.attempt_id)==0 && strcmp(g_runtime.bootstrap.run_id,g_trust_anchor.run_id)==0 && strcmp(g_runtime.bootstrap.session_id,g_trust_anchor.session_id)==0 &&
    json_string_equals(&parser, root, "decision", "HOLD") && json_string_equals(&parser, root, "authority", "NONE");
  if (ok && g_runtime.bootstrap.mode == BPS09_MODE_INSTALL) {
    int toolchain = json_child(&parser, root, "toolchainFields");
    ok = json_object_exact(&parser, root, install_keys, sizeof install_keys / sizeof install_keys[0]) == 0 &&
      json_string_equals(&parser, root, "kind", "INSTALL_BOOTSTRAP") && json_string_equals(&parser, root, "capabilityDomain", "INSTALL_OR_RECOVER_ONLY") &&
      toolchain >= 0 && parser.nodes[toolchain].type == BPS09_JSON_NULL &&
      copy_json_string(&parser, root, "tempName", g_runtime.bootstrap.temp_name, sizeof g_runtime.bootstrap.temp_name) == 0 && canonical_name(g_runtime.bootstrap.temp_name) &&
      copy_json_string(&parser, root, "finalName", g_runtime.bootstrap.final_name, sizeof g_runtime.bootstrap.final_name) == 0 && canonical_name(g_runtime.bootstrap.final_name) && strcmp(g_runtime.bootstrap.temp_name, g_runtime.bootstrap.final_name) != 0 &&
      parse_claim_node(&parser, json_child(&parser, root, "targetArtifact"), &g_runtime.bootstrap.target) == 0 &&
      parse_claim_node(&parser, json_child(&parser, root, "installerArtifact"), &g_runtime.bootstrap.installer) == 0 &&
      parse_claim_node(&parser, json_child(&parser, root, "destinationParent"), &g_runtime.bootstrap.parent) == 0 &&
      parse_receipt_node(&parser, json_child(&parser, root, "compileReviewReceipt"), "INDEPENDENT_COMPILE_REVIEW", BPS09_COMPILE_REVIEW_OUTCOME, g_runtime.bootstrap.compile_review_sha256, g_runtime.bootstrap.compile_review_subject_sha256) == 0 &&
      parse_deadline_node(&parser, json_child(&parser, root, "deadline")) == 0;
  } else if (ok && g_runtime.bootstrap.mode == BPS09_MODE_RECOVER) {
    int toolchain = json_child(&parser, root, "toolchainFields"), ledger = json_child(&parser, root, "identityLedger");
    int prior = json_child(&parser, root, "actualPriorReceipt");
    const char *prior_producer = json_string_value(&parser, prior, "producer");
    int temp = json_child(&parser, ledger, "temp"), final = json_child(&parser, ledger, "final");
    ok = json_object_exact(&parser, root, recovery_keys, sizeof recovery_keys / sizeof recovery_keys[0]) == 0 &&
      json_string_equals(&parser, root, "kind", "RECOVERY_BOOTSTRAP") && json_string_equals(&parser, root, "capabilityDomain", "INSTALL_OR_RECOVER_ONLY") &&
      toolchain >= 0 && parser.nodes[toolchain].type == BPS09_JSON_NULL &&
      json_array_exact_strings(&parser, json_child(&parser, root, "acceptedProducerTypes"), recovery_producers, sizeof recovery_producers / sizeof recovery_producers[0]) == 0 &&
      copy_json_string(&parser, root, "acceptedProducerSetSha256", g_runtime.bootstrap.accepted_producer_set_sha256, sizeof g_runtime.bootstrap.accepted_producer_set_sha256) == 0 && strcmp(g_runtime.bootstrap.accepted_producer_set_sha256, BPS09_RECOVERY_PRODUCER_SET_SHA256) == 0 &&
      prior_producer != NULL && accepted_recovery_producer(prior_producer) && strlen(prior_producer) < sizeof g_runtime.bootstrap.actual_prior_producer &&
      parse_receipt_node(&parser, prior, prior_producer, "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD", g_runtime.bootstrap.actual_prior_receipt_sha256, g_runtime.bootstrap.actual_prior_subject_sha256) == 0 &&
      json_object_exact(&parser, ledger, ledger_keys, sizeof ledger_keys / sizeof ledger_keys[0]) == 0 &&
      parse_claim_node(&parser, json_child(&parser, ledger, "parent"), &g_runtime.bootstrap.parent) == 0 &&
      copy_json_string(&parser, ledger, "publicationCasSha256", g_runtime.bootstrap.publication_cas_sha256, sizeof g_runtime.bootstrap.publication_cas_sha256) == 0 && lowercase_sha256(g_runtime.bootstrap.publication_cas_sha256) &&
      copy_json_string(&parser, root, "tempName", g_runtime.bootstrap.temp_name, sizeof g_runtime.bootstrap.temp_name) == 0 && canonical_name(g_runtime.bootstrap.temp_name) &&
      copy_json_string(&parser, root, "finalName", g_runtime.bootstrap.final_name, sizeof g_runtime.bootstrap.final_name) == 0 && canonical_name(g_runtime.bootstrap.final_name) && strcmp(g_runtime.bootstrap.temp_name, g_runtime.bootstrap.final_name) != 0 &&
      parse_deadline_node(&parser, json_child(&parser, root, "deadline")) == 0;
    if (ok) memcpy(g_runtime.bootstrap.actual_prior_producer, prior_producer, strlen(prior_producer) + 1U);
    if (ok && temp >= 0 && parser.nodes[temp].type != BPS09_JSON_NULL) {
      ok = parse_claim_node(&parser, temp, &g_runtime.bootstrap.recovery_temp) == 0;
      g_runtime.bootstrap.recovery_temp_claim_present = ok;
    }
    if (ok && final >= 0 && parser.nodes[final].type != BPS09_JSON_NULL) {
      ok = parse_claim_node(&parser, final, &g_runtime.bootstrap.recovery_final) == 0;
      g_runtime.bootstrap.recovery_final_claim_present = ok;
    }
    if (ok && g_runtime.bootstrap.recovery_temp_claim_present) {
      char derived[192]; ok = basename_beneath_claim(&g_runtime.bootstrap.parent, &g_runtime.bootstrap.recovery_temp, derived, sizeof derived) == 0 && strcmp(derived, g_runtime.bootstrap.temp_name) == 0;
    }
    if (ok && g_runtime.bootstrap.recovery_final_claim_present) {
      char derived[192]; ok = basename_beneath_claim(&g_runtime.bootstrap.parent, &g_runtime.bootstrap.recovery_final, derived, sizeof derived) == 0 && strcmp(derived, g_runtime.bootstrap.final_name) == 0;
    }
    if(ok){char ledger_subject[65];ok=strcmp(g_runtime.bootstrap.actual_prior_receipt_sha256,g_runtime.bootstrap.accepted_producer_set_sha256)!=0&&compute_recovery_ledger_subject(ledger_subject)==0&&strcmp(ledger_subject,g_runtime.bootstrap.actual_prior_subject_sha256)==0;}
    if(ok&&strcmp(g_runtime.bootstrap.actual_prior_producer,"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT")==0&&!g_runtime.bootstrap.recovery_final_claim_present)ok=false;
  } else ok = false;
  if(ok)ok=g_runtime.bootstrap.deadline_ns==g_trust_anchor.teardown_deadline_monotonic_ns&&g_runtime.bootstrap.deadline_ns>g_trust_anchor.operation_deadline_monotonic_ns;
  free(json);
  if (!ok) return -1;
  g_runtime.phase = BPS09_PHASE_BOOTSTRAP_VALIDATED; return 0;
}

static int statx_fd(int fd, struct statx *out) {
  memset(out, 0, sizeof *out);
  return (int)syscall(SYS_statx, fd, "", AT_EMPTY_PATH | AT_STATX_SYNC_AS_STAT, STATX_BASIC_STATS | STATX_MNT_ID, out);
}

static int read_fdinfo_exact(int fd, unsigned char *output, size_t capacity, size_t *output_bytes) {
  char path[64]; int length=snprintf(path,sizeof path,"/proc/self/fdinfo/%d",fd); if(length<=0||(size_t)length>=sizeof path)return -1;
  int info=open(path,O_RDONLY|O_CLOEXEC|O_NOFOLLOW); if(info<0)return -1;
  size_t used=0U;
  for(;;){if(used==capacity){close(info);return -1;}ssize_t got=read(info,output+used,capacity-used);if(got<0&&errno==EINTR)continue;if(got<0){close(info);return -1;}if(got==0)break;if(memchr(output+used,'\r',(size_t)got)!=NULL||memchr(output+used,'\0',(size_t)got)!=NULL){close(info);return -1;}used+=(size_t)got;}
  if(close(info)!=0||used==0U){return -1;}*output_bytes=used;return 0;
}

static int decode_lower_hex_exact(const char *hex,unsigned char *output,size_t output_bytes) {
  if(hex==NULL||strlen(hex)!=output_bytes*2U)return -1;
  for(size_t index=0U;index<output_bytes;++index){unsigned char pair[2];for(size_t nibble=0U;nibble<2U;++nibble){char value=hex[index*2U+nibble];if(value>='0'&&value<='9')pair[nibble]=(unsigned char)(value-'0');else if(value>='a'&&value<='f')pair[nibble]=(unsigned char)(value-'a'+10);else return -1;}output[index]=(unsigned char)((pair[0]<<4U)|pair[1]);}
  return 0;
}

static bool firmware_at_least_2_12_4(const char *version) {
  unsigned long fields[3]={0U,0U,0U};const char *cursor=version;
  if(version==NULL||*version=='\0')return false;
  for(size_t index=0U;index<3U;++index){if(*cursor<'0'||*cursor>'9'||(*cursor=='0'&&cursor[1]>='0'&&cursor[1]<='9'))return false;char *end=NULL;errno=0;fields[index]=strtoul(cursor,&end,10);if(errno!=0||end==cursor)return false;if(index<2U){if(*end!='.')return false;cursor=end+1U;}else if(*end!='\0')return false;}
  return fields[0]>2U||(fields[0]==2U&&(fields[1]>12U||(fields[1]==12U&&fields[2]>=4U)));
}

static int observe_native_peer_projection(int endpoint_fd,const char *role,struct ucred *credentials,char channel_ofd_sha256[65],char principal_sha256[65]) {
  struct stat socket_stat;int socket_type=0,flags=fcntl(endpoint_fd,F_GETFL);socklen_t type_bytes=sizeof socket_type,credential_bytes=sizeof *credentials;char channel_projection[512],projection[1024];
  if((endpoint_fd!=BPS09_FD_WATCHDOG&&endpoint_fd!=BPS09_FD_OBSERVER&&endpoint_fd!=BPS09_FD_CUSTODIAN)||role==NULL||flags<0||
     getsockopt(endpoint_fd,SOL_SOCKET,SO_TYPE,&socket_type,&type_bytes)!=0||type_bytes!=sizeof socket_type||socket_type!=SOCK_SEQPACKET||
     getsockopt(endpoint_fd,SOL_SOCKET,SO_PEERCRED,credentials,&credential_bytes)!=0||credential_bytes!=sizeof *credentials||credentials->pid<=0||credentials->pid==getpid()||
     fstat(endpoint_fd,&socket_stat)!=0||!S_ISSOCK(socket_stat.st_mode))return -1;
  int channel_bytes=snprintf(channel_projection,sizeof channel_projection,"dev=%llu\nino=%llu\nmode=%llu\ntype=%d\nflags=%d\npid=%ld\nuid=%lu\ngid=%lu\n",(unsigned long long)socket_stat.st_dev,(unsigned long long)socket_stat.st_ino,(unsigned long long)socket_stat.st_mode,socket_type,flags,(long)credentials->pid,(unsigned long)credentials->uid,(unsigned long)credentials->gid);
  if(channel_bytes<=0||(size_t)channel_bytes>=sizeof channel_projection)return -1;bps09_sha256_bytes_hex(channel_projection,(size_t)channel_bytes,channel_ofd_sha256);
  int bytes=snprintf(projection,sizeof projection,"{\"schema\":\"iat-b3-bps09-native-peer-principal/v1\",\"role\":\"%s\",\"pid\":\"%ld\",\"uid\":\"%lu\",\"gid\":\"%lu\",\"channelOpenFileDescriptionSha256\":\"%s\"}\n",role,(long)credentials->pid,(unsigned long)credentials->uid,(unsigned long)credentials->gid,channel_ofd_sha256);
  if(bytes<=0||(size_t)bytes>=sizeof projection)return -1;bps09_sha256_bytes_hex(projection,(size_t)bytes,principal_sha256);return 0;
}

static int observe_native_timer_ofd(int timer_fd,uint64_t expected_deadline_ns,char ofd_sha256[65]) {
  struct stat timer_stat;char target[64],path[64],projection[256];int path_bytes=snprintf(path,sizeof path,"/proc/self/fd/%d",timer_fd);if(path_bytes<=0||(size_t)path_bytes>=sizeof path)return -1;ssize_t target_bytes=readlink(path,target,sizeof target-1U);
  if((timer_fd!=BPS09_FD_OPERATION_TIMER&&timer_fd!=BPS09_FD_TEARDOWN_TIMER)||target_bytes<=0||(size_t)target_bytes>=sizeof target)return -1;target[target_bytes]='\0';
  struct itimerspec timer;struct timespec before,after;struct pollfd ready={.fd=timer_fd,.events=POLLIN|POLLERR|POLLHUP};int flags=fcntl(timer_fd,F_GETFL);
  if(fstat(timer_fd,&timer_stat)!=0||strcmp(target,"anon_inode:[timerfd]")!=0||flags<0||(flags&O_NONBLOCK)==0||poll(&ready,1,0)!=0||clock_gettime(CLOCK_MONOTONIC,&before)!=0||timerfd_gettime(timer_fd,&timer)!=0||clock_gettime(CLOCK_MONOTONIC,&after)!=0||before.tv_sec<0||after.tv_sec<0||timer.it_interval.tv_sec!=0||timer.it_interval.tv_nsec!=0||(timer.it_value.tv_sec==0&&timer.it_value.tv_nsec==0))return -1;
  uint64_t before_ns=(uint64_t)before.tv_sec*1000000000ULL+(uint64_t)before.tv_nsec,after_ns=(uint64_t)after.tv_sec*1000000000ULL+(uint64_t)after.tv_nsec,remaining_ns=(uint64_t)timer.it_value.tv_sec*1000000000ULL+(uint64_t)timer.it_value.tv_nsec;if(expected_deadline_ns<=after_ns||before_ns>UINT64_MAX-remaining_ns||after_ns>UINT64_MAX-remaining_ns)return -1;uint64_t lower=before_ns+remaining_ns,upper=after_ns+remaining_ns,upper_tolerant=upper>UINT64_MAX-10000000ULL?UINT64_MAX:upper+10000000ULL,expected_tolerant=expected_deadline_ns>UINT64_MAX-10000000ULL?UINT64_MAX:expected_deadline_ns+10000000ULL;if(expected_tolerant<lower||expected_deadline_ns>upper_tolerant)return -1;
  int projection_bytes=snprintf(projection,sizeof projection,"{\"schema\":\"iat-b3-bps08a-timer/v1\",\"fd\":\"%d\",\"clock\":\"CLOCK_MONOTONIC\",\"deadlineMonotonicNs\":\"%" PRIu64 "\",\"nonblocking\":true}\n",timer_fd,expected_deadline_ns);if(projection_bytes<=0||(size_t)projection_bytes>=sizeof projection)return -1;bps09_sha256_bytes_hex(projection,(size_t)projection_bytes,ofd_sha256);return 0;
}

static int replay_fd12_owner_root_key_anchor_same_handle(void) {
  static const char exact_seals[]="F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE";
  struct stat before,after;struct statx stx_before,stx_after;unsigned char root[32],extra,fdinfo_before[4096],fdinfo_after[4096];size_t fdinfo_before_bytes=0U,fdinfo_after_bytes=0U;
  char target[256],content_sha256[65],ofd_sha256[65],handle_sha256[65],descriptor_sha256[65],handle[8192],descriptor[12288];ssize_t target_bytes;
  int flags=fcntl(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,F_GETFL),seals=fcntl(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,F_GET_SEALS);
  if(strcmp(exact_seals,"F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE|F_SEAL_FUTURE_WRITE")!=0||
     fstat(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,&before)!=0||statx_fd(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,&stx_before)!=0||
     !S_ISREG(before.st_mode)||before.st_nlink!=0||before.st_uid!=0||(before.st_mode&07777U)!=0400U||
     flags<0||(flags&O_ACCMODE)!=O_RDONLY||seals!=BPS09_REQUIRED_MEMFD_SEALS)return -1;
  target_bytes=readlink("/proc/self/fd/12",target,sizeof target-1U);if(target_bytes<=0||(size_t)target_bytes>=sizeof target)return -1;target[target_bytes]='\0';
  if(strstr(target,"memfd:")==NULL||strstr(target," (deleted)")==NULL)return -1;
  if(pread(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,root,sizeof root,0)!=(ssize_t)sizeof root||pread(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,&extra,1U,32)!=0)return -1;
  if(read_fdinfo_exact(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,fdinfo_before,sizeof fdinfo_before,&fdinfo_before_bytes)!=0)return -1;
  if(fstat(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,&after)!=0||statx_fd(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,&stx_after)!=0||
     read_fdinfo_exact(BPS09_FD_OWNER_ROOT_KEY_ANCHOR,fdinfo_after,sizeof fdinfo_after,&fdinfo_after_bytes)!=0||
     before.st_dev!=after.st_dev||before.st_ino!=after.st_ino||before.st_size!=after.st_size||before.st_mode!=after.st_mode||
     before.st_uid!=after.st_uid||before.st_gid!=after.st_gid||before.st_nlink!=after.st_nlink||
     stx_before.stx_mnt_id!=stx_after.stx_mnt_id||fdinfo_before_bytes!=fdinfo_after_bytes||memcmp(fdinfo_before,fdinfo_after,fdinfo_before_bytes)!=0)return -1;
  bps09_sha256_bytes_hex(root,sizeof root,content_sha256);bps09_sha256_bytes_hex(fdinfo_before,fdinfo_before_bytes,ofd_sha256);
  char root_hex[65];bps09_digest_hex(root,root_hex);
  if(strcmp(root_hex,BPS09_ROOT_PUBLIC_KEY_HEX)!=0||strcmp(content_sha256,BPS09_ROOT_FINGERPRINT_SHA256)!=0||
     strcmp(BPS09_OWNER_PROVISIONING_RECEIPT_SHA256,"3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a")!=0||
     strcmp(BPS09_BPK00_COMMIT,"512b347ebf4de80bf5a50e0d8491f14eeef0f9f0")!=0||
     strcmp(BPS09_BPK00_TREE,"c4e8e6ca1c54e9154743dd2fea7b434307d74676")!=0||
     strcmp(BPS09_BPK00_BLOB,"8e38e773ed4f11a4aefd8787c63c535775056c1a")!=0||
     strcmp(BPS09_BPK00_FILE_SHA256,"7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21")!=0)return -1;
  int handle_bytes=snprintf(handle,sizeof handle,
    "{\"domain\":\"IAT_B3_BPS09_FD12_OWNER_ROOT_KEY_HANDLE_V1\",\"checkpointCommit\":\"%s\",\"checkpointTree\":\"%s\",\"checkpointBlob\":\"%s\",\"checkpointPath\":\"%s\",\"checkpointFileSha256\":\"%s\",\"checkpointFileByteLength\":\"%s\",\"fd\":\"12\",\"contentSha256\":\"%s\",\"byteLength\":\"32\",\"dev\":\"%" PRIu64 "\",\"ino\":\"%" PRIu64 "\",\"mountId\":\"%" PRIu64 "\",\"nlink\":\"0\",\"mode\":\"0400\",\"uid\":\"0\",\"gid\":\"%u\",\"sealSet\":\"%s\"}\n",
    BPS09_BPK00_COMMIT,BPS09_BPK00_TREE,BPS09_BPK00_BLOB,BPS09_BPK00_PATH,BPS09_BPK00_FILE_SHA256,BPS09_BPK00_FILE_BYTES,content_sha256,(uint64_t)before.st_dev,(uint64_t)before.st_ino,(uint64_t)stx_before.stx_mnt_id,(unsigned)before.st_gid,exact_seals);
  if(handle_bytes<=0||(size_t)handle_bytes>=sizeof handle)return -1;bps09_sha256_bytes_hex(handle,(size_t)handle_bytes,handle_sha256);
  int descriptor_bytes=snprintf(descriptor,sizeof descriptor,
    "{\"schema\":\"iat-b3-bps09-fd12-owner-root-key-anchor-descriptor/v1\",\"producer\":\"BPK00\",\"outcome\":\"%s\",\"checkpointCommit\":\"%s\",\"checkpointTree\":\"%s\",\"checkpointBlob\":\"%s\",\"checkpointPath\":\"%s\",\"checkpointFileSha256\":\"%s\",\"checkpointFileByteLength\":\"%s\",\"rootFingerprintSha256\":\"%s\",\"rootPublicKeyHex\":\"%s\",\"provisioningReceiptSha256\":\"%s\",\"fd\":\"12\",\"contentSha256\":\"%s\",\"byteLength\":\"32\",\"dev\":\"%" PRIu64 "\",\"ino\":\"%" PRIu64 "\",\"mountId\":\"%" PRIu64 "\",\"nlink\":\"0\",\"mode\":\"0400\",\"uid\":\"0\",\"gid\":\"%u\",\"sealSet\":\"%s\",\"handleSha256\":\"%s\",\"openFileDescriptionSha256\":\"%s\",\"sameHandleReplayRequired\":true,\"verifiedBeforeFd11\":true,\"verifiedBeforeFd3\":true,\"verifiedBeforePeerRpc\":true,\"decision\":\"HOLD\",\"authority\":\"NONE\"}\n",
    BPS09_BPK00_OUTCOME,BPS09_BPK00_COMMIT,BPS09_BPK00_TREE,BPS09_BPK00_BLOB,BPS09_BPK00_PATH,BPS09_BPK00_FILE_SHA256,BPS09_BPK00_FILE_BYTES,BPS09_ROOT_FINGERPRINT_SHA256,BPS09_ROOT_PUBLIC_KEY_HEX,BPS09_OWNER_PROVISIONING_RECEIPT_SHA256,content_sha256,(uint64_t)before.st_dev,(uint64_t)before.st_ino,(uint64_t)stx_before.stx_mnt_id,(unsigned)before.st_gid,exact_seals,handle_sha256,ofd_sha256);
  if(descriptor_bytes<=0||(size_t)descriptor_bytes>=sizeof descriptor)return -1;bps09_sha256_bytes_hex(descriptor,(size_t)descriptor_bytes,descriptor_sha256);
  for(int fd=BPS09_FD_BOOTSTRAP;fd<BPS09_FD_OWNER_ROOT_KEY_ANCHOR;++fd)if(syscall(SYS_kcmp,getpid(),getpid(),KCMP_FILE,(unsigned long)fd,(unsigned long)BPS09_FD_OWNER_ROOT_KEY_ANCHOR)==0)return -1;
  memcpy(g_trust_anchor.root_public_key,root,sizeof root);snprintf(g_trust_anchor.root_public_key_hex,sizeof g_trust_anchor.root_public_key_hex,"%s",root_hex);
  snprintf(g_trust_anchor.root_fingerprint_sha256,sizeof g_trust_anchor.root_fingerprint_sha256,"%s",content_sha256);
  snprintf(g_trust_anchor.provisioning_receipt_sha256,sizeof g_trust_anchor.provisioning_receipt_sha256,"%s",BPS09_OWNER_PROVISIONING_RECEIPT_SHA256);
  snprintf(g_trust_anchor.content_sha256,sizeof g_trust_anchor.content_sha256,"%s",content_sha256);snprintf(g_trust_anchor.handle_sha256,sizeof g_trust_anchor.handle_sha256,"%s",handle_sha256);
  snprintf(g_trust_anchor.ofd_sha256,sizeof g_trust_anchor.ofd_sha256,"%s",ofd_sha256);snprintf(g_trust_anchor.descriptor_sha256,sizeof g_trust_anchor.descriptor_sha256,"%s",descriptor_sha256);
  g_trust_anchor.dev=(uint64_t)before.st_dev;g_trust_anchor.ino=(uint64_t)before.st_ino;g_trust_anchor.mount_id=(uint64_t)stx_before.stx_mnt_id;g_trust_anchor.fd12_verified=true;g_runtime.phase=BPS09_PHASE_FD12_VERIFIED;return 0;
}

static int extract_canonical_subject(const char *json,size_t bytes,const char **subject,size_t *subject_bytes) {
  const char marker[]="\"subject\":";const char *found=NULL;
  for(size_t index=0U;index+sizeof marker-1U<bytes;++index)if(memcmp(json+index,marker,sizeof marker-1U)==0){if(found!=NULL)return -1;found=json+index+sizeof marker-1U;}
  if(found==NULL||*found!='{')return -1;bool quoted=false;unsigned depth=0U;
  for(const char *cursor=found;cursor<json+bytes;++cursor){if(*cursor=='\\')return -1;if(*cursor=='\"')quoted=!quoted;else if(!quoted&&*cursor=='{')++depth;else if(!quoted&&*cursor=='}'){if(depth==0U)return -1;if(--depth==0U){*subject=found;*subject_bytes=(size_t)(cursor-found+1U);return 0;}}}
  return -1;
}

static int verify_fd11_anchor_receipt_ocms_v1(void) {
  static const unsigned char ocms_prefix[16]={0xffU,0x73U,0x6fU,0x6cU,0x61U,0x6eU,0x61U,0x20U,0x6fU,0x66U,0x66U,0x63U,0x68U,0x61U,0x69U,0x6eU};
  static const char *const receipt_keys[]={"schema","producer","outcome","attemptId","runId","sessionId","subject","subjectSha256","ocmsVersion","hardwareMessageAscii","messageBodySha256","messageBodyByteLength","signerListSha256","signerListByteLength","serializedMessageSha256","serializedMessageByteLength","rootPublicKeyHex","signatureHex","signatureSha256","signatureByteLength","deviceReceiptSha256","decision","authority"};
  static const char *const subject_keys[]={"schema","attemptId","runId","sessionId","bootId","anchorNonceHex","anchorCasKeySha256","anchorCasAcquireReceiptSha256","anchorExpiresAtMonotonicNs","ownerRootFingerprintSha256","ownerRootPublicKeyHex","ownerRootProvisioningReceiptSha256","ownerRootKeyAnchorFd","ownerRootKeyAnchorProducer","ownerRootKeyAnchorOutcome","ownerRootKeyAnchorDescriptorSha256","ownerRootKeyAnchorDev","ownerRootKeyAnchorIno","ownerRootKeyAnchorMountId","ownerRootKeyAnchorHandleSha256","ownerRootKeyAnchorOpenFileDescriptionSha256","ownerRootKeyAnchorContentSha256","ownerRootKeyAnchorByteLength","deviceModel","deviceFirmwareVersion","deviceFirmwareIdentitySha256","deviceDerivationPath","deviceAccountPublicKeyHex","deviceAccountAddress","deviceReceiptSha256","physicalConfirmationReceiptSha256","ocmsVersion","ocmsSignerCount","ocmsSignerIndex","ocmsSignerPublicKeyHex","ocmsSignerListByteLength","ocmsSignerListSha256","bps05ManifestSha256","bps06ManifestSha256","bpc01Commit","bpc01Tree","bpc01ManifestSha256","successorExecutorSha256","sourceFdManifestSha256","toolchainManifestSha256","toolOpenFileDescriptionManifestSha256","sysrootManifestSha256","staticNodeIdentitySha256","launchArgvSha256","launchEnvironmentSha256","launchCwdIdentitySha256","startupClosureSha256","watchdogPublicKeyHex","observerPublicKeyHex","custodianPublicKeyHex","watchdogPrincipalSha256","observerPrincipalSha256","custodianPrincipalSha256","watchdogChannelOfdSha256","observerChannelOfdSha256","custodianChannelOfdSha256","operationTimerOfdSha256","operationDeadlineMonotonicNs","teardownTimerOfdSha256","teardownDeadlineMonotonicNs","decision","authority"};
  bool one_use_consumed=g_trust_anchor.one_use_consumed;if(one_use_consumed)return -1;
  if(!g_trust_anchor.fd12_verified||g_trust_anchor.fd11_verified||strcmp(BPS09_CAPABILITY_DOMAIN,"INSTALL_OR_RECOVER_ONLY")!=0)return -1;
  struct stat before,after;struct statx stx_before,stx_after;unsigned char fdinfo_before[4096],fdinfo_after[4096];size_t fdinfo_before_bytes=0U,fdinfo_after_bytes=0U;
  int flags=fcntl(BPS09_FD_ANCHOR_RECEIPT,F_GETFL),seals=fcntl(BPS09_FD_ANCHOR_RECEIPT,F_GET_SEALS);
  if(fstat(BPS09_FD_ANCHOR_RECEIPT,&before)!=0||statx_fd(BPS09_FD_ANCHOR_RECEIPT,&stx_before)!=0||!S_ISREG(before.st_mode)||before.st_nlink!=0||before.st_uid!=0||(before.st_mode&07777U)!=0400U||before.st_size<=1||before.st_size>(off_t)BPS09_MAX_BOOTSTRAP_BYTES||flags<0||(flags&O_ACCMODE)!=O_RDONLY||seals!=BPS09_REQUIRED_MEMFD_SEALS||read_fdinfo_exact(BPS09_FD_ANCHOR_RECEIPT,fdinfo_before,sizeof fdinfo_before,&fdinfo_before_bytes)!=0)return -1;
  size_t bytes=(size_t)before.st_size;char *json=malloc(bytes+1U);if(json==NULL)return -1;
  if(pread(BPS09_FD_ANCHOR_RECEIPT,json,bytes,0)!=(ssize_t)bytes||json[bytes-1U]!='\n'||memchr(json,'\r',bytes)!=NULL||memchr(json,'\0',bytes)!=NULL||memchr(json,'\n',bytes-1U)!=NULL){free(json);return -1;}json[bytes-1U]='\0';
  const char *subject_bytes=NULL;size_t subject_length=0U;if(extract_canonical_subject(json,bytes-1U,&subject_bytes,&subject_length)!=0){free(json);return -1;}
  struct bps09_sha256_context subject_context;unsigned char subject_digest[32];char subject_sha256[65];bps09_sha256_init(&subject_context);bps09_sha256_update(&subject_context,BPS09_BPS08_SUBJECT_DOMAIN,strlen(BPS09_BPS08_SUBJECT_DOMAIN));bps09_sha256_update(&subject_context,"\0",1U);bps09_sha256_update(&subject_context,subject_bytes,subject_length);bps09_sha256_update(&subject_context,"\n",1U);bps09_sha256_final(&subject_context,subject_digest);bps09_digest_hex(subject_digest,subject_sha256);
  struct bps09_json_parser parser;int root=json_parse_exact(json,bytes-1U,&parser),subject=json_child(&parser,root,"subject");
  char signature_hex[129],message[101],message_sha256[65],signer_sha256[65],serialized_sha256[65],signature_sha256[65],descriptor_before[65];
  char anchor_nonce_hex[65],anchor_cas_key_sha256[65],anchor_cas_acquire_receipt_sha256[65],anchor_expiry_text[32],operation_deadline_text[32],teardown_deadline_text[32];
  bool ok=root>=0&&json_object_exact(&parser,root,receipt_keys,sizeof receipt_keys/sizeof receipt_keys[0])==0&&json_object_exact(&parser,subject,subject_keys,sizeof subject_keys/sizeof subject_keys[0])==0&&
    json_string_equals(&parser,root,"schema",BPS09_BPS08_ANCHOR_SCHEMA)&&json_string_equals(&parser,subject,"schema","iat-b3-bps08-compile-peer-anchor-subject/v1")&&json_string_equals(&parser,root,"producer","EXTERNAL_PRELAUNCH_SUPERVISOR_ANCHOR_CUSTODIAN")&&json_string_equals(&parser,root,"outcome","COMPILE_PEER_TRUST_ANCHOR_HOLD")&&
    json_string_equals(&parser,root,"decision","HOLD")&&json_string_equals(&parser,root,"authority","NONE")&&json_string_equals(&parser,subject,"decision","HOLD")&&json_string_equals(&parser,subject,"authority","NONE")&&
    json_string_equals(&parser,root,"subjectSha256",subject_sha256)&&json_string_equals(&parser,subject,"ownerRootFingerprintSha256",BPS09_ROOT_FINGERPRINT_SHA256)&&
    json_string_equals(&parser,subject,"ownerRootPublicKeyHex",BPS09_ROOT_PUBLIC_KEY_HEX)&&json_string_equals(&parser,subject,"ownerRootProvisioningReceiptSha256",BPS09_OWNER_PROVISIONING_RECEIPT_SHA256)&&
    json_number_equals(&parser,subject,"ownerRootKeyAnchorFd","12")==0&&json_string_equals(&parser,subject,"ownerRootKeyAnchorProducer","BPK00")&&json_string_equals(&parser,subject,"ownerRootKeyAnchorOutcome",BPS09_BPK00_OUTCOME)&&
    json_string_equals(&parser,subject,"ownerRootKeyAnchorDescriptorSha256",g_trust_anchor.descriptor_sha256)&&json_string_equals(&parser,subject,"ownerRootKeyAnchorHandleSha256",g_trust_anchor.handle_sha256)&&
    json_string_equals(&parser,subject,"ownerRootKeyAnchorOpenFileDescriptionSha256",g_trust_anchor.ofd_sha256)&&json_string_equals(&parser,subject,"ownerRootKeyAnchorContentSha256",g_trust_anchor.content_sha256)&&
    json_string_equals(&parser,subject,"ownerRootKeyAnchorByteLength","32")&&json_string_equals(&parser,subject,"deviceModel","T2T1")&&firmware_at_least_2_12_4(json_string_value(&parser,subject,"deviceFirmwareVersion"))&&
    json_string_equals(&parser,subject,"deviceAccountPublicKeyHex",BPS09_ROOT_PUBLIC_KEY_HEX)&&json_number_equals(&parser,subject,"ocmsVersion","1")==0&&json_number_equals(&parser,subject,"ocmsSignerCount","1")==0&&json_number_equals(&parser,subject,"ocmsSignerIndex","0")==0&&
    json_string_equals(&parser,subject,"ocmsSignerPublicKeyHex",BPS09_ROOT_PUBLIC_KEY_HEX)&&json_number_equals(&parser,subject,"ocmsSignerListByteLength","33")==0&&json_number_equals(&parser,root,"ocmsVersion","1")==0&&
    json_string_equals(&parser,subject,"bps05ManifestSha256","09be6c33631845b2c300db6ba37157f667541335f00a9f31ec2e63df3d106b0b")&&json_string_equals(&parser,subject,"bps06ManifestSha256","9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c")&&
    json_string_equals(&parser,subject,"bpc01Commit","fd47774fe6523e181b792d187a4bae708f96ad9d")&&json_string_equals(&parser,subject,"bpc01Tree","1a81c083b9207eaa6f0d4dd74c4c562aa9268201")&&json_string_equals(&parser,subject,"bpc01ManifestSha256","504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513")&&
    json_string_equals(&parser,root,"rootPublicKeyHex",BPS09_ROOT_PUBLIC_KEY_HEX)&&copy_json_string(&parser,root,"signatureHex",signature_hex,sizeof signature_hex)==0;
  char dev[32],ino[32],mount[32];snprintf(dev,sizeof dev,"%" PRIu64,g_trust_anchor.dev);snprintf(ino,sizeof ino,"%" PRIu64,g_trust_anchor.ino);snprintf(mount,sizeof mount,"%" PRIu64,g_trust_anchor.mount_id);
  ok=ok&&json_string_equals(&parser,subject,"ownerRootKeyAnchorDev",dev)&&json_string_equals(&parser,subject,"ownerRootKeyAnchorIno",ino)&&json_string_equals(&parser,subject,"ownerRootKeyAnchorMountId",mount)&&
    copy_json_string(&parser,subject,"attemptId",g_trust_anchor.attempt_id,sizeof g_trust_anchor.attempt_id)==0&&copy_json_string(&parser,subject,"runId",g_trust_anchor.run_id,sizeof g_trust_anchor.run_id)==0&&copy_json_string(&parser,subject,"sessionId",g_trust_anchor.session_id,sizeof g_trust_anchor.session_id)==0&&
    json_string_equals(&parser,root,"attemptId",g_trust_anchor.attempt_id)&&json_string_equals(&parser,root,"runId",g_trust_anchor.run_id)&&json_string_equals(&parser,root,"sessionId",g_trust_anchor.session_id);
  const char *boot_id=json_string_value(&parser,subject,"bootId"),*derivation_path=json_string_value(&parser,subject,"deviceDerivationPath"),*device_address=json_string_value(&parser,subject,"deviceAccountAddress");
  const char *device_firmware_identity=json_string_value(&parser,subject,"deviceFirmwareIdentitySha256"),*device_receipt=json_string_value(&parser,subject,"deviceReceiptSha256"),*physical_confirmation=json_string_value(&parser,subject,"physicalConfirmationReceiptSha256");
  ok=ok&&copy_json_string(&parser,subject,"anchorNonceHex",anchor_nonce_hex,sizeof anchor_nonce_hex)==0&&copy_json_string(&parser,subject,"anchorCasKeySha256",anchor_cas_key_sha256,sizeof anchor_cas_key_sha256)==0&&
    copy_json_string(&parser,subject,"anchorCasAcquireReceiptSha256",anchor_cas_acquire_receipt_sha256,sizeof anchor_cas_acquire_receipt_sha256)==0&&copy_json_string(&parser,subject,"anchorExpiresAtMonotonicNs",anchor_expiry_text,sizeof anchor_expiry_text)==0&&
    copy_json_string(&parser,subject,"operationDeadlineMonotonicNs",operation_deadline_text,sizeof operation_deadline_text)==0&&copy_json_string(&parser,subject,"teardownDeadlineMonotonicNs",teardown_deadline_text,sizeof teardown_deadline_text)==0;
  uint64_t anchor_expires_at_monotonic_ns=0U,operation_deadline_monotonic_ns=0U,teardown_deadline_monotonic_ns=0U;struct timespec monotonic_now;uint64_t anchor_now_ns=0U;unsigned char anchor_nonce[32];
  ok=ok&&boot_id!=NULL&&boot_id[0]!='\0'&&strchr(boot_id,'\n')==NULL&&strchr(boot_id,'\r')==NULL&&decode_lower_hex_exact(anchor_nonce_hex,anchor_nonce,32U)==0&&nonzero_lower_hex_32(anchor_nonce_hex)&&
    lowercase_sha256(anchor_cas_key_sha256)&&lowercase_sha256(anchor_cas_acquire_receipt_sha256)&&nonzero_lower_hex_32(anchor_cas_key_sha256)&&nonzero_lower_hex_32(anchor_cas_acquire_receipt_sha256)&&
    strcmp(anchor_nonce_hex,anchor_cas_key_sha256)!=0&&strcmp(anchor_nonce_hex,anchor_cas_acquire_receipt_sha256)!=0&&strcmp(anchor_cas_key_sha256,anchor_cas_acquire_receipt_sha256)!=0&&
    strcmp(anchor_nonce_hex,BPS09_ROOT_PUBLIC_KEY_HEX)!=0&&strcmp(anchor_cas_key_sha256,subject_sha256)!=0&&strcmp(anchor_cas_acquire_receipt_sha256,subject_sha256)!=0&&
    parse_u64(anchor_expiry_text,&anchor_expires_at_monotonic_ns)==0&&parse_u64(operation_deadline_text,&operation_deadline_monotonic_ns)==0&&parse_u64(teardown_deadline_text,&teardown_deadline_monotonic_ns)==0&&
    clock_gettime(CLOCK_MONOTONIC,&monotonic_now)==0&&monotonic_now.tv_sec>=0&&(uint64_t)monotonic_now.tv_sec<=UINT64_MAX/1000000000ULL;
  if(ok)anchor_now_ns=(uint64_t)monotonic_now.tv_sec*1000000000ULL+(uint64_t)monotonic_now.tv_nsec;
  if(ok&&anchor_expires_at_monotonic_ns<=anchor_now_ns)ok=false;
  if(ok&&anchor_expires_at_monotonic_ns>operation_deadline_monotonic_ns)ok=false;
  if(ok&&operation_deadline_monotonic_ns>=teardown_deadline_monotonic_ns)ok=false;
  char expected_address[64];ok=ok&&base58_encode_32(g_trust_anchor.root_public_key,expected_address)==0&&derivation_path!=NULL&&strcmp(derivation_path,"m/44'/501'/0'/0'")==0&&device_address!=NULL&&strcmp(device_address,expected_address)==0&&
    nonzero_lower_hex_32(device_firmware_identity)&&nonzero_lower_hex_32(device_receipt)&&nonzero_lower_hex_32(physical_confirmation)&&strcmp(device_receipt,physical_confirmation)!=0&&strcmp(physical_confirmation,anchor_cas_acquire_receipt_sha256)!=0;
  const char *projection_fields[]={"successorExecutorSha256","sourceFdManifestSha256","toolchainManifestSha256","toolOpenFileDescriptionManifestSha256","sysrootManifestSha256","staticNodeIdentitySha256","launchArgvSha256","launchEnvironmentSha256","launchCwdIdentitySha256","startupClosureSha256"};
  for(size_t index=0U;ok&&index<sizeof projection_fields/sizeof projection_fields[0];++index)ok=nonzero_lower_hex_32(json_string_value(&parser,subject,projection_fields[index]));
  struct stat self_stat;char actual_self_sha256[65];if(ok)ok=fstat(BPS09_FD_SELF_IMAGE,&self_stat)==0&&S_ISREG(self_stat.st_mode)&&self_stat.st_size>0&&bps09_sha256_fd_hex(BPS09_FD_SELF_IMAGE,(uint64_t)self_stat.st_size,actual_self_sha256)==0&&json_string_equals(&parser,subject,"successorExecutorSha256",actual_self_sha256);
  const char *watchdog_key=json_string_value(&parser,subject,"watchdogPublicKeyHex"),*observer_key=json_string_value(&parser,subject,"observerPublicKeyHex"),*custodian_key=json_string_value(&parser,subject,"custodianPublicKeyHex");
  const char *watchdog_principal_anchor=json_string_value(&parser,subject,"watchdogPrincipalSha256"),*observer_principal_anchor=json_string_value(&parser,subject,"observerPrincipalSha256"),*custodian_principal_anchor=json_string_value(&parser,subject,"custodianPrincipalSha256");
  struct ucred watchdog_credentials,observer_credentials,custodian_credentials;char watchdog_ofd[65],observer_ofd[65],custodian_ofd[65],watchdog_local_principal[65],observer_local_principal[65],custodian_local_principal[65],operation_timer[65],teardown_timer[65];
  ok=ok&&nonzero_lower_hex_32(watchdog_key)&&nonzero_lower_hex_32(observer_key)&&nonzero_lower_hex_32(custodian_key)&&strcmp(watchdog_key,observer_key)!=0&&strcmp(watchdog_key,custodian_key)!=0&&strcmp(observer_key,custodian_key)!=0&&strcmp(watchdog_key,BPS09_ROOT_PUBLIC_KEY_HEX)!=0&&strcmp(observer_key,BPS09_ROOT_PUBLIC_KEY_HEX)!=0&&strcmp(custodian_key,BPS09_ROOT_PUBLIC_KEY_HEX)!=0&&
    nonzero_lower_hex_32(watchdog_principal_anchor)&&nonzero_lower_hex_32(observer_principal_anchor)&&nonzero_lower_hex_32(custodian_principal_anchor)&&strcmp(watchdog_principal_anchor,observer_principal_anchor)!=0&&strcmp(watchdog_principal_anchor,custodian_principal_anchor)!=0&&strcmp(observer_principal_anchor,custodian_principal_anchor)!=0&&
    observe_native_peer_projection(BPS09_FD_WATCHDOG,"watchdog",&watchdog_credentials,watchdog_ofd,watchdog_local_principal)==0&&observe_native_peer_projection(BPS09_FD_OBSERVER,"observer",&observer_credentials,observer_ofd,observer_local_principal)==0&&observe_native_peer_projection(BPS09_FD_CUSTODIAN,"custodian",&custodian_credentials,custodian_ofd,custodian_local_principal)==0&&
    watchdog_credentials.pid!=observer_credentials.pid&&watchdog_credentials.pid!=custodian_credentials.pid&&observer_credentials.pid!=custodian_credentials.pid&&watchdog_credentials.uid==0&&custodian_credentials.uid!=0&&custodian_credentials.uid!=geteuid()&&
    json_string_equals(&parser,subject,"watchdogChannelOfdSha256",watchdog_ofd)&&json_string_equals(&parser,subject,"observerChannelOfdSha256",observer_ofd)&&json_string_equals(&parser,subject,"custodianChannelOfdSha256",custodian_ofd)&&
    observe_native_timer_ofd(BPS09_FD_OPERATION_TIMER,operation_deadline_monotonic_ns,operation_timer)==0&&json_string_equals(&parser,subject,"operationTimerOfdSha256",operation_timer)&&observe_native_timer_ofd(BPS09_FD_TEARDOWN_TIMER,teardown_deadline_monotonic_ns,teardown_timer)==0&&json_string_equals(&parser,subject,"teardownTimerOfdSha256",teardown_timer)&&
    strcmp(operation_timer,teardown_timer)!=0&&strcmp(operation_timer,watchdog_ofd)!=0&&strcmp(operation_timer,observer_ofd)!=0&&strcmp(operation_timer,custodian_ofd)!=0&&strcmp(teardown_timer,watchdog_ofd)!=0&&strcmp(teardown_timer,observer_ofd)!=0&&strcmp(teardown_timer,custodian_ofd)!=0;
  int message_bytes=snprintf(message,sizeof message,"%s%s",BPS09_BPS08_BODY_PREFIX,subject_sha256);if(message_bytes!=100)ok=false;bps09_sha256_bytes_hex(message,100U,message_sha256);
  unsigned char signer_list[33];signer_list[0]=1U;memcpy(signer_list+1U,g_trust_anchor.root_public_key,32U);bps09_sha256_bytes_hex(signer_list,sizeof signer_list,signer_sha256);
  unsigned char signed_data[150];memcpy(signed_data,ocms_prefix,sizeof ocms_prefix);signed_data[16]=1U;signed_data[17]=1U;memcpy(signed_data+18U,g_trust_anchor.root_public_key,32U);memcpy(signed_data+50U,message,100U);bps09_sha256_bytes_hex(signed_data,sizeof signed_data,serialized_sha256);
  unsigned char signature[64];ok=ok&&decode_lower_hex_exact(signature_hex,signature,sizeof signature)==0;bps09_sha256_bytes_hex(signature,sizeof signature,signature_sha256);
  const char *subject_device_receipt=json_string_value(&parser,subject,"deviceReceiptSha256");
  ok=ok&&subject_device_receipt!=NULL&&lowercase_sha256(subject_device_receipt)&&json_string_equals(&parser,root,"hardwareMessageAscii",message)&&json_string_equals(&parser,root,"messageBodySha256",message_sha256)&&json_number_equals(&parser,root,"messageBodyByteLength","100")==0&&
    json_string_equals(&parser,subject,"ocmsSignerListSha256",signer_sha256)&&json_string_equals(&parser,root,"signerListSha256",signer_sha256)&&json_number_equals(&parser,root,"signerListByteLength","33")==0&&
    json_string_equals(&parser,root,"serializedMessageSha256",serialized_sha256)&&json_number_equals(&parser,root,"serializedMessageByteLength","150")==0&&json_string_equals(&parser,root,"signatureSha256",signature_sha256)&&json_number_equals(&parser,root,"signatureByteLength","64")==0&&
    json_string_equals(&parser,root,"deviceReceiptSha256",subject_device_receipt);
  EVP_PKEY *key=NULL;EVP_MD_CTX *context=NULL;if(ok){key=EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519,NULL,g_trust_anchor.root_public_key,32U);context=EVP_MD_CTX_new();ok=key!=NULL&&context!=NULL&&EVP_DigestVerifyInit(context,NULL,NULL,NULL,key)==1&&EVP_DigestVerify(context,signature,sizeof signature,signed_data,sizeof signed_data)==1;}EVP_MD_CTX_free(context);EVP_PKEY_free(key);
  snprintf(descriptor_before,sizeof descriptor_before,"%s",g_trust_anchor.descriptor_sha256);
  if(ok)ok=replay_fd12_owner_root_key_anchor_same_handle()==0&&strcmp(descriptor_before,g_trust_anchor.descriptor_sha256)==0;
  if(ok)ok=fstat(BPS09_FD_ANCHOR_RECEIPT,&after)==0&&statx_fd(BPS09_FD_ANCHOR_RECEIPT,&stx_after)==0&&read_fdinfo_exact(BPS09_FD_ANCHOR_RECEIPT,fdinfo_after,sizeof fdinfo_after,&fdinfo_after_bytes)==0&&before.st_dev==after.st_dev&&before.st_ino==after.st_ino&&before.st_size==after.st_size&&stx_before.stx_mnt_id==stx_after.stx_mnt_id&&fdinfo_before_bytes==fdinfo_after_bytes&&memcmp(fdinfo_before,fdinfo_after,fdinfo_before_bytes)==0;
  if(ok){
    snprintf(g_trust_anchor.anchor_nonce_hex,sizeof g_trust_anchor.anchor_nonce_hex,"%s",anchor_nonce_hex);
    snprintf(g_trust_anchor.anchor_cas_key_sha256,sizeof g_trust_anchor.anchor_cas_key_sha256,"%s",anchor_cas_key_sha256);
    snprintf(g_trust_anchor.anchor_cas_acquire_receipt_sha256,sizeof g_trust_anchor.anchor_cas_acquire_receipt_sha256,"%s",anchor_cas_acquire_receipt_sha256);
    g_trust_anchor.anchor_expires_at_monotonic_ns=anchor_expires_at_monotonic_ns;g_trust_anchor.operation_deadline_monotonic_ns=operation_deadline_monotonic_ns;g_trust_anchor.teardown_deadline_monotonic_ns=teardown_deadline_monotonic_ns;
    g_trust_anchor.watchdog_credentials=watchdog_credentials;g_trust_anchor.observer_credentials=observer_credentials;g_trust_anchor.custodian_credentials=custodian_credentials;
    snprintf(g_trust_anchor.watchdog_channel_ofd_sha256,sizeof g_trust_anchor.watchdog_channel_ofd_sha256,"%s",watchdog_ofd);snprintf(g_trust_anchor.observer_channel_ofd_sha256,sizeof g_trust_anchor.observer_channel_ofd_sha256,"%s",observer_ofd);snprintf(g_trust_anchor.custodian_channel_ofd_sha256,sizeof g_trust_anchor.custodian_channel_ofd_sha256,"%s",custodian_ofd);
    snprintf(g_trust_anchor.watchdog_principal_sha256,sizeof g_trust_anchor.watchdog_principal_sha256,"%s",watchdog_principal_anchor);snprintf(g_trust_anchor.observer_principal_sha256,sizeof g_trust_anchor.observer_principal_sha256,"%s",observer_principal_anchor);snprintf(g_trust_anchor.custodian_principal_sha256,sizeof g_trust_anchor.custodian_principal_sha256,"%s",custodian_principal_anchor);
    snprintf(g_trust_anchor.operation_timer_ofd_sha256,sizeof g_trust_anchor.operation_timer_ofd_sha256,"%s",operation_timer);snprintf(g_trust_anchor.teardown_timer_ofd_sha256,sizeof g_trust_anchor.teardown_timer_ofd_sha256,"%s",teardown_timer);
    ok=decode_lower_hex_exact(watchdog_key,g_trust_anchor.role_public_keys[0],32U)==0&&decode_lower_hex_exact(observer_key,g_trust_anchor.role_public_keys[1],32U)==0&&decode_lower_hex_exact(custodian_key,g_trust_anchor.role_public_keys[2],32U)==0&&decode_lower_hex_exact(watchdog_principal_anchor,g_trust_anchor.principal_sha256_raw[0],32U)==0&&decode_lower_hex_exact(observer_principal_anchor,g_trust_anchor.principal_sha256_raw[1],32U)==0&&decode_lower_hex_exact(custodian_principal_anchor,g_trust_anchor.principal_sha256_raw[2],32U)==0;
  }
  free(json);if(!ok)return -1;one_use_consumed=true;g_trust_anchor.one_use_consumed=one_use_consumed;g_trust_anchor.fd11_verified=true;g_runtime.phase=BPS09_PHASE_FD11_OCMS_VERIFIED;return 0;
}

static int verify_kernel_descriptor_role_signature(const struct bps09_kernel_descriptor_v1 *descriptor,size_t role){
  static const char *const domains[]={"IAT_B3_BPS08A_KERNEL_DESCRIPTOR_WATCHDOG_V1","IAT_B3_BPS08A_KERNEL_DESCRIPTOR_OBSERVER_V1","IAT_B3_BPS08A_KERNEL_DESCRIPTOR_CUSTODIAN_V1"};
  if(role>=3U)return -1;size_t domain_bytes=strlen(domains[role]),descriptor_bytes=offsetof(struct bps09_kernel_descriptor_v1,role_signatures),message_bytes=domain_bytes+1U+descriptor_bytes;unsigned char *message=malloc(message_bytes);if(message==NULL)return -1;
  memcpy(message,domains[role],domain_bytes);message[domain_bytes]=0U;memcpy(message+domain_bytes+1U,descriptor,descriptor_bytes);
  EVP_PKEY *key=EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519,NULL,descriptor->role_public_keys[role],32U);EVP_MD_CTX *context=key==NULL?NULL:EVP_MD_CTX_new();int ok=context!=NULL&&EVP_DigestVerifyInit(context,NULL,NULL,NULL,key)==1&&EVP_DigestVerify(context,descriptor->role_signatures[role],64U,message,message_bytes)==1;
  EVP_MD_CTX_free(context);EVP_PKEY_free(key);memset(message,0,message_bytes);free(message);return ok?0:-1;
}

static int run_runtime_binding_provider(const struct bps09_kernel_descriptor_v1 *descriptor,const char descriptor_sha256[65]){
  char token_sha256[65],ledger_sha256[65],expected[512],observed[512];bps09_digest_hex(descriptor->cas_token_sha256,token_sha256);bps09_digest_hex(descriptor->ledger_identity_sha256,ledger_sha256);
  int expected_bytes=snprintf(expected,sizeof expected,"{\"casTokenSha256\":\"%s\",\"kernelDescriptorSha256\":\"%s\",\"ledgerIdentitySha256\":\"%s\",\"outcome\":\"LIVE_KERNEL_BINDING_VERIFIED\"}\n",token_sha256,descriptor_sha256,ledger_sha256);if(expected_bytes<=0||(size_t)expected_bytes>=sizeof expected)return -1;
  int output_pipe[2];if(pipe2(output_pipe,O_CLOEXEC|O_NONBLOCK)!=0)return -1;pid_t child=fork();if(child<0){close(output_pipe[0]);close(output_pipe[1]);return -1;}
  if(child==0){if(dup2(output_pipe[1],STDOUT_FILENO)<0)_exit(125);close(output_pipe[0]);close(output_pipe[1]);char *const argv[]={"iat-b3-runtime-binding-provider","--preflight-native",NULL};char *const environment[]={NULL};syscall(SYS_execveat,BPS09_FD_RUNTIME_BINDING_PROVIDER,"",argv,environment,AT_EMPTY_PATH);_exit(126);}
  close(output_pipe[1]);size_t used=0U;bool closed=false,failed=false;struct pollfd wait_set[3]={{.fd=output_pipe[0],.events=POLLIN|POLLERR|POLLHUP},{.fd=BPS09_FD_OPERATION_TIMER,.events=POLLIN|POLLERR|POLLHUP},{.fd=BPS09_FD_TEARDOWN_TIMER,.events=POLLIN|POLLERR|POLLHUP}};
  while(!closed&&!failed){int ready=poll(wait_set,3,-1);if(ready<0&&errno==EINTR)continue;if(ready<=0||(wait_set[1].revents&(POLLIN|POLLERR|POLLHUP))!=0||(wait_set[2].revents&(POLLIN|POLLERR|POLLHUP))!=0){failed=true;break;}if((wait_set[0].revents&(POLLERR|POLLHUP))!=0)closed=true;if((wait_set[0].revents&POLLIN)!=0||closed){for(;;){if(used==sizeof observed){failed=true;break;}ssize_t count=read(output_pipe[0],observed+used,sizeof observed-used);if(count<0&&errno==EINTR)continue;if(count<0&&(errno==EAGAIN||errno==EWOULDBLOCK))break;if(count<0){failed=true;break;}if(count==0){closed=true;break;}used+=(size_t)count;}}}
  close(output_pipe[0]);if(failed){kill(child,SIGKILL);}int status=0;while(waitpid(child,&status,0)<0){if(errno==EINTR)continue;return -1;}return !failed&&WIFEXITED(status)&&WEXITSTATUS(status)==0&&used==(size_t)expected_bytes&&memcmp(observed,expected,used)==0?0:-1;
}

static int verify_runtime_binding_before_fd3(void){
  struct stat descriptor_stat,receipt_stat,provider_stat;struct bps09_kernel_descriptor_v1 descriptor;unsigned char extra;char receipt_sha256[65],provider_sha256[65],descriptor_sha256[65];unsigned char operation_timer[32],teardown_timer[32],channel_sha256[3][32];
  if(!g_trust_anchor.fd12_verified||!g_trust_anchor.fd11_verified||g_trust_anchor.runtime_binding_verified||
     fstat(BPS09_FD_KERNEL_BINDING_DESCRIPTOR,&descriptor_stat)!=0||!S_ISREG(descriptor_stat.st_mode)||descriptor_stat.st_nlink!=0||descriptor_stat.st_size!=(off_t)sizeof descriptor||fcntl(BPS09_FD_KERNEL_BINDING_DESCRIPTOR,F_GET_SEALS)!=BPS09_REQUIRED_MEMFD_SEALS||
     pread(BPS09_FD_KERNEL_BINDING_DESCRIPTOR,&descriptor,sizeof descriptor,0)!=(ssize_t)sizeof descriptor||pread(BPS09_FD_KERNEL_BINDING_DESCRIPTOR,&extra,1U,(off_t)sizeof descriptor)!=0||
     memcmp(descriptor.magic,"IATB3RB1",8U)!=0||ntohl(descriptor.version_be)!=1U||ntohl(descriptor.byte_length_be)!=sizeof descriptor||
     fstat(BPS09_FD_RUNTIME_BINDING_RECEIPT,&receipt_stat)!=0||!S_ISREG(receipt_stat.st_mode)||receipt_stat.st_nlink!=0||receipt_stat.st_size<=0||receipt_stat.st_size>(off_t)BPS09_MAX_BOOTSTRAP_BYTES||fcntl(BPS09_FD_RUNTIME_BINDING_RECEIPT,F_GET_SEALS)!=BPS09_REQUIRED_MEMFD_SEALS||
     fstat(BPS09_FD_RUNTIME_BINDING_PROVIDER,&provider_stat)!=0||!S_ISREG(provider_stat.st_mode)||provider_stat.st_size<=0||
     bps09_sha256_fd_hex(BPS09_FD_RUNTIME_BINDING_RECEIPT,(uint64_t)receipt_stat.st_size,receipt_sha256)!=0||bps09_sha256_fd_hex(BPS09_FD_RUNTIME_BINDING_PROVIDER,(uint64_t)provider_stat.st_size,provider_sha256)!=0)return -1;
  char descriptor_receipt_sha256[65],descriptor_provider_sha256[65];bps09_digest_hex(descriptor.runtime_receipt_sha256,descriptor_receipt_sha256);bps09_digest_hex(descriptor.provider_executable_sha256,descriptor_provider_sha256);if(strcmp(receipt_sha256,descriptor_receipt_sha256)!=0||strcmp(provider_sha256,descriptor_provider_sha256)!=0)return -1;
  if(be64toh(descriptor.timer_deadline_ns_be[0])!=g_trust_anchor.operation_deadline_monotonic_ns||be64toh(descriptor.timer_deadline_ns_be[1])!=g_trust_anchor.teardown_deadline_monotonic_ns||decode_lower_hex_exact(g_trust_anchor.operation_timer_ofd_sha256,operation_timer,32U)!=0||decode_lower_hex_exact(g_trust_anchor.teardown_timer_ofd_sha256,teardown_timer,32U)!=0||memcmp(descriptor.timer_ofd_sha256[0],operation_timer,32U)!=0||memcmp(descriptor.timer_ofd_sha256[1],teardown_timer,32U)!=0)return -1;
  const char *channels[]={g_trust_anchor.watchdog_channel_ofd_sha256,g_trust_anchor.observer_channel_ofd_sha256,g_trust_anchor.custodian_channel_ofd_sha256};
  for(size_t role=0U;role<3U;++role){if(decode_lower_hex_exact(channels[role],channel_sha256[role],32U)!=0||memcmp(descriptor.peers[role].channel_ofd_projection_sha256,channel_sha256[role],32U)!=0||memcmp(descriptor.role_public_keys[role],g_trust_anchor.role_public_keys[role],32U)!=0||memcmp(descriptor.principal_sha256[role],g_trust_anchor.principal_sha256_raw[role],32U)!=0||verify_kernel_descriptor_role_signature(&descriptor,role)!=0)return -1;}
  bps09_sha256_bytes_hex(&descriptor,sizeof descriptor,descriptor_sha256);if(run_runtime_binding_provider(&descriptor,descriptor_sha256)!=0)return -1;g_trust_anchor.runtime_binding_verified=true;return 0;
}

static int replay_claim_fd(int fd, const struct bps09_file_claim *claim, bool regular) {
  struct statx stx; struct stat st; char resolved[4096],content_sha256[65],handle_sha256[65],ofd_sha256[65],projection[16384]; unsigned char fdinfo[4096]; size_t fdinfo_bytes=0U;
  char proc_path[64]; int proc_length=snprintf(proc_path,sizeof proc_path,"/proc/self/fd/%d",fd); if(proc_length<=0||(size_t)proc_length>=sizeof proc_path)return -1;
  ssize_t path_bytes=readlink(proc_path,resolved,sizeof resolved-1U); if(path_bytes<=0||(size_t)path_bytes>=sizeof resolved)return -1; resolved[path_bytes]='\0';
  if(strcmp(resolved,claim->path)!=0||strstr(resolved," (deleted)")!=NULL||statx_fd(fd,&stx)!=0||fstat(fd,&st)!=0||(regular&&!S_ISREG(st.st_mode))||(!regular&&!S_ISDIR(st.st_mode)))return -1;
  if((uint64_t)st.st_dev!=claim->dev||(uint64_t)st.st_ino!=claim->ino||stx.stx_mnt_id!=claim->mount_id||(uint64_t)st.st_nlink!=claim->nlink||(uint32_t)(st.st_mode&07777U)!=claim->mode||(uint32_t)st.st_uid!=claim->uid||(uint32_t)st.st_gid!=claim->gid||(regular&&(uint64_t)st.st_size!=claim->byte_length))return -1;
  if(regular){if(bps09_sha256_fd_hex(fd,claim->byte_length,content_sha256)!=0||strcmp(content_sha256,claim->sha256)!=0)return -1;}else if(claim->byte_length!=0U)return -1;
  int projection_bytes=snprintf(projection,sizeof projection,"{\"domain\":\"IAT_B3_BPS09_FILE_HANDLE_V1\",\"path\":\"%s\",\"dev\":\"%" PRIu64 "\",\"ino\":\"%" PRIu64 "\",\"mountId\":\"%" PRIu64 "\",\"mode\":\"%04o\",\"uid\":\"%u\",\"gid\":\"%u\",\"nlink\":\"%" PRIu64 "\",\"byteLength\":\"%" PRIu64 "\",\"sha256\":\"%s\"}\n",claim->path,claim->dev,claim->ino,claim->mount_id,claim->mode,claim->uid,claim->gid,claim->nlink,claim->byte_length,claim->sha256);
  if(projection_bytes<=0||(size_t)projection_bytes>=sizeof projection)return -1; bps09_sha256_bytes_hex(projection,(size_t)projection_bytes,handle_sha256); if(strcmp(handle_sha256,claim->handle_sha256)!=0)return -1;
  if(read_fdinfo_exact(fd,fdinfo,sizeof fdinfo,&fdinfo_bytes)!=0)return -1; bps09_sha256_bytes_hex(fdinfo,fdinfo_bytes,ofd_sha256); if(strcmp(ofd_sha256,claim->ofd_sha256)!=0)return -1;
  return 0;
}

static int serialize_file_claim_json(const struct bps09_file_claim *claim, char **output, size_t *output_bytes) {
  const char *format="{\"path\":\"%s\",\"sha256\":\"%s\",\"byteLength\":\"%" PRIu64 "\",\"mode\":\"%04o\",\"uid\":\"%u\",\"gid\":\"%u\",\"dev\":\"%" PRIu64 "\",\"ino\":\"%" PRIu64 "\",\"mountId\":\"%" PRIu64 "\",\"nlink\":\"%" PRIu64 "\",\"handleSha256\":\"%s\",\"openFileDescriptionSha256\":\"%s\",\"sameHandleReplayRequired\":true}";
  int required=snprintf(NULL,0,format,claim->path,claim->sha256,claim->byte_length,claim->mode,claim->uid,claim->gid,claim->dev,claim->ino,claim->mount_id,claim->nlink,claim->handle_sha256,claim->ofd_sha256);
  if(required<=0||required>32768)return -1; char *json=malloc((size_t)required+1U); if(json==NULL)return -1;
  int written=snprintf(json,(size_t)required+1U,format,claim->path,claim->sha256,claim->byte_length,claim->mode,claim->uid,claim->gid,claim->dev,claim->ino,claim->mount_id,claim->nlink,claim->handle_sha256,claim->ofd_sha256);
  if(written!=required){free(json);return -1;}*output=json;*output_bytes=(size_t)written;return 0;
}

static int observe_regular_file_claim(int fd,const char *path,struct bps09_file_claim *claim){
  struct stat st;struct statx stx;unsigned char fdinfo[4096];size_t fdinfo_bytes=0U;char projection[16384];memset(claim,0,sizeof *claim);
  if(!canonical_absolute_path(path)||strlen(path)>=sizeof claim->path||fstat(fd,&st)!=0||!S_ISREG(st.st_mode)||st.st_size<0||statx_fd(fd,&stx)!=0)return -1;
  memcpy(claim->path,path,strlen(path)+1U);claim->byte_length=(uint64_t)st.st_size;claim->mode=(uint32_t)(st.st_mode&07777U);claim->uid=(uint32_t)st.st_uid;claim->gid=(uint32_t)st.st_gid;claim->dev=(uint64_t)st.st_dev;claim->ino=(uint64_t)st.st_ino;claim->mount_id=stx.stx_mnt_id;claim->nlink=(uint64_t)st.st_nlink;
  if(bps09_sha256_fd_hex(fd,claim->byte_length,claim->sha256)!=0)return -1;
  int projection_bytes=snprintf(projection,sizeof projection,"{\"domain\":\"IAT_B3_BPS09_FILE_HANDLE_V1\",\"path\":\"%s\",\"dev\":\"%" PRIu64 "\",\"ino\":\"%" PRIu64 "\",\"mountId\":\"%" PRIu64 "\",\"mode\":\"%04o\",\"uid\":\"%u\",\"gid\":\"%u\",\"nlink\":\"%" PRIu64 "\",\"byteLength\":\"%" PRIu64 "\",\"sha256\":\"%s\"}\n",claim->path,claim->dev,claim->ino,claim->mount_id,claim->mode,claim->uid,claim->gid,claim->nlink,claim->byte_length,claim->sha256);
  if(projection_bytes<=0||(size_t)projection_bytes>=sizeof projection)return -1;bps09_sha256_bytes_hex(projection,(size_t)projection_bytes,claim->handle_sha256);
  if(read_fdinfo_exact(fd,fdinfo,sizeof fdinfo,&fdinfo_bytes)!=0)return -1;bps09_sha256_bytes_hex(fdinfo,fdinfo_bytes,claim->ofd_sha256);return 0;
}

static int compute_installed_final_subject(const struct bps09_file_claim *claim,char output[65]){
  static const char domain[]="IAT_B3_BPS09_INSTALLED_FINAL_V1\0";char *json=NULL;size_t bytes=0U;struct bps09_sha256_context context;unsigned char digest[32];if(serialize_file_claim_json(claim,&json,&bytes)!=0)return -1;
  bps09_sha256_init(&context);bps09_sha256_update(&context,domain,sizeof domain-1U);bps09_sha256_update(&context,json,bytes);bps09_sha256_update(&context,"\n",1U);bps09_sha256_final(&context,digest);bps09_digest_hex(digest,output);free(json);return 0;
}

static int serialize_receipt_json(const struct bps09_rpc *reply,const char *producer,const char *outcome,const char *subject,char **output,size_t *output_bytes){
  if(!lowercase_sha256(reply->receipt_sha256)||!lowercase_sha256(subject)||strcmp(reply->producer,producer)!=0||strcmp(reply->outcome,outcome)!=0)return -1;
  const char *format="{\"sha256\":\"%s\",\"byteLength\":\"%zu\",\"producer\":\"%s\",\"outcome\":\"%s\",\"subjectSha256\":\"%s\",\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"decision\":\"HOLD\",\"authority\":\"NONE\"}";
  int required=snprintf(NULL,0,format,reply->receipt_sha256,sizeof *reply,producer,outcome,subject,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id);if(required<=0||required>16384)return -1;
  char *json=malloc((size_t)required+1U);if(json==NULL)return -1;int written=snprintf(json,(size_t)required+1U,format,reply->receipt_sha256,sizeof *reply,producer,outcome,subject,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id);if(written!=required){free(json);return -1;}*output=json;*output_bytes=(size_t)written;return 0;
}

static int serialize_zero_proof_json(const struct bps09_rpc *reply,char **output,size_t *output_bytes){
  if(reply->state!=1U||!lowercase_sha256(reply->fd_ledger_sha256)||!lowercase_sha256(reply->process_ledger_sha256)||!lowercase_sha256(reply->mount_ledger_sha256)||!lowercase_sha256(reply->entry_ledger_sha256)||!lowercase_sha256(reply->cache_ledger_sha256))return -1;
  const char *format="{\"fdLedgerSha256\":\"%s\",\"processLedgerSha256\":\"%s\",\"mountLedgerSha256\":\"%s\",\"entryLedgerSha256\":\"%s\",\"cacheLedgerSha256\":\"%s\",\"allZero\":true}";
  int required=snprintf(NULL,0,format,reply->fd_ledger_sha256,reply->process_ledger_sha256,reply->mount_ledger_sha256,reply->entry_ledger_sha256,reply->cache_ledger_sha256);if(required<=0||required>4096)return -1;char *json=malloc((size_t)required+1U);if(json==NULL)return -1;int written=snprintf(json,(size_t)required+1U,format,reply->fd_ledger_sha256,reply->process_ledger_sha256,reply->mount_ledger_sha256,reply->entry_ledger_sha256,reply->cache_ledger_sha256);if(written!=required){free(json);return -1;}*output=json;*output_bytes=(size_t)written;return 0;
}

static int compute_compile_artifact_pair_subject(char output[65]) {
  static const char domain[]="IAT_B3_BPS09_COMPILE_ARTIFACT_PAIR_V1\0"; char *target=NULL,*installer=NULL;size_t target_bytes=0U,installer_bytes=0U;struct bps09_sha256_context context;unsigned char digest[32];
  if(serialize_file_claim_json(&g_runtime.bootstrap.target,&target,&target_bytes)!=0||serialize_file_claim_json(&g_runtime.bootstrap.installer,&installer,&installer_bytes)!=0){free(target);free(installer);return -1;}
  bps09_sha256_init(&context);bps09_sha256_update(&context,domain,sizeof domain-1U);bps09_sha256_update(&context,target,target_bytes);bps09_sha256_update(&context,"\n",1U);bps09_sha256_update(&context,installer,installer_bytes);bps09_sha256_update(&context,"\n",1U);bps09_sha256_final(&context,digest);bps09_digest_hex(digest,output);free(target);free(installer);return 0;
}

static int compute_recovery_ledger_subject(char output[65]) {
  static const char domain[]="IAT_B3_BPS09_RECOVERY_LEDGER_V2\0";char *parent=NULL,*temp=NULL,*final=NULL,*projection=NULL;size_t parent_bytes=0U,temp_bytes=0U,final_bytes=0U;struct bps09_sha256_context context;unsigned char digest[32];
  if(serialize_file_claim_json(&g_runtime.bootstrap.parent,&parent,&parent_bytes)!=0)return -1;
  if(g_runtime.bootstrap.recovery_temp_claim_present&&serialize_file_claim_json(&g_runtime.bootstrap.recovery_temp,&temp,&temp_bytes)!=0){free(parent);return -1;}
  if(g_runtime.bootstrap.recovery_final_claim_present&&serialize_file_claim_json(&g_runtime.bootstrap.recovery_final,&final,&final_bytes)!=0){free(parent);free(temp);return -1;}
  const char *temp_json=temp==NULL?"null":temp,*final_json=final==NULL?"null":final;
  int required=snprintf(NULL,0,"{\"identityLedger\":{\"parent\":%s,\"temp\":%s,\"final\":%s,\"publicationCasSha256\":\"%s\"},\"tempName\":\"%s\",\"finalName\":\"%s\"}\n",parent,temp_json,final_json,g_runtime.bootstrap.publication_cas_sha256,g_runtime.bootstrap.temp_name,g_runtime.bootstrap.final_name);
  if(required<=0||required>131072){free(parent);free(temp);free(final);return -1;}projection=malloc((size_t)required+1U);if(projection==NULL){free(parent);free(temp);free(final);return -1;}
  int written=snprintf(projection,(size_t)required+1U,"{\"identityLedger\":{\"parent\":%s,\"temp\":%s,\"final\":%s,\"publicationCasSha256\":\"%s\"},\"tempName\":\"%s\",\"finalName\":\"%s\"}\n",parent,temp_json,final_json,g_runtime.bootstrap.publication_cas_sha256,g_runtime.bootstrap.temp_name,g_runtime.bootstrap.final_name);
  free(parent);free(temp);free(final);if(written!=required){free(projection);return -1;}
  bps09_sha256_init(&context);bps09_sha256_update(&context,domain,sizeof domain-1U);bps09_sha256_update(&context,projection,(size_t)written);bps09_sha256_final(&context,digest);bps09_digest_hex(digest,output);free(projection);return 0;
}

static int compute_recovery_evidence_receipt_subject(const char *purpose,const char *abort_receipt_sha256,const char *cleanup_receipt_sha256,const struct bps09_rpc *zero_reply,char output[65]) {
  char projection[32768];char *zero_json=NULL;size_t zero_bytes=0U;const char *domain=NULL;int written=-1;
  if(strcmp(purpose,"ABORT_CAS")==0){
    domain="IAT_B3_BPS09_RECOVERY_ABORT_CAS_V1";
    written=snprintf(projection,sizeof projection,"{\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"bootstrapSha256\":\"%s\"}\n",g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256);
  }else if(strcmp(purpose,"IDENTITY_LED_CLEANUP")==0){
    if(!lowercase_sha256(abort_receipt_sha256))return -1;
    domain="IAT_B3_BPS09_RECOVERY_IDENTITY_LED_CLEANUP_V1";
    written=snprintf(projection,sizeof projection,"{\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"bootstrapSha256\":\"%s\",\"abortReceiptSha256\":\"%s\"}\n",g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,abort_receipt_sha256);
  }else if(strcmp(purpose,"PARENT_FSYNC_AND_ZERO")==0){
    if(!lowercase_sha256(abort_receipt_sha256)||!lowercase_sha256(cleanup_receipt_sha256)||zero_reply==NULL||serialize_zero_proof_json(zero_reply,&zero_json,&zero_bytes)!=0)return -1;
    domain="IAT_B3_BPS09_RECOVERY_PARENT_FSYNC_AND_ZERO_V1";
    written=snprintf(projection,sizeof projection,"{\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"bootstrapSha256\":\"%s\",\"abortReceiptSha256\":\"%s\",\"cleanupReceiptSha256\":\"%s\",\"zeroProof\":%s}\n",g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,abort_receipt_sha256,cleanup_receipt_sha256,zero_json);
  }else return -1;
  free(zero_json);if(written<=0||(size_t)written>=sizeof projection)return -1;
  struct bps09_sha256_context context;unsigned char digest[32];bps09_sha256_init(&context);bps09_sha256_update(&context,domain,strlen(domain)+1U);bps09_sha256_update(&context,projection,(size_t)written);bps09_sha256_final(&context,digest);bps09_digest_hex(digest,output);return 0;
}

static void initialize_rpc(struct bps09_rpc *rpc, uint32_t operation, enum bps09_phase from, enum bps09_phase to) {
  memset(rpc, 0, sizeof *rpc);
  rpc->version = 1U; rpc->operation = operation; rpc->from_phase = (uint32_t)from; rpc->to_phase = (uint32_t)to;
  snprintf(rpc->attempt_id, sizeof rpc->attempt_id, "%s", g_runtime.bootstrap.attempt_id);
  snprintf(rpc->run_id, sizeof rpc->run_id, "%s", g_runtime.bootstrap.run_id);
  snprintf(rpc->session_id, sizeof rpc->session_id, "%s", g_runtime.bootstrap.session_id);
  snprintf(rpc->decision, sizeof rpc->decision, "HOLD"); snprintf(rpc->authority, sizeof rpc->authority, "NONE");
}

static int deadline_timer_open(void) {
  struct timespec now; struct pollfd timer={.fd=BPS09_FD_TEARDOWN_TIMER,.events=POLLIN|POLLERR|POLLHUP};char observed_timer_ofd[65];
  if(clock_gettime(CLOCK_MONOTONIC,&now)!=0||now.tv_sec<0||(uint64_t)now.tv_sec>UINT64_MAX/1000000000ULL)return -1;
  uint64_t nanoseconds=(uint64_t)now.tv_sec*1000000000ULL+(uint64_t)now.tv_nsec;
  if(!g_trust_anchor.fd11_verified||!g_trust_anchor.runtime_binding_verified||g_runtime.bootstrap.deadline_ns!=g_trust_anchor.teardown_deadline_monotonic_ns||
     observe_native_timer_ofd(BPS09_FD_TEARDOWN_TIMER,g_trust_anchor.teardown_deadline_monotonic_ns,observed_timer_ofd)!=0||strcmp(observed_timer_ofd,g_trust_anchor.teardown_timer_ofd_sha256)!=0||
     nanoseconds>=g_runtime.bootstrap.deadline_ns||poll(&timer,1,0)!=0)return -1;
  return 0;
}

static int authenticated_peer_credentials(int endpoint_fd, struct ucred *credentials) {
  char observed_ofd[65],observed_principal[65];const char *role=endpoint_fd==BPS09_FD_WATCHDOG?"watchdog":endpoint_fd==BPS09_FD_CUSTODIAN?"custodian":NULL;
  const struct ucred *expected=endpoint_fd==BPS09_FD_WATCHDOG?&g_trust_anchor.watchdog_credentials:endpoint_fd==BPS09_FD_CUSTODIAN?&g_trust_anchor.custodian_credentials:NULL;
  const char *expected_ofd=endpoint_fd==BPS09_FD_WATCHDOG?g_trust_anchor.watchdog_channel_ofd_sha256:endpoint_fd==BPS09_FD_CUSTODIAN?g_trust_anchor.custodian_channel_ofd_sha256:NULL;
  int pidfd=endpoint_fd==BPS09_FD_WATCHDOG?BPS09_FD_WATCHDOG_PIDFD:endpoint_fd==BPS09_FD_CUSTODIAN?BPS09_FD_CUSTODIAN_PIDFD:-1;struct pollfd live={.fd=pidfd,.events=0};
  if(!g_trust_anchor.fd11_verified||!g_trust_anchor.runtime_binding_verified||role==NULL||expected==NULL||expected_ofd==NULL||pidfd<0||
     observe_native_peer_projection(endpoint_fd,role,credentials,observed_ofd,observed_principal)!=0||
     credentials->pid!=expected->pid||credentials->uid!=expected->uid||credentials->gid!=expected->gid||
     strcmp(observed_ofd,expected_ofd)!=0||poll(&live,1,0)!=0||live.revents!=0)return -1;
  return endpoint_fd==BPS09_FD_WATCHDOG?credentials->uid==0?0:-1:(credentials->uid!=0&&credentials->uid!=geteuid())?0:-1;
}

static int verify_rpc_role_signature(int endpoint_fd,const struct bps09_rpc *reply){
  static const char watchdog_domain[]="IAT_B3_BPS09_WATCHDOG_RPC_RESPONSE_V1";static const char custodian_domain[]="IAT_B3_BPS09_CUSTODIAN_RPC_RESPONSE_V1";const char *domain=endpoint_fd==BPS09_FD_WATCHDOG?watchdog_domain:endpoint_fd==BPS09_FD_CUSTODIAN?custodian_domain:NULL;size_t role=endpoint_fd==BPS09_FD_WATCHDOG?0U:2U;if(domain==NULL||!g_trust_anchor.runtime_binding_verified)return -1;
  size_t domain_bytes=strlen(domain),reply_bytes=offsetof(struct bps09_rpc,signature),message_bytes=domain_bytes+1U+reply_bytes;unsigned char *message=malloc(message_bytes);if(message==NULL)return -1;memcpy(message,domain,domain_bytes);message[domain_bytes]=0U;memcpy(message+domain_bytes+1U,reply,reply_bytes);
  EVP_PKEY *key=EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519,NULL,g_trust_anchor.role_public_keys[role],32U);EVP_MD_CTX *context=key==NULL?NULL:EVP_MD_CTX_new();int ok=context!=NULL&&EVP_DigestVerifyInit(context,NULL,NULL,NULL,key)==1&&EVP_DigestVerify(context,reply->signature,sizeof reply->signature,message,message_bytes)==1;EVP_MD_CTX_free(context);EVP_PKEY_free(key);memset(message,0,message_bytes);free(message);return ok?0:-1;
}

static int wait_timer_first_endpoint(int endpoint_fd, short event) {
  struct pollfd wait_set[2]={{.fd=BPS09_FD_TEARDOWN_TIMER,.events=POLLIN|POLLERR|POLLHUP},{.fd=endpoint_fd,.events=(short)(event|POLLERR|POLLHUP)}};
  if(deadline_timer_open()!=0)return -1;
  for(;;){int ready=poll(wait_set,2,-1);if(ready<0&&errno==EINTR)continue;if(ready<=0||(wait_set[0].revents&(POLLIN|POLLERR|POLLHUP))!=0||(wait_set[1].revents&(POLLERR|POLLHUP))!=0||(wait_set[1].revents&event)==0)return -1;return deadline_timer_open();}
}

static int timer_first_rpc(int endpoint_fd, struct bps09_rpc *request, struct bps09_rpc *reply) {
  struct ucred before,after;uint64_t *counter=endpoint_fd==BPS09_FD_WATCHDOG?&g_runtime.watchdog_sequence:&g_runtime.custodian_sequence;
  if((endpoint_fd!=BPS09_FD_WATCHDOG&&endpoint_fd!=BPS09_FD_CUSTODIAN)||authenticated_peer_credentials(endpoint_fd,&before)!=0||*counter==UINT64_MAX)return -1;
  request->sequence=++*counter;
  if(wait_timer_first_endpoint(endpoint_fd,POLLOUT)!=0)return -1;
  ssize_t sent=send(endpoint_fd,request,sizeof *request,MSG_DONTWAIT|MSG_NOSIGNAL);if(sent!=(ssize_t)sizeof *request)return -1;
  if(wait_timer_first_endpoint(endpoint_fd,POLLIN)!=0)return -1;
  ssize_t received=recv(endpoint_fd,reply,sizeof *reply,MSG_DONTWAIT|MSG_TRUNC);if(received!=(ssize_t)sizeof *reply||deadline_timer_open()!=0||authenticated_peer_credentials(endpoint_fd,&after)!=0||before.pid!=after.pid||before.uid!=after.uid||before.gid!=after.gid||verify_rpc_role_signature(endpoint_fd,reply)!=0)return -1;
  if(reply->version!=1U||reply->operation!=request->operation||reply->sequence!=request->sequence||reply->from_phase!=request->from_phase||reply->to_phase!=request->to_phase||reply->resource_dev!=request->resource_dev||reply->resource_ino!=request->resource_ino||reply->resource_mount_id!=request->resource_mount_id||strcmp(reply->attempt_id,request->attempt_id)!=0||strcmp(reply->run_id,request->run_id)!=0||strcmp(reply->session_id,request->session_id)!=0||strcmp(reply->producer_set_sha256,request->producer_set_sha256)!=0||strcmp(reply->producer,request->producer)!=0||strcmp(reply->prior_producer,request->prior_producer)!=0||strcmp(reply->outcome,request->outcome)!=0||strcmp(reply->decision,"HOLD")!=0||strcmp(reply->authority,"NONE")!=0||!lowercase_sha256(reply->receipt_sha256)||strcmp(reply->receipt_sha256,request->receipt_sha256)==0)return -1;
  if(request->operation!=6U&&request->operation!=8U&&request->operation!=12U&&reply->state!=request->state)return -1;
  return 0;
}

static int request_abort_cas_receipt(uint32_t operation,const char *prior_receipt_sha256,const char *prior_producer,struct bps09_rpc *reply) {
  struct bps09_rpc request;char subject[65];
  if((!g_runtime.cas_held&&g_runtime.bootstrap.mode!=BPS09_MODE_RECOVER)||!lowercase_sha256(prior_receipt_sha256)||prior_producer==NULL||prior_producer[0]=='\0'||compute_recovery_evidence_receipt_subject("ABORT_CAS",NULL,NULL,NULL,subject)!=0)return -1;
  initialize_rpc(&request,operation,g_runtime.phase,BPS09_PHASE_ABORT_LATCHED);request.state=(uint32_t)g_runtime.phase;
  snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",prior_receipt_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",subject);snprintf(request.prior_producer,sizeof request.prior_producer,"%s",prior_producer);snprintf(request.producer,sizeof request.producer,"INSTALL_WATCHDOG_ABORT_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  if(timer_first_rpc(BPS09_FD_WATCHDOG,&request,reply)!=0||(reply->state!=1U&&reply->state!=2U))return -1;g_runtime.phase=BPS09_PHASE_ABORT_LATCHED;return 0;
}

static int request_identity_cleanup_receipt(void) {
  struct bps09_rpc request;char subject[65];
  if(!g_runtime.cas_held||g_runtime.phase!=BPS09_PHASE_ABORT_LATCHED||compute_recovery_evidence_receipt_subject("IDENTITY_LED_CLEANUP",g_abort_reply.receipt_sha256,NULL,NULL,subject)!=0)return -1;
  initialize_rpc(&request,12U,BPS09_PHASE_ABORT_LATCHED,BPS09_PHASE_ABORT_LATCHED);request.state=g_runtime.custody_acked?2U:1U;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",g_abort_reply.receipt_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",subject);snprintf(request.prior_producer,sizeof request.prior_producer,"INSTALL_WATCHDOG_ABORT_RECEIPT");snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  return timer_first_rpc(BPS09_FD_CUSTODIAN,&request,&g_cleanup_reply)==0&&g_cleanup_reply.state==1U?0:-1;
}

static int request_parent_fsync_zero_receipt(void) {
  struct bps09_rpc request;char subject[65];
  if(!g_runtime.cas_held||g_runtime.phase!=BPS09_PHASE_ZERO_VERIFIED||compute_recovery_evidence_receipt_subject("PARENT_FSYNC_AND_ZERO",g_abort_reply.receipt_sha256,g_cleanup_reply.receipt_sha256,&g_zero_reply,subject)!=0)return -1;
  initialize_rpc(&request,13U,BPS09_PHASE_ZERO_VERIFIED,BPS09_PHASE_ZERO_VERIFIED);request.state=1U;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",g_cleanup_reply.receipt_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",subject);snprintf(request.prior_producer,sizeof request.prior_producer,"EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT");snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  return timer_first_rpc(BPS09_FD_CUSTODIAN,&request,&g_parent_fsync_reply)==0&&g_parent_fsync_reply.state==1U?0:-1;
}

static int release_install_attempt_cas_after_terminal_hold(const struct bps09_rpc *durable_evidence_ack) {
  struct bps09_rpc request,reply;
  if(!g_runtime.cas_held||g_runtime.phase!=BPS09_PHASE_HOLD_PERSISTED||durable_evidence_ack==NULL||!lowercase_sha256(durable_evidence_ack->receipt_sha256)||!lowercase_sha256(durable_evidence_ack->producer_set_sha256))return -1;
  initialize_rpc(&request,9U,BPS09_PHASE_HOLD_PERSISTED,BPS09_PHASE_HOLD_PERSISTED);request.state=1U;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",durable_evidence_ack->receipt_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",durable_evidence_ack->producer_set_sha256);snprintf(request.prior_producer,sizeof request.prior_producer,"EVIDENCE_CUSTODIAN_RECOVERY_EVIDENCE_RECEIPT");snprintf(request.producer,sizeof request.producer,"INSTALL_WATCHDOG_CAS_RELEASE_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  return timer_first_rpc(BPS09_FD_WATCHDOG,&request,&reply)==0&&reply.state==1U?0:-1;
}

static int verify_independent_compile_review_gate(void) {
  struct bps09_rpc request, reply; char pair_subject[65];
  if(compute_compile_artifact_pair_subject(pair_subject)!=0||strcmp(pair_subject,g_runtime.bootstrap.compile_review_subject_sha256)!=0)return -1;
  initialize_rpc(&request, 1U, BPS09_PHASE_BOOTSTRAP_VALIDATED, BPS09_PHASE_COMPILE_REVIEW_ACCEPTED);
  request.state=1U;
  snprintf(request.receipt_sha256, sizeof request.receipt_sha256, "%s", g_runtime.bootstrap.compile_review_sha256);
  snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",pair_subject);
  snprintf(request.producer,sizeof request.producer,"INDEPENDENT_COMPILE_REVIEW");
  snprintf(request.outcome,sizeof request.outcome,"%s",BPS09_COMPILE_REVIEW_OUTCOME);
  request.resource_dev=g_runtime.bootstrap.target.dev;request.resource_ino=g_runtime.bootstrap.target.ino;request.resource_mount_id=g_runtime.bootstrap.target.mount_id;
  if (timer_first_rpc(BPS09_FD_WATCHDOG, &request, &reply) != 0) return -1;
  g_runtime.phase = BPS09_PHASE_COMPILE_REVIEW_ACCEPTED; return 0;
}

static int replay_source_artifact_same_object(void) {
  struct statx inherited_image, executing_image;
  char executing_path[4096], executing_sha256[65];
  int executing_fd=-1;
  ssize_t path_bytes;
  if (replay_claim_fd(BPS09_FD_SOURCE_ARTIFACT, &g_runtime.bootstrap.target, true) != 0 || replay_claim_fd(BPS09_FD_SELF_IMAGE, &g_runtime.bootstrap.installer, true) != 0) return -1;
  executing_fd=open("/proc/self/exe",O_RDONLY|O_CLOEXEC);
  path_bytes=readlink("/proc/self/exe",executing_path,sizeof executing_path-1U);
  if(executing_fd<0||path_bytes<=0||(size_t)path_bytes>=sizeof executing_path){if(executing_fd>=0)close(executing_fd);return -1;}
  executing_path[path_bytes]='\0';
  if(strcmp(executing_path,g_runtime.bootstrap.installer.path)!=0||strstr(executing_path," (deleted)")!=NULL||statx_fd(BPS09_FD_SELF_IMAGE,&inherited_image)!=0||statx_fd(executing_fd,&executing_image)!=0||inherited_image.stx_dev_major!=executing_image.stx_dev_major||inherited_image.stx_dev_minor!=executing_image.stx_dev_minor||inherited_image.stx_ino!=executing_image.stx_ino||inherited_image.stx_mnt_id!=executing_image.stx_mnt_id||inherited_image.stx_size!=executing_image.stx_size||bps09_sha256_fd_hex(executing_fd,g_runtime.bootstrap.installer.byte_length,executing_sha256)!=0||strcmp(executing_sha256,g_runtime.bootstrap.installer.sha256)!=0){close(executing_fd);return -1;}
  if(close(executing_fd)!=0)return -1;
  g_runtime.phase = BPS09_PHASE_SOURCE_REPLAYED; return 0;
}

static int acquire_install_attempt_cas(void) {
  struct bps09_rpc request;
  initialize_rpc(&request, 2U, BPS09_PHASE_SOURCE_REPLAYED, BPS09_PHASE_CAS_ACQUIRED);
  request.state=1U;
  snprintf(request.producer,sizeof request.producer,"INSTALL_WATCHDOG_ATTEMPT_CAS_RECEIPT");
  snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");
  request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  if (timer_first_rpc(BPS09_FD_WATCHDOG, &request, &g_cas_reply) != 0||g_cas_reply.state!=1U) return -1;
  g_runtime.cas_held = true; g_runtime.phase = BPS09_PHASE_CAS_ACQUIRED; return 0;
}

static int replay_install_parent_identity(void) {
  if (!g_runtime.cas_held || replay_claim_fd(BPS09_FD_INSTALL_PARENT, &g_runtime.bootstrap.parent, false) != 0) return -1;
  struct stat st;
  if (fstat(BPS09_FD_INSTALL_PARENT, &st) != 0 || st.st_uid != 0 || st.st_gid != 0 || (st.st_mode & 0022U) != 0) return -1;
  char xattrs[4096];ssize_t xattr_bytes=flistxattr(BPS09_FD_INSTALL_PARENT,xattrs,sizeof xattrs);if(xattr_bytes!=0)return -1;
  g_runtime.phase = BPS09_PHASE_PARENT_REPLAYED; return 0;
}

static int create_temp_beneath_openat2(void) {
  struct open_how how = { .flags = O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, .mode = 0550, .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS };
  int fd = (int)syscall(SYS_openat2, BPS09_FD_INSTALL_PARENT, g_runtime.bootstrap.temp_name, &how, sizeof how);
  struct stat st;char xattrs[4096];
  if (fd < 0 || fstat(fd,&st)!=0 || !S_ISREG(st.st_mode) || st.st_uid!=0 || st.st_gid!=0 || (st.st_mode&07777U)!=0550U || st.st_nlink!=1 || flistxattr(fd,xattrs,sizeof xattrs)!=0 || fsync(BPS09_FD_INSTALL_PARENT)!=0) { if(fd>=0)close(fd); return -1; }
  g_runtime.temp_fd = fd; g_runtime.phase = BPS09_PHASE_TEMP_CREATED; return 0;
}

static int stream_source_to_temp_bounded(void) {
  unsigned char buffer[65536]; uint64_t offset = 0U;
  if (g_runtime.temp_fd < 0 || g_runtime.bootstrap.target.byte_length > BPS09_MAX_ARTIFACT_BYTES) return -1;
  while (offset < g_runtime.bootstrap.target.byte_length) {
    size_t wanted = sizeof buffer;
    if (g_runtime.bootstrap.target.byte_length - offset < wanted) wanted = (size_t)(g_runtime.bootstrap.target.byte_length - offset);
    ssize_t got = pread(BPS09_FD_SOURCE_ARTIFACT, buffer, wanted, (off_t)offset);
    if (got < 0 && errno == EINTR) continue;
    if (got <= 0) return -1;
    size_t written=0U;while(written<(size_t)got){ssize_t put=pwrite(g_runtime.temp_fd,buffer+written,(size_t)got-written,(off_t)(offset+written));if(put<0&&errno==EINTR)continue;if(put<=0)return -1;written+=(size_t)put;}
    offset += (uint64_t)got;
  }
  unsigned char extra;ssize_t trailing;do{trailing=pread(BPS09_FD_SOURCE_ARTIFACT,&extra,1U,(off_t)offset);}while(trailing<0&&errno==EINTR);if(trailing!=0)return -1;
  g_runtime.copied_bytes = offset; g_runtime.phase = BPS09_PHASE_BYTES_WRITTEN; return 0;
}

static int fsync_temp_and_replay_identity(void) {
  struct statx source, temp;char temp_sha256[65];char xattrs[4096];
  if (g_runtime.temp_fd < 0 || g_runtime.copied_bytes != g_runtime.bootstrap.target.byte_length || fsync(g_runtime.temp_fd) != 0 || statx_fd(BPS09_FD_SOURCE_ARTIFACT, &source) != 0 || statx_fd(g_runtime.temp_fd, &temp) != 0 || bps09_sha256_fd_hex(g_runtime.temp_fd,g_runtime.bootstrap.target.byte_length,temp_sha256)!=0 || strcmp(temp_sha256,g_runtime.bootstrap.target.sha256)!=0 || flistxattr(g_runtime.temp_fd,xattrs,sizeof xattrs)!=0) return -1;
  if (source.stx_size != temp.stx_size || (temp.stx_mode & 07777U) != 0550U || temp.stx_uid != 0 || temp.stx_gid != 0 || temp.stx_nlink != 1U) return -1;
  g_runtime.phase = BPS09_PHASE_TEMP_SYNCED; return 0;
}

static int publish_noreplace_and_fsync_parent(void) {
  if (g_runtime.temp_fd < 0 || syscall(SYS_renameat2, BPS09_FD_INSTALL_PARENT, g_runtime.bootstrap.temp_name, BPS09_FD_INSTALL_PARENT, g_runtime.bootstrap.final_name, RENAME_NOREPLACE) != 0) return -1;
  g_runtime.published = true; g_runtime.phase = BPS09_PHASE_PUBLISHED;
  if (fsync(BPS09_FD_INSTALL_PARENT) != 0) return -1;
  g_runtime.phase = BPS09_PHASE_PARENT_SYNCED; return 0;
}

static int reopen_final_same_object_statx(void) {
  struct open_how how = { .flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC, .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS };
  int fd = (int)syscall(SYS_openat2, BPS09_FD_INSTALL_PARENT, g_runtime.bootstrap.final_name, &how, sizeof how);
  struct statx before, after;
  char final_path[4096];int path_bytes=snprintf(final_path,sizeof final_path,"%s/%s",g_runtime.bootstrap.parent.path,g_runtime.bootstrap.final_name);char xattrs[4096];
  if (fd < 0 || path_bytes<=0||(size_t)path_bytes>=sizeof final_path || statx_fd(g_runtime.temp_fd, &before) != 0 || statx_fd(fd, &after) != 0 || before.stx_dev_major != after.stx_dev_major || before.stx_dev_minor != after.stx_dev_minor || before.stx_ino != after.stx_ino || before.stx_mnt_id != after.stx_mnt_id || before.stx_size != after.stx_size || after.stx_nlink != 1U || flistxattr(fd,xattrs,sizeof xattrs)!=0 || observe_regular_file_claim(fd,final_path,&g_runtime.final_claim)!=0 || strcmp(g_runtime.final_claim.sha256,g_runtime.bootstrap.target.sha256)!=0 || g_runtime.final_claim.byte_length!=g_runtime.bootstrap.target.byte_length || compute_installed_final_subject(&g_runtime.final_claim,g_runtime.final_subject_sha256)!=0) { if (fd >= 0) close(fd); return -1; }
  g_runtime.final_fd = fd;
  struct bps09_rpc request;initialize_rpc(&request,10U,BPS09_PHASE_PARENT_SYNCED,BPS09_PHASE_FINAL_REOPENED);request.state=1U;snprintf(request.producer,sizeof request.producer,"INSTALL_WATCHDOG_PUBLICATION_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",g_runtime.final_subject_sha256);request.resource_dev=g_runtime.final_claim.dev;request.resource_ino=g_runtime.final_claim.ino;request.resource_mount_id=g_runtime.final_claim.mount_id;
  if(timer_first_rpc(BPS09_FD_WATCHDOG,&request,&g_publication_reply)!=0||g_publication_reply.state!=1U)return -1;
  g_runtime.phase = BPS09_PHASE_FINAL_REOPENED; return 0;
}

static int request_custodian_ack(void) {
  struct bps09_rpc request; struct statx final;
  initialize_rpc(&request, 3U, BPS09_PHASE_FINAL_REOPENED, BPS09_PHASE_CUSTODY_ACKED);
  request.state=1U;
  if (g_runtime.final_fd < 0 || statx_fd(g_runtime.final_fd, &final) != 0) return -1;
  request.resource_ino = final.stx_ino; request.resource_mount_id = final.stx_mnt_id;
  request.resource_dev=g_runtime.final_claim.dev;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",g_publication_reply.receipt_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",g_runtime.final_subject_sha256);snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");
  if (timer_first_rpc(BPS09_FD_CUSTODIAN, &request, &g_custody_reply) != 0||g_custody_reply.state!=1U) return -1;
  g_runtime.custody_acked = true; g_runtime.phase = BPS09_PHASE_CUSTODY_ACKED; return 0;
}

static int verify_install_zero_residue(void) {
  struct bps09_rpc request;
  if(!g_runtime.cas_held)return -1;initialize_rpc(&request, 4U, g_runtime.phase, BPS09_PHASE_ZERO_VERIFIED);request.state=1U;
  if (g_runtime.temp_fd >= 0) { if (close(g_runtime.temp_fd) != 0) return -1; g_runtime.temp_fd = -1; }
  if (g_runtime.final_fd >= 0) { if (close(g_runtime.final_fd) != 0) return -1; g_runtime.final_fd = -1; }
  struct open_how how = { .flags = O_PATH | O_NOFOLLOW | O_CLOEXEC, .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS };
  errno = 0; int stale = (int)syscall(SYS_openat2, BPS09_FD_INSTALL_PARENT, g_runtime.bootstrap.temp_name, &how, sizeof how);
  if (stale >= 0) { close(stale); return -1; }
  if (errno != ENOENT) return -1;
  const struct bps09_file_claim *final_claim=g_runtime.bootstrap.mode==BPS09_MODE_INSTALL?&g_runtime.final_claim:&g_runtime.bootstrap.recovery_final;bool final_present=g_runtime.bootstrap.mode==BPS09_MODE_INSTALL||g_runtime.bootstrap.recovery_final_claim_present;
  if(g_runtime.custody_acked){if(!final_present||verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,final_claim,true)!=0)return -1;}else if(verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,final_claim,false)!=0)return -1;
  if(verify_exact_inherited_fd_table()!=0)return -1;
  request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_ZERO_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");
  if (timer_first_rpc(BPS09_FD_CUSTODIAN, &request, &g_zero_reply) != 0 || g_zero_reply.state!=1U || !lowercase_sha256(g_zero_reply.fd_ledger_sha256)||!lowercase_sha256(g_zero_reply.process_ledger_sha256)||!lowercase_sha256(g_zero_reply.mount_ledger_sha256)||!lowercase_sha256(g_zero_reply.entry_ledger_sha256)||!lowercase_sha256(g_zero_reply.cache_ledger_sha256)) return -1;
  g_runtime.phase = BPS09_PHASE_ZERO_VERIFIED; return 0;
}

static bool file_claim_equal(const struct bps09_file_claim *left,const struct bps09_file_claim *right){return strcmp(left->path,right->path)==0&&strcmp(left->sha256,right->sha256)==0&&strcmp(left->handle_sha256,right->handle_sha256)==0&&strcmp(left->ofd_sha256,right->ofd_sha256)==0&&left->byte_length==right->byte_length&&left->dev==right->dev&&left->ino==right->ino&&left->mount_id==right->mount_id&&left->nlink==right->nlink&&left->mode==right->mode&&left->uid==right->uid&&left->gid==right->gid;}

static int validate_canonical_install_evidence_bytes(const char *evidence,size_t evidence_bytes){
  static const char *const root_keys[]={"schema","kind","attemptId","runId","sessionId","bootstrapSha256","sourceArtifact","installerSelf","finalArtifact","publicationReceipt","custodyReceipt","zeroProof","launched","decision","authority"};
  static const char *const zero_keys[]={"fdLedgerSha256","processLedgerSha256","mountLedgerSha256","entryLedgerSha256","cacheLedgerSha256","allZero"};
  if(evidence_bytes<=1U||evidence[evidence_bytes-1U]!='\n')return -1;char *copy=malloc(evidence_bytes);if(copy==NULL)return -1;memcpy(copy,evidence,evidence_bytes-1U);copy[evidence_bytes-1U]='\0';struct bps09_json_parser parser;int root=json_parse_exact(copy,evidence_bytes-1U,&parser);struct bps09_file_claim source,installer,final;char receipt_sha[65],subject[65];
  bool ok=root>=0&&json_object_exact(&parser,root,root_keys,sizeof root_keys/sizeof root_keys[0])==0&&json_string_equals(&parser,root,"schema",BPS09_SCHEMA)&&json_string_equals(&parser,root,"kind","INSTALL_EVIDENCE")&&json_string_equals(&parser,root,"attemptId",g_runtime.bootstrap.attempt_id)&&json_string_equals(&parser,root,"runId",g_runtime.bootstrap.run_id)&&json_string_equals(&parser,root,"sessionId",g_runtime.bootstrap.session_id)&&json_string_equals(&parser,root,"bootstrapSha256",g_runtime.bootstrap_sha256)&&parse_claim_node(&parser,json_child(&parser,root,"sourceArtifact"),&source)==0&&file_claim_equal(&source,&g_runtime.bootstrap.target)&&parse_claim_node(&parser,json_child(&parser,root,"installerSelf"),&installer)==0&&file_claim_equal(&installer,&g_runtime.bootstrap.installer)&&parse_claim_node(&parser,json_child(&parser,root,"finalArtifact"),&final)==0&&file_claim_equal(&final,&g_runtime.final_claim)&&parse_receipt_node(&parser,json_child(&parser,root,"publicationReceipt"),"INSTALL_WATCHDOG_PUBLICATION_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",receipt_sha,subject)==0&&strcmp(subject,g_runtime.final_subject_sha256)==0&&parse_receipt_node(&parser,json_child(&parser,root,"custodyReceipt"),"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",receipt_sha,subject)==0&&strcmp(subject,g_runtime.final_subject_sha256)==0;
  int zero=json_child(&parser,root,"zeroProof");ok=ok&&json_object_exact(&parser,zero,zero_keys,sizeof zero_keys/sizeof zero_keys[0])==0&&json_string_equals(&parser,zero,"fdLedgerSha256",g_zero_reply.fd_ledger_sha256)&&json_string_equals(&parser,zero,"processLedgerSha256",g_zero_reply.process_ledger_sha256)&&json_string_equals(&parser,zero,"mountLedgerSha256",g_zero_reply.mount_ledger_sha256)&&json_string_equals(&parser,zero,"entryLedgerSha256",g_zero_reply.entry_ledger_sha256)&&json_string_equals(&parser,zero,"cacheLedgerSha256",g_zero_reply.cache_ledger_sha256)&&parser.nodes[json_child(&parser,zero,"allZero")].type==BPS09_JSON_TRUE&&parser.nodes[json_child(&parser,root,"launched")].type==BPS09_JSON_FALSE&&json_string_equals(&parser,root,"decision","HOLD")&&json_string_equals(&parser,root,"authority","NONE");free(copy);return ok?0:-1;
}

static int build_canonical_install_evidence(char **output,size_t *output_bytes){
  char *source=NULL,*installer=NULL,*final=NULL,*publication=NULL,*custody=NULL,*zero=NULL;size_t ignored=0U;
  if(serialize_file_claim_json(&g_runtime.bootstrap.target,&source,&ignored)!=0||serialize_file_claim_json(&g_runtime.bootstrap.installer,&installer,&ignored)!=0||serialize_file_claim_json(&g_runtime.final_claim,&final,&ignored)!=0||serialize_receipt_json(&g_publication_reply,"INSTALL_WATCHDOG_PUBLICATION_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",g_runtime.final_subject_sha256,&publication,&ignored)!=0||serialize_receipt_json(&g_custody_reply,"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",g_runtime.final_subject_sha256,&custody,&ignored)!=0||serialize_zero_proof_json(&g_zero_reply,&zero,&ignored)!=0){free(source);free(installer);free(final);free(publication);free(custody);free(zero);return -1;}
  const char *format="{\"schema\":\"%s\",\"kind\":\"INSTALL_EVIDENCE\",\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"bootstrapSha256\":\"%s\",\"sourceArtifact\":%s,\"installerSelf\":%s,\"finalArtifact\":%s,\"publicationReceipt\":%s,\"custodyReceipt\":%s,\"zeroProof\":%s,\"launched\":false,\"decision\":\"HOLD\",\"authority\":\"NONE\"}\n";
  int required=snprintf(NULL,0,format,BPS09_SCHEMA,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,source,installer,final,publication,custody,zero);if(required<=0||required>(int)BPS09_MAX_BOOTSTRAP_BYTES){free(source);free(installer);free(final);free(publication);free(custody);free(zero);return -1;}char *evidence=malloc((size_t)required+1U);if(evidence==NULL){free(source);free(installer);free(final);free(publication);free(custody);free(zero);return -1;}int written=snprintf(evidence,(size_t)required+1U,format,BPS09_SCHEMA,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,source,installer,final,publication,custody,zero);free(source);free(installer);free(final);free(publication);free(custody);free(zero);if(written!=required||validate_canonical_install_evidence_bytes(evidence,(size_t)written)!=0){free(evidence);return -1;}*output=evidence;*output_bytes=(size_t)written;return 0;
}

static int persist_install_evidence_hold(void) {
  struct bps09_rpc evidence_request, ack, release, release_ack;char *evidence=NULL,evidence_sha256[65];size_t evidence_bytes=0U;
  if(!g_runtime.cas_held||!g_runtime.custody_acked||build_canonical_install_evidence(&evidence,&evidence_bytes)!=0)return -1;bps09_sha256_bytes_hex(evidence,evidence_bytes,evidence_sha256);
  if(ftruncate(BPS09_FD_EVIDENCE,0)!=0)return free(evidence),-1;size_t offset=0U;while(offset<evidence_bytes){ssize_t wrote=pwrite(BPS09_FD_EVIDENCE,evidence+offset,evidence_bytes-offset,(off_t)offset);if(wrote<0&&errno==EINTR)continue;if(wrote<=0){free(evidence);return -1;}offset+=(size_t)wrote;}free(evidence);if(fsync(BPS09_FD_EVIDENCE)!=0)return -1;
  initialize_rpc(&evidence_request, 5U, BPS09_PHASE_ZERO_VERIFIED, BPS09_PHASE_HOLD_PERSISTED);evidence_request.state=1U;snprintf(evidence_request.receipt_sha256,sizeof evidence_request.receipt_sha256,"%s",evidence_sha256);snprintf(evidence_request.producer,sizeof evidence_request.producer,"EVIDENCE_CUSTODIAN_INSTALL_EVIDENCE_RECEIPT");snprintf(evidence_request.outcome,sizeof evidence_request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");evidence_request.resource_dev=g_runtime.bootstrap.parent.dev;evidence_request.resource_ino=g_runtime.bootstrap.parent.ino;evidence_request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  if(timer_first_rpc(BPS09_FD_CUSTODIAN,&evidence_request,&ack)!=0||ack.state!=1U)return -1;
  initialize_rpc(&release,9U,BPS09_PHASE_ZERO_VERIFIED,BPS09_PHASE_HOLD_PERSISTED);release.state=1U;snprintf(release.receipt_sha256,sizeof release.receipt_sha256,"%s",ack.receipt_sha256);snprintf(release.producer,sizeof release.producer,"INSTALL_WATCHDOG_CAS_RELEASE_RECEIPT");snprintf(release.outcome,sizeof release.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");release.resource_dev=g_runtime.bootstrap.parent.dev;release.resource_ino=g_runtime.bootstrap.parent.ino;release.resource_mount_id=g_runtime.bootstrap.parent.mount_id;if(timer_first_rpc(BPS09_FD_WATCHDOG,&release,&release_ack)!=0||release_ack.state!=1U)return -1;
  g_runtime.cas_held=false;g_runtime.phase = BPS09_PHASE_HOLD_PERSISTED; return 0;
}

static int validate_canonical_recovery_evidence_bytes(const char *evidence,size_t evidence_bytes) {
  static const char *const root_keys[]={"schema","kind","attemptId","runId","sessionId","bootstrapSha256","abortCasReceipt","cleanupReceipt","parentFsyncReceipt","zeroProof","launched","decision","authority"};
  static const char *const zero_keys[]={"fdLedgerSha256","processLedgerSha256","mountLedgerSha256","entryLedgerSha256","cacheLedgerSha256","allZero"};
  char abort_sha[65],cleanup_sha[65],parent_sha[65],abort_subject[65],cleanup_subject[65],parent_subject[65],expected_abort[65],expected_cleanup[65],expected_parent[65];
  if(evidence==NULL||evidence_bytes<=1U||evidence[evidence_bytes-1U]!='\n')return -1;char *copy=malloc(evidence_bytes);if(copy==NULL)return -1;memcpy(copy,evidence,evidence_bytes-1U);copy[evidence_bytes-1U]='\0';struct bps09_json_parser parser;int root=json_parse_exact(copy,evidence_bytes-1U,&parser);
  bool ok=root>=0&&json_object_exact(&parser,root,root_keys,sizeof root_keys/sizeof root_keys[0])==0&&json_string_equals(&parser,root,"schema",BPS09_SCHEMA)&&json_string_equals(&parser,root,"kind","RECOVERY_EVIDENCE")&&json_string_equals(&parser,root,"attemptId",g_runtime.bootstrap.attempt_id)&&json_string_equals(&parser,root,"runId",g_runtime.bootstrap.run_id)&&json_string_equals(&parser,root,"sessionId",g_runtime.bootstrap.session_id)&&json_string_equals(&parser,root,"bootstrapSha256",g_runtime.bootstrap_sha256)&&parse_receipt_node(&parser,json_child(&parser,root,"abortCasReceipt"),"INSTALL_WATCHDOG_ABORT_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",abort_sha,abort_subject)==0&&parse_receipt_node(&parser,json_child(&parser,root,"cleanupReceipt"),"EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",cleanup_sha,cleanup_subject)==0&&parse_receipt_node(&parser,json_child(&parser,root,"parentFsyncReceipt"),"EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",parent_sha,parent_subject)==0;
  int zero=json_child(&parser,root,"zeroProof");ok=ok&&json_object_exact(&parser,zero,zero_keys,sizeof zero_keys/sizeof zero_keys[0])==0&&json_string_equals(&parser,zero,"fdLedgerSha256",g_zero_reply.fd_ledger_sha256)&&json_string_equals(&parser,zero,"processLedgerSha256",g_zero_reply.process_ledger_sha256)&&json_string_equals(&parser,zero,"mountLedgerSha256",g_zero_reply.mount_ledger_sha256)&&json_string_equals(&parser,zero,"entryLedgerSha256",g_zero_reply.entry_ledger_sha256)&&json_string_equals(&parser,zero,"cacheLedgerSha256",g_zero_reply.cache_ledger_sha256)&&parser.nodes[json_child(&parser,zero,"allZero")].type==BPS09_JSON_TRUE&&parser.nodes[json_child(&parser,root,"launched")].type==BPS09_JSON_FALSE&&json_string_equals(&parser,root,"decision","HOLD")&&json_string_equals(&parser,root,"authority","NONE");
  ok=ok&&strcmp(abort_sha,g_abort_reply.receipt_sha256)==0&&strcmp(cleanup_sha,g_cleanup_reply.receipt_sha256)==0&&strcmp(parent_sha,g_parent_fsync_reply.receipt_sha256)==0&&compute_recovery_evidence_receipt_subject("ABORT_CAS",NULL,NULL,NULL,expected_abort)==0&&compute_recovery_evidence_receipt_subject("IDENTITY_LED_CLEANUP",abort_sha,NULL,NULL,expected_cleanup)==0&&compute_recovery_evidence_receipt_subject("PARENT_FSYNC_AND_ZERO",abort_sha,cleanup_sha,&g_zero_reply,expected_parent)==0&&strcmp(abort_subject,expected_abort)==0&&strcmp(cleanup_subject,expected_cleanup)==0&&strcmp(parent_subject,expected_parent)==0;
  free(copy);return ok?0:-1;
}

static int build_canonical_recovery_evidence(char **output,size_t *output_bytes) {
  char abort_subject[65],cleanup_subject[65],parent_subject[65];char *abort_json=NULL,*cleanup_json=NULL,*parent_json=NULL,*zero_json=NULL;size_t ignored=0U;
  if(compute_recovery_evidence_receipt_subject("ABORT_CAS",NULL,NULL,NULL,abort_subject)!=0||compute_recovery_evidence_receipt_subject("IDENTITY_LED_CLEANUP",g_abort_reply.receipt_sha256,NULL,NULL,cleanup_subject)!=0||compute_recovery_evidence_receipt_subject("PARENT_FSYNC_AND_ZERO",g_abort_reply.receipt_sha256,g_cleanup_reply.receipt_sha256,&g_zero_reply,parent_subject)!=0||serialize_receipt_json(&g_abort_reply,"INSTALL_WATCHDOG_ABORT_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",abort_subject,&abort_json,&ignored)!=0||serialize_receipt_json(&g_cleanup_reply,"EVIDENCE_CUSTODIAN_CLEANUP_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",cleanup_subject,&cleanup_json,&ignored)!=0||serialize_receipt_json(&g_parent_fsync_reply,"EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT","BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",parent_subject,&parent_json,&ignored)!=0||serialize_zero_proof_json(&g_zero_reply,&zero_json,&ignored)!=0){free(abort_json);free(cleanup_json);free(parent_json);free(zero_json);return -1;}
  const char *format="{\"schema\":\"%s\",\"kind\":\"RECOVERY_EVIDENCE\",\"attemptId\":\"%s\",\"runId\":\"%s\",\"sessionId\":\"%s\",\"bootstrapSha256\":\"%s\",\"abortCasReceipt\":%s,\"cleanupReceipt\":%s,\"parentFsyncReceipt\":%s,\"zeroProof\":%s,\"launched\":false,\"decision\":\"HOLD\",\"authority\":\"NONE\"}\n";
  int required=snprintf(NULL,0,format,BPS09_SCHEMA,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,abort_json,cleanup_json,parent_json,zero_json);if(required<=0||required>(int)BPS09_MAX_BOOTSTRAP_BYTES){free(abort_json);free(cleanup_json);free(parent_json);free(zero_json);return -1;}char *bytes=malloc((size_t)required+1U);if(bytes==NULL){free(abort_json);free(cleanup_json);free(parent_json);free(zero_json);return -1;}int written=snprintf(bytes,(size_t)required+1U,format,BPS09_SCHEMA,g_runtime.bootstrap.attempt_id,g_runtime.bootstrap.run_id,g_runtime.bootstrap.session_id,g_runtime.bootstrap_sha256,abort_json,cleanup_json,parent_json,zero_json);free(abort_json);free(cleanup_json);free(parent_json);free(zero_json);if(written!=required||validate_canonical_recovery_evidence_bytes(bytes,(size_t)written)!=0){free(bytes);return -1;}*output=bytes;*output_bytes=(size_t)written;return 0;
}

static int validate_canonical_install_failure_evidence_bytes(const char *evidence,size_t evidence_bytes) { return validate_canonical_recovery_evidence_bytes(evidence,evidence_bytes); }

static int build_canonical_install_failure_evidence(char **output,size_t *output_bytes) {
  if(build_canonical_recovery_evidence(output,output_bytes)!=0)return -1;
  if(validate_canonical_install_failure_evidence_bytes(*output,*output_bytes)!=0){free(*output);*output=NULL;*output_bytes=0U;return -1;}return 0;
}

static int persist_recovery_evidence_hold(void) {
  struct bps09_rpc request;char *evidence=NULL,evidence_sha256[65];size_t evidence_bytes=0U;
  if(!g_runtime.cas_held||g_runtime.phase!=BPS09_PHASE_ZERO_VERIFIED||build_canonical_recovery_evidence(&evidence,&evidence_bytes)!=0)return -1;bps09_sha256_bytes_hex(evidence,evidence_bytes,evidence_sha256);
  if(ftruncate(BPS09_FD_EVIDENCE,0)!=0){free(evidence);return -1;}size_t offset=0U;while(offset<evidence_bytes){ssize_t wrote=pwrite(BPS09_FD_EVIDENCE,evidence+offset,evidence_bytes-offset,(off_t)offset);if(wrote<0&&errno==EINTR)continue;if(wrote<=0){free(evidence);return -1;}offset+=(size_t)wrote;}free(evidence);if(fsync(BPS09_FD_EVIDENCE)!=0)return -1;
  initialize_rpc(&request,7U,BPS09_PHASE_ZERO_VERIFIED,BPS09_PHASE_HOLD_PERSISTED);request.state=1U;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",evidence_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",evidence_sha256);snprintf(request.prior_producer,sizeof request.prior_producer,"EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT");snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_RECOVERY_EVIDENCE_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  if(timer_first_rpc(BPS09_FD_CUSTODIAN,&request,&g_terminal_evidence_ack)!=0||g_terminal_evidence_ack.state!=1U)return -1;g_runtime.phase=BPS09_PHASE_HOLD_PERSISTED;return 0;
}

static int persist_install_failure_evidence_hold(void) {
  struct bps09_rpc request;char *evidence=NULL,evidence_sha256[65];size_t evidence_bytes=0U;
  if(!g_runtime.cas_held||g_runtime.phase!=BPS09_PHASE_ZERO_VERIFIED||build_canonical_install_failure_evidence(&evidence,&evidence_bytes)!=0)return -1;bps09_sha256_bytes_hex(evidence,evidence_bytes,evidence_sha256);
  if(ftruncate(BPS09_FD_EVIDENCE,0)!=0){free(evidence);return -1;}size_t offset=0U;while(offset<evidence_bytes){ssize_t wrote=pwrite(BPS09_FD_EVIDENCE,evidence+offset,evidence_bytes-offset,(off_t)offset);if(wrote<0&&errno==EINTR)continue;if(wrote<=0){free(evidence);return -1;}offset+=(size_t)wrote;}free(evidence);if(fsync(BPS09_FD_EVIDENCE)!=0)return -1;
  initialize_rpc(&request,14U,BPS09_PHASE_ZERO_VERIFIED,BPS09_PHASE_HOLD_PERSISTED);request.state=1U;snprintf(request.receipt_sha256,sizeof request.receipt_sha256,"%s",evidence_sha256);snprintf(request.producer_set_sha256,sizeof request.producer_set_sha256,"%s",evidence_sha256);snprintf(request.prior_producer,sizeof request.prior_producer,"EVIDENCE_CUSTODIAN_PARENT_FSYNC_RECEIPT");snprintf(request.producer,sizeof request.producer,"EVIDENCE_CUSTODIAN_RECOVERY_EVIDENCE_RECEIPT");snprintf(request.outcome,sizeof request.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD");request.resource_dev=g_runtime.bootstrap.parent.dev;request.resource_ino=g_runtime.bootstrap.parent.ino;request.resource_mount_id=g_runtime.bootstrap.parent.mount_id;
  if(timer_first_rpc(BPS09_FD_CUSTODIAN,&request,&g_terminal_evidence_ack)!=0||g_terminal_evidence_ack.state!=1U)return -1;g_runtime.phase=BPS09_PHASE_HOLD_PERSISTED;return 0;
}

static int recover_one_exact_identity(const char *name, const struct bps09_file_claim *claim, bool claim_present) {
  if (!canonical_name(name)) return -1;
  struct open_how how = { .flags = O_PATH | O_NOFOLLOW | O_CLOEXEC, .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS };
  int fd = (int)syscall(SYS_openat2, BPS09_FD_INSTALL_PARENT, name, &how, sizeof how);
  if(!claim_present){if(fd>=0){close(fd);return -1;}return errno==ENOENT?0:-1;}
  if (fd < 0 && errno == ENOENT) return -1;
  if (fd < 0 || replay_claim_fd(fd, claim, true) != 0) { if (fd >= 0) close(fd); return -1; }
  char tombstone[192];
  int tombstone_bytes=snprintf(tombstone,sizeof tombstone,".iat-b3-recovery-%016" PRIx64 "-%.32s",claim->ino,claim->sha256);
  if(tombstone_bytes<=0||(size_t)tombstone_bytes>=sizeof tombstone||!canonical_name(tombstone)){close(fd);return -1;}
  if(syscall(SYS_renameat2,BPS09_FD_INSTALL_PARENT,name,BPS09_FD_INSTALL_PARENT,tombstone,RENAME_NOREPLACE)!=0){close(fd);return -1;}
  int reopened=(int)syscall(SYS_openat2,BPS09_FD_INSTALL_PARENT,tombstone,&how,sizeof how);
  if(reopened<0||replay_claim_fd(reopened,claim,true)!=0){if(reopened>=0)close(reopened);close(fd);return -1;}
  struct stat held_before,reopened_before;
  if(fstat(fd,&held_before)!=0||fstat(reopened,&reopened_before)!=0||
      held_before.st_dev!=reopened_before.st_dev||held_before.st_ino!=reopened_before.st_ino||
      fsync(BPS09_FD_INSTALL_PARENT)!=0||unlinkat(BPS09_FD_INSTALL_PARENT,tombstone,0)!=0||
      fsync(BPS09_FD_INSTALL_PARENT)!=0){close(reopened);close(fd);return -1;}
  struct stat held_after;
  int probe=(int)syscall(SYS_openat2,BPS09_FD_INSTALL_PARENT,tombstone,&how,sizeof how);
  int probe_errno=errno;
  if(probe>=0)close(probe);
  int result=fstat(fd,&held_after)==0&&held_after.st_nlink==0&&probe<0&&probe_errno==ENOENT?0:-1;
  close(reopened);
  close(fd);
  return result;
}

static int verify_beneath_identity_or_absence(const char *name,const struct bps09_file_claim *claim,bool claim_present){
  if(!canonical_name(name))return -1;struct open_how how={.flags=O_RDONLY|O_NOFOLLOW|O_CLOEXEC,.resolve=RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS};int fd=(int)syscall(SYS_openat2,BPS09_FD_INSTALL_PARENT,name,&how,sizeof how);
  if(!claim_present){if(fd>=0){close(fd);return -1;}return errno==ENOENT?0:-1;}if(fd<0)return -1;int result=replay_claim_fd(fd,claim,true);int saved=errno;if(close(fd)!=0&&result==0)result=-1;errno=saved;return result;
}

static int observe_held_install_name(int fd,const char *name,struct bps09_file_claim *claim) {
  char path[4096];int bytes;
  if(fd<0||!canonical_name(name)||(bytes=snprintf(path,sizeof path,"%s/%s",g_runtime.bootstrap.parent.path,name))<=0||(size_t)bytes>=sizeof path||observe_regular_file_claim(fd,path,claim)!=0)return -1;
  if(strcmp(claim->sha256,g_runtime.bootstrap.target.sha256)!=0||claim->byte_length!=g_runtime.bootstrap.target.byte_length||claim->mode!=0550U||claim->uid!=0U||claim->gid!=0U||claim->nlink!=1U||claim->mount_id!=g_runtime.bootstrap.parent.mount_id)return -1;
  return 0;
}

static int close_dynamic_artifact_fds(void) {
  int result=0;
  if(g_runtime.final_fd>=0){if(close(g_runtime.final_fd)!=0)result=-1;g_runtime.final_fd=-1;}
  if(g_runtime.temp_fd>=0){if(close(g_runtime.temp_fd)!=0)result=-1;g_runtime.temp_fd=-1;}
  return result;
}

static bool validated_custodian_custody_receipt(void) {
  return g_runtime.custody_acked&&g_custody_reply.version==1U&&g_custody_reply.state==1U&&
    lowercase_sha256(g_custody_reply.receipt_sha256)&&strcmp(g_custody_reply.producer,"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT")==0&&
    strcmp(g_custody_reply.outcome,"BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD")==0&&strcmp(g_custody_reply.decision,"HOLD")==0&&strcmp(g_custody_reply.authority,"NONE")==0&&
    g_custody_reply.resource_dev==g_runtime.final_claim.dev&&g_custody_reply.resource_ino==g_runtime.final_claim.ino&&g_custody_reply.resource_mount_id==g_runtime.final_claim.mount_id;
}

static int converge_failed_install_artifacts(bool retain_published_final) {
  struct bps09_file_claim observed;int held_fd=g_runtime.final_fd>=0?g_runtime.final_fd:g_runtime.temp_fd;
  if(g_runtime.published){
    if(held_fd>=0){if(observe_held_install_name(held_fd,g_runtime.bootstrap.final_name,&observed)!=0)return -1;}
    else {if(!lowercase_sha256(g_runtime.final_claim.sha256)||verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,&g_runtime.final_claim,true)!=0)return -1;observed=g_runtime.final_claim;}
    g_runtime.final_claim=observed;
    if(close_dynamic_artifact_fds()!=0)return -1;
    if(retain_published_final){if(!validated_custodian_custody_receipt()||verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,&g_runtime.final_claim,true)!=0)return -1;return fsync(BPS09_FD_INSTALL_PARENT);}
    if(recover_one_exact_identity(g_runtime.bootstrap.final_name,&g_runtime.final_claim,true)!=0)return -1;g_runtime.published=false;g_runtime.custody_acked=false;
  }else{
    if(retain_published_final)return -1;
    if(g_runtime.temp_fd>=0){if(observe_held_install_name(g_runtime.temp_fd,g_runtime.bootstrap.temp_name,&observed)!=0||close_dynamic_artifact_fds()!=0||recover_one_exact_identity(g_runtime.bootstrap.temp_name,&observed,true)!=0)return -1;}
    else if(verify_beneath_identity_or_absence(g_runtime.bootstrap.temp_name,&observed,false)!=0)return -1;
    if(verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,&observed,false)!=0)return -1;
    g_runtime.custody_acked=false;
  }
  return fsync(BPS09_FD_INSTALL_PARENT);
}

static int recover_install_attempt_by_identity(void) {
  g_runtime.custody_acked = strcmp(g_runtime.bootstrap.actual_prior_producer,"EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT")==0;
  if(request_abort_cas_receipt(6U,g_runtime.bootstrap.actual_prior_receipt_sha256,g_runtime.bootstrap.actual_prior_producer,&g_abort_reply)!=0)return -1;
  if((g_runtime.custody_acked&&g_abort_reply.state!=2U)||(!g_runtime.custody_acked&&g_abort_reply.state!=1U))return -1;
  g_runtime.cas_held=true;g_runtime.phase=BPS09_PHASE_ABORT_LATCHED;g_runtime.published=g_runtime.bootstrap.recovery_final_claim_present;
  if(replay_claim_fd(BPS09_FD_INSTALL_PARENT,&g_runtime.bootstrap.parent,false)!=0||recover_one_exact_identity(g_runtime.bootstrap.temp_name,&g_runtime.bootstrap.recovery_temp,g_runtime.bootstrap.recovery_temp_claim_present)!=0)return -1;
  if(g_runtime.custody_acked){if(verify_beneath_identity_or_absence(g_runtime.bootstrap.final_name,&g_runtime.bootstrap.recovery_final,true)!=0)return -1;}
  else if(recover_one_exact_identity(g_runtime.bootstrap.final_name,&g_runtime.bootstrap.recovery_final,g_runtime.bootstrap.recovery_final_claim_present)!=0)return -1;
  if(fsync(BPS09_FD_INSTALL_PARENT)!=0||request_identity_cleanup_receipt()!=0||verify_install_zero_residue()!=0||request_parent_fsync_zero_receipt()!=0||persist_recovery_evidence_hold()!=0||release_install_attempt_cas_after_terminal_hold(&g_terminal_evidence_ack)!=0)return -1;
  g_runtime.cas_held = false;g_runtime.phase=BPS09_PHASE_HOLD_PERSISTED;return 0;
}

static int supervised_failure_hold(void) {
  if (g_runtime.phase < BPS09_PHASE_CAS_ACQUIRED || !g_runtime.cas_held) return -1;
  const struct bps09_rpc *prior=&g_cas_reply;const char *prior_producer="INSTALL_WATCHDOG_ATTEMPT_CAS_RECEIPT";
  bool authenticated_custody=validated_custodian_custody_receipt();
  if(g_runtime.custody_acked&&!authenticated_custody)return -1;
  if(authenticated_custody){prior=&g_custody_reply;prior_producer="EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT";}
  else if(g_runtime.published&&lowercase_sha256(g_publication_reply.receipt_sha256)){prior=&g_publication_reply;prior_producer="INSTALL_WATCHDOG_PUBLICATION_RECEIPT";}
  if(request_abort_cas_receipt(8U,prior->receipt_sha256,prior_producer,&g_abort_reply)!=0)return -1;
  bool retain_published_final=authenticated_custody&&g_abort_reply.state==2U;if((authenticated_custody&&!retain_published_final)||(!g_runtime.published&&retain_published_final))return -1;
  g_runtime.phase=BPS09_PHASE_ABORT_LATCHED;
  if(converge_failed_install_artifacts(retain_published_final)!=0||request_identity_cleanup_receipt()!=0||verify_install_zero_residue()!=0||request_parent_fsync_zero_receipt()!=0||persist_install_failure_evidence_hold()!=0||release_install_attempt_cas_after_terminal_hold(&g_terminal_evidence_ack)!=0)return -1;
  g_runtime.cas_held=false;g_runtime.phase=BPS09_PHASE_HOLD_PERSISTED;return 0;
}

int main(int argc, char **argv) {
  if (validate_install_or_recover_invocation(argc, argv) != 0) return 90;
  if(umask(0)!=0U)return 90;
  if (load_and_validate_native_bootstrap() != 0) return 91;
  if (g_runtime.bootstrap.mode == BPS09_MODE_RECOVER) return recover_install_attempt_by_identity() == 0 ? 0 : 92;
  if (verify_independent_compile_review_gate() != 0) return 93;
  if (replay_source_artifact_same_object() != 0) return 94;
  if (acquire_install_attempt_cas() != 0) return 95;
  if (replay_install_parent_identity() != 0) goto cleanup;
  if (create_temp_beneath_openat2() != 0) goto cleanup;
  if (stream_source_to_temp_bounded() != 0) goto cleanup;
  if (fsync_temp_and_replay_identity() != 0) goto cleanup;
  if (publish_noreplace_and_fsync_parent() != 0) goto cleanup;
  if (reopen_final_same_object_statx() != 0) goto cleanup;
  if (request_custodian_ack() != 0) goto cleanup;
  if (verify_install_zero_residue() != 0) goto cleanup;
  if (persist_install_evidence_hold() != 0) goto cleanup;
  return 0;
cleanup:
  return supervised_failure_hold() == 0 ? 98 : 99;
}
