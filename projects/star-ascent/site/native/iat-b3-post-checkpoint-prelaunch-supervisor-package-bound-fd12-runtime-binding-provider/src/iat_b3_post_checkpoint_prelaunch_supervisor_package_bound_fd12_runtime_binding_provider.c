#define _GNU_SOURCE
#include <arpa/inet.h>
#include <endian.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <linux/kcmp.h>
#include <linux/memfd.h>
#include <linux/stat.h>
#include <poll.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/timerfd.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>
#include <openssl/sha.h>
#include <openssl/evp.h>

enum {
  FD_WATCHDOG_CHANNEL = 6,
  FD_OBSERVER_CHANNEL = 7,
  FD_CUSTODIAN_CHANNEL = 8,
  FD_OPERATION_TIMER = 9,
  FD_TEARDOWN_TIMER = 10,
  FD_WATCHDOG_PIDFD = 13,
  FD_OBSERVER_PIDFD = 14,
  FD_CUSTODIAN_PIDFD = 15,
  FD_CAS_TOKEN = 16,
  FD_RUNTIME_RECEIPT = 17,
#ifdef IAT_B3_BPS08A_NATIVE_LAYOUT
  FD_PROTECTED_PARENT_DIR = 5,
  FD_QUARANTINE_DIR = 22,
  FD_KERNEL_DESCRIPTOR = 23,
#else
  FD_SYSROOT_DIR = 18,
  FD_CWD_DIR = 19,
  FD_PROTECTED_PARENT_DIR = 25,
  FD_QUARANTINE_DIR = 26,
  FD_KERNEL_DESCRIPTOR = 27,
#endif
  FD_CAS_LEDGER_DIR = 30,
  FD_CAS_SEED = 31
};

#define DESCRIPTOR_MAGIC "IATB3RB1"
#define DESCRIPTOR_VERSION 1u
#define REQUIRED_SEALS (F_SEAL_SEAL | F_SEAL_SHRINK | F_SEAL_GROW | F_SEAL_WRITE | F_SEAL_FUTURE_WRITE)

struct __attribute__((packed)) peer_wire {
  uint64_t pid_be;
  uint64_t uid_be;
  uint64_t gid_be;
  uint64_t start_ticks_be;
  uint64_t channel_dev_be;
  uint64_t channel_ino_be;
  uint64_t pidfd_dev_be;
  uint64_t pidfd_ino_be;
  unsigned char executable_sha256[32];
  unsigned char security_label_sha256[32];
  unsigned char namespace_projection_sha256[32];
  unsigned char cgroup_projection_sha256[32];
  unsigned char authority_projection_sha256[32];
  unsigned char channel_ofd_projection_sha256[32];
};

struct __attribute__((packed)) dir_wire {
  uint64_t dev_be;
  uint64_t ino_be;
  uint64_t mode_be;
};

struct __attribute__((packed)) kernel_descriptor_v1 {
  unsigned char magic[8];
  uint32_t version_be;
  uint32_t byte_length_be;
  struct peer_wire peers[3];
  struct dir_wire directories[4];
  uint64_t target_dev_be;
  uint64_t target_ino_be;
  uint64_t target_mount_id_be;
  unsigned char cas_token_sha256[32];
  unsigned char ledger_identity_sha256[32];
  unsigned char target_name_sha256[32];
  unsigned char tombstone_name_sha256[32];
  uint64_t timer_deadline_ns_be[2];
  unsigned char timer_ofd_sha256[2][32];
  unsigned char runtime_receipt_sha256[32];
  unsigned char provider_executable_sha256[32];
  unsigned char role_public_keys[3][32];
  unsigned char principal_sha256[3][32];
  unsigned char role_signatures[3][64];
};

_Static_assert(sizeof(struct kernel_descriptor_v1) == 1560u, "kernel descriptor v1 wire size");

static void wipe(void *pointer, size_t length) {
  volatile unsigned char *p = pointer;
  while (length-- != 0) *p++ = 0;
}

static int fail(const char *message) {
  if (message != NULL) (void)dprintf(STDERR_FILENO, "%s\n", message);
  return 111;
}

static int read_exact_at(int fd, void *buffer, size_t length) {
  size_t done = 0;
  while (done < length) {
    ssize_t count = pread(fd, (unsigned char *)buffer + done, length - done, (off_t)done);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return -1;
    done += (size_t)count;
  }
  unsigned char extra;
  return pread(fd, &extra, 1, (off_t)length) == 0 ? 0 : -1;
}

static int read_token_once(unsigned char token[32]) {
  size_t done = 0;
  while (done < 32) {
    ssize_t count = read(FD_CAS_TOKEN, token + done, 32 - done);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return -1;
    done += (size_t)count;
  }
  unsigned char extra;
  for (;;) {
    ssize_t count = read(FD_CAS_TOKEN, &extra, 1);
    if (count < 0 && errno == EINTR) continue;
    return count == 0 ? 0 : -1;
  }
}

static int sealed_memfd(int fd, size_t exact_length, size_t maximum_length) {
  struct stat st;
  if (fstat(fd, &st) != 0 || !S_ISREG(st.st_mode) || st.st_nlink != 0 || st.st_size <= 0) return -1;
  if (exact_length != 0 && (size_t)st.st_size != exact_length) return -1;
  if (maximum_length != 0 && (size_t)st.st_size > maximum_length) return -1;
  int seals = fcntl(fd, F_GET_SEALS);
  return seals >= 0 && (seals & REQUIRED_SEALS) == REQUIRED_SEALS ? 0 : -1;
}

static void hex32(const unsigned char input[32], char output[65]) {
  static const char digits[] = "0123456789abcdef";
  for (size_t i = 0; i < 32; ++i) {
    output[i * 2] = digits[input[i] >> 4];
    output[i * 2 + 1] = digits[input[i] & 15];
  }
  output[64] = '\0';
}

static int sha256_path(const char *path, int nofollow, unsigned char output[32]) {
  int flags = O_RDONLY | O_CLOEXEC | (nofollow ? O_NOFOLLOW : 0);
  int fd = open(path, flags);
  if (fd < 0) return -1;
  SHA256_CTX context;
  if (SHA256_Init(&context) != 1) { close(fd); return -1; }
  unsigned char buffer[65536];
  for (;;) {
    ssize_t count = read(fd, buffer, sizeof(buffer));
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) { close(fd); return -1; }
    if (count == 0) break;
    if (SHA256_Update(&context, buffer, (size_t)count) != 1) { close(fd); return -1; }
  }
  close(fd);
  return SHA256_Final(output, &context) == 1 ? 0 : -1;
}

static int sha256_fd_exact(int fd, size_t length, unsigned char output[32]) {
  SHA256_CTX context;
  if (SHA256_Init(&context) != 1) return -1;
  unsigned char buffer[65536];
  size_t offset = 0;
  while (offset < length) {
    size_t wanted = length - offset < sizeof(buffer) ? length - offset : sizeof(buffer);
    ssize_t count = pread(fd, buffer, wanted, (off_t)offset);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0 || (size_t)count > wanted || SHA256_Update(&context, buffer, (size_t)count) != 1) return -1;
    offset += (size_t)count;
  }
  unsigned char extra;
  if (pread(fd, &extra, 1, (off_t)length) != 0) return -1;
  return SHA256_Final(output, &context) == 1 ? 0 : -1;
}

static int verify_descriptor_role_signature(const struct kernel_descriptor_v1 *descriptor, size_t role) {
  static const char *domains[] = {
    "IAT_B3_BPS08A_KERNEL_DESCRIPTOR_WATCHDOG_V1",
    "IAT_B3_BPS08A_KERNEL_DESCRIPTOR_OBSERVER_V1",
    "IAT_B3_BPS08A_KERNEL_DESCRIPTOR_CUSTODIAN_V1"
  };
  if (role >= 3) return -1;
  size_t domain_bytes = strlen(domains[role]);
  size_t descriptor_bytes = offsetof(struct kernel_descriptor_v1, role_signatures);
  size_t message_bytes = domain_bytes + 1 + descriptor_bytes;
  unsigned char *message = malloc(message_bytes);
  if (message == NULL) return -1;
  memcpy(message, domains[role], domain_bytes);
  message[domain_bytes] = 0;
  memcpy(message + domain_bytes + 1, descriptor, descriptor_bytes);
  EVP_PKEY *key = EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519, NULL, descriptor->role_public_keys[role], 32);
  EVP_MD_CTX *context = key == NULL ? NULL : EVP_MD_CTX_new();
  int ok = context != NULL &&
    EVP_DigestVerifyInit(context, NULL, NULL, NULL, key) == 1 &&
    EVP_DigestVerify(context, descriptor->role_signatures[role], 64, message, message_bytes) == 1;
  EVP_MD_CTX_free(context);
  EVP_PKEY_free(key);
  wipe(message, message_bytes);
  free(message);
  return ok ? 0 : -1;
}

static int principal_sha256(const struct peer_wire *peer, size_t role, unsigned char output[32]) {
  static const char *roles[] = {"watchdog", "observer", "custodian"};
  static const unsigned pidfd_fds[] = {FD_WATCHDOG_PIDFD, FD_OBSERVER_PIDFD, FD_CUSTODIAN_PIDFD};
  if (role >= 3) return -1;
  char executable[65], security_label[65], namespaces[65], cgroup[65], authority[65], channel[65];
  hex32(peer->executable_sha256, executable);
  hex32(peer->security_label_sha256, security_label);
  hex32(peer->namespace_projection_sha256, namespaces);
  hex32(peer->cgroup_projection_sha256, cgroup);
  hex32(peer->authority_projection_sha256, authority);
  hex32(peer->channel_ofd_projection_sha256, channel);
  char projection[2048];
  int length = snprintf(projection, sizeof(projection),
    "{\"role\":\"%s\",\"pid\":\"%llu\",\"uid\":\"%llu\",\"gid\":\"%llu\",\"startTicks\":\"%llu\",\"pidfdFd\":\"%u\",\"pidfdDev\":\"%llu\",\"pidfdIno\":\"%llu\",\"executableSha256\":\"%s\",\"securityLabelSha256\":\"%s\",\"namespaceProjectionSha256\":\"%s\",\"cgroupProjectionSha256\":\"%s\",\"authorityProjectionSha256\":\"%s\",\"channelOpenFileDescriptionSha256\":\"%s\"}\n",
    roles[role],
    (unsigned long long)be64toh(peer->pid_be),
    (unsigned long long)be64toh(peer->uid_be),
    (unsigned long long)be64toh(peer->gid_be),
    (unsigned long long)be64toh(peer->start_ticks_be),
    pidfd_fds[role],
    (unsigned long long)be64toh(peer->pidfd_dev_be),
    (unsigned long long)be64toh(peer->pidfd_ino_be),
    executable, security_label, namespaces, cgroup, authority, channel);
  if (length <= 0 || (size_t)length >= sizeof(projection)) return -1;
  return SHA256((const unsigned char *)projection, (size_t)length, output) == NULL ? -1 : 0;
}

static int verify_descriptor_quorum(const struct kernel_descriptor_v1 *descriptor) {
  if (memcmp(descriptor->role_public_keys[0], descriptor->role_public_keys[1], 32) == 0 ||
      memcmp(descriptor->role_public_keys[0], descriptor->role_public_keys[2], 32) == 0 ||
      memcmp(descriptor->role_public_keys[1], descriptor->role_public_keys[2], 32) == 0) return -1;
  for (size_t role = 0; role < 3; ++role) {
    unsigned char zero[32] = {0}, observed_principal[32];
    if (memcmp(descriptor->role_public_keys[role], zero, 32) == 0 ||
        memcmp(descriptor->principal_sha256[role], zero, 32) == 0 ||
        principal_sha256(&descriptor->peers[role], role, observed_principal) != 0 ||
        memcmp(descriptor->principal_sha256[role], observed_principal, 32) != 0 ||
        verify_descriptor_role_signature(descriptor, role) != 0) return -1;
  }
  return 0;
}

static int proc_start_ticks(pid_t pid, uint64_t *ticks) {
  char path[64], buffer[4096];
  if (snprintf(path, sizeof(path), "/proc/%ld/stat", (long)pid) <= 0) return -1;
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) return -1;
  ssize_t count = read(fd, buffer, sizeof(buffer) - 1);
  close(fd);
  if (count <= 0) return -1;
  buffer[count] = '\0';
  char *cursor = strrchr(buffer, ')');
  if (cursor == NULL || cursor[1] != ' ') return -1;
  cursor += 2;
  char *save = NULL;
  char *token = strtok_r(cursor, " ", &save);
  if (token == NULL || strlen(token) != 1) return -1;
  for (unsigned field = 4; field <= 22; ++field) {
    token = strtok_r(NULL, " ", &save);
    if (token == NULL) return -1;
    if (field == 22) {
      char *end = NULL;
      errno = 0;
      unsigned long long value = strtoull(token, &end, 10);
      if (errno != 0 || end == token || *end != '\0') return -1;
      *ticks = (uint64_t)value;
      return 0;
    }
  }
  return -1;
}

static int sha256_namespace_projection(pid_t pid, unsigned char output[32]) {
  static const char *names[] = {"mnt", "pid", "user", "net", "ipc", "uts", "cgroup", "time"};
  SHA256_CTX context;
  if (SHA256_Init(&context) != 1) return -1;
  for (size_t i = 0; i < sizeof(names) / sizeof(names[0]); ++i) {
    char path[96], target[256], line[384];
    if (snprintf(path, sizeof(path), "/proc/%ld/ns/%s", (long)pid, names[i]) <= 0) return -1;
    ssize_t length = readlink(path, target, sizeof(target) - 1);
    if (length <= 0) return -1;
    target[length] = '\0';
    int line_length = snprintf(line, sizeof(line), "%s=%s\n", names[i], target);
    if (line_length <= 0 || (size_t)line_length >= sizeof(line) || SHA256_Update(&context, line, (size_t)line_length) != 1) return -1;
  }
  return SHA256_Final(output, &context) == 1 ? 0 : -1;
}

static int sha256_authority_projection(pid_t pid, unsigned char output[32]) {
  char path[64];
  if (snprintf(path, sizeof(path), "/proc/%ld/status", (long)pid) <= 0) return -1;
  FILE *stream = fopen(path, "re");
  if (stream == NULL) return -1;
  static const char *prefixes[] = {"Uid:", "Gid:", "CapInh:", "CapPrm:", "CapEff:", "CapBnd:", "CapAmb:", "NoNewPrivs:", "Seccomp:"};
  unsigned seen = 0;
  SHA256_CTX context;
  if (SHA256_Init(&context) != 1) { fclose(stream); return -1; }
  char *line = NULL;
  size_t capacity = 0;
  while (getline(&line, &capacity, stream) >= 0) {
    for (size_t i = 0; i < sizeof(prefixes) / sizeof(prefixes[0]); ++i) {
      size_t length = strlen(prefixes[i]);
      if (strncmp(line, prefixes[i], length) == 0) {
        if (SHA256_Update(&context, line, strlen(line)) != 1) { free(line); fclose(stream); return -1; }
        seen |= 1u << i;
      }
    }
  }
  free(line);
  fclose(stream);
  if (seen != (1u << (sizeof(prefixes) / sizeof(prefixes[0]))) - 1u) return -1;
  return SHA256_Final(output, &context) == 1 ? 0 : -1;
}

static int sha256_channel_projection(int fd, const struct ucred *credentials, unsigned char output[32]) {
  struct stat st;
  int type = 0, flags = fcntl(fd, F_GETFL);
  socklen_t length = sizeof(type);
  if (fstat(fd, &st) != 0 || flags < 0 || getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &length) != 0) return -1;
  char projection[512];
  int count = snprintf(projection, sizeof(projection), "dev=%llu\nino=%llu\nmode=%llu\ntype=%d\nflags=%d\npid=%ld\nuid=%lu\ngid=%lu\n",
    (unsigned long long)st.st_dev, (unsigned long long)st.st_ino, (unsigned long long)st.st_mode,
    type, flags, (long)credentials->pid, (unsigned long)credentials->uid, (unsigned long)credentials->gid);
  if (count <= 0 || (size_t)count >= sizeof(projection)) return -1;
  SHA256((const unsigned char *)projection, (size_t)count, output);
  return 0;
}

static int validate_peer(int channel_fd, int pidfd_fd, const struct peer_wire *expected) {
  int type = 0;
  socklen_t type_length = sizeof(type);
  if (getsockopt(channel_fd, SOL_SOCKET, SO_TYPE, &type, &type_length) != 0 || type != SOCK_SEQPACKET) return -1;
  struct ucred credentials;
  socklen_t credentials_length = sizeof(credentials);
  if (getsockopt(channel_fd, SOL_SOCKET, SO_PEERCRED, &credentials, &credentials_length) != 0 || credentials_length != sizeof(credentials)) return -1;
  if ((uint64_t)credentials.pid != be64toh(expected->pid_be) || (uint64_t)credentials.uid != be64toh(expected->uid_be) || (uint64_t)credentials.gid != be64toh(expected->gid_be)) return -1;
  struct pollfd pfd = {.fd = pidfd_fd, .events = 0};
  if (poll(&pfd, 1, 0) != 0 || pfd.revents != 0) return -1;
  struct stat channel_stat, pidfd_stat;
  if (fstat(channel_fd, &channel_stat) != 0 || fstat(pidfd_fd, &pidfd_stat) != 0) return -1;
  if ((uint64_t)channel_stat.st_dev != be64toh(expected->channel_dev_be) || (uint64_t)channel_stat.st_ino != be64toh(expected->channel_ino_be)) return -1;
  if ((uint64_t)pidfd_stat.st_dev != be64toh(expected->pidfd_dev_be) || (uint64_t)pidfd_stat.st_ino != be64toh(expected->pidfd_ino_be)) return -1;
  uint64_t ticks = 0;
  if (proc_start_ticks(credentials.pid, &ticks) != 0 || ticks != be64toh(expected->start_ticks_be)) return -1;
  char path[96];
  unsigned char digest[32];
  if (snprintf(path, sizeof(path), "/proc/%ld/exe", (long)credentials.pid) <= 0 || sha256_path(path, 0, digest) != 0 || memcmp(digest, expected->executable_sha256, 32) != 0) return -1;
  if (snprintf(path, sizeof(path), "/proc/%ld/attr/current", (long)credentials.pid) <= 0 || sha256_path(path, 1, digest) != 0 || memcmp(digest, expected->security_label_sha256, 32) != 0) return -1;
  if (sha256_namespace_projection(credentials.pid, digest) != 0 || memcmp(digest, expected->namespace_projection_sha256, 32) != 0) return -1;
  if (snprintf(path, sizeof(path), "/proc/%ld/cgroup", (long)credentials.pid) <= 0 || sha256_path(path, 1, digest) != 0 || memcmp(digest, expected->cgroup_projection_sha256, 32) != 0) return -1;
  if (sha256_authority_projection(credentials.pid, digest) != 0 || memcmp(digest, expected->authority_projection_sha256, 32) != 0) return -1;
  if (sha256_channel_projection(channel_fd, &credentials, digest) != 0 || memcmp(digest, expected->channel_ofd_projection_sha256, 32) != 0) return -1;
  return poll(&pfd, 1, 0) == 0 && pfd.revents == 0 ? 0 : -1;
}

static int validate_directory(int fd, const struct dir_wire *expected) {
  struct stat st;
  if (fstat(fd, &st) != 0 || !S_ISDIR(st.st_mode)) return -1;
  return (uint64_t)st.st_dev == be64toh(expected->dev_be) &&
    (uint64_t)st.st_ino == be64toh(expected->ino_be) &&
    (uint64_t)st.st_mode == be64toh(expected->mode_be) ? 0 : -1;
}

static int validate_timer(int fd, uint64_t expected_deadline_ns, const unsigned char expected_sha256[32]) {
  char path[64], target[64];
  int path_length = snprintf(path, sizeof(path), "/proc/self/fd/%d", fd);
  if (path_length <= 0 || (size_t)path_length >= sizeof(path)) return -1;
  ssize_t target_length = readlink(path, target, sizeof(target) - 1);
  if (target_length <= 0 || (size_t)target_length >= sizeof(target)) return -1;
  target[target_length] = '\0';
  struct pollfd pollfd = {.fd = fd, .events = POLLIN | POLLERR | POLLHUP};struct itimerspec timer;struct timespec before,after;
  unsigned char observed_sha256[32];
  int flags = fcntl(fd, F_GETFL);
  if(strcmp(target,"anon_inode:[timerfd]")!=0||flags<0||(flags&O_NONBLOCK)==0||poll(&pollfd,1,0)!=0||clock_gettime(CLOCK_MONOTONIC,&before)!=0||timerfd_gettime(fd,&timer)!=0||clock_gettime(CLOCK_MONOTONIC,&after)!=0||before.tv_sec<0||after.tv_sec<0||timer.it_interval.tv_sec!=0||timer.it_interval.tv_nsec!=0||(timer.it_value.tv_sec==0&&timer.it_value.tv_nsec==0))return -1;
  uint64_t before_ns=(uint64_t)before.tv_sec*1000000000ULL+(uint64_t)before.tv_nsec,after_ns=(uint64_t)after.tv_sec*1000000000ULL+(uint64_t)after.tv_nsec,remaining_ns=(uint64_t)timer.it_value.tv_sec*1000000000ULL+(uint64_t)timer.it_value.tv_nsec;
  if(expected_deadline_ns<=after_ns||before_ns>UINT64_MAX-remaining_ns||after_ns>UINT64_MAX-remaining_ns)return -1;uint64_t lower=before_ns+remaining_ns,upper=after_ns+remaining_ns,upper_tolerant=upper>UINT64_MAX-10000000ULL?UINT64_MAX:upper+10000000ULL,expected_tolerant=expected_deadline_ns>UINT64_MAX-10000000ULL?UINT64_MAX:expected_deadline_ns+10000000ULL;if(expected_tolerant<lower||expected_deadline_ns>upper_tolerant)return -1;
  char projection[256];int projection_bytes=snprintf(projection,sizeof projection,"{\"schema\":\"iat-b3-bps08a-timer/v1\",\"fd\":\"%d\",\"clock\":\"CLOCK_MONOTONIC\",\"deadlineMonotonicNs\":\"%" PRIu64 "\",\"nonblocking\":true}\n",fd,expected_deadline_ns);
  if(projection_bytes<=0||(size_t)projection_bytes>=sizeof projection)return -1;SHA256((const unsigned char *)projection,(size_t)projection_bytes,observed_sha256);return memcmp(observed_sha256,expected_sha256,32)==0?0:-1;
}

static int validate_component(const char *name) {
  return name != NULL && name[0] != '\0' && strcmp(name, ".") != 0 && strcmp(name, "..") != 0 &&
    strchr(name, '/') == NULL && strlen(name) <= 240 ? 0 : -1;
}

static int statx_fd(int fd, struct statx *identity) {
  memset(identity, 0, sizeof(*identity));
  return syscall(SYS_statx, fd, "", AT_EMPTY_PATH | AT_NO_AUTOMOUNT, STATX_BASIC_STATS | STATX_MNT_ID, identity);
}

static int same_statx(const struct statx *actual, const struct kernel_descriptor_v1 *descriptor) {
  uint64_t encoded_dev = ((uint64_t)actual->stx_dev_major << 32) | actual->stx_dev_minor;
  return encoded_dev == be64toh(descriptor->target_dev_be) &&
    actual->stx_ino == be64toh(descriptor->target_ino_be) &&
    actual->stx_mnt_id == be64toh(descriptor->target_mount_id_be);
}

static int identity_atomic_recover(const struct kernel_descriptor_v1 *descriptor, const char *target, const char *tombstone) {
  if (validate_component(target) != 0 || validate_component(tombstone) != 0 || strcmp(target, tombstone) == 0) return -1;
  unsigned char target_digest[32], tombstone_digest[32];
  SHA256((const unsigned char *)target, strlen(target), target_digest);
  SHA256((const unsigned char *)tombstone, strlen(tombstone), tombstone_digest);
  if (memcmp(target_digest, descriptor->target_name_sha256, 32) != 0 || memcmp(tombstone_digest, descriptor->tombstone_name_sha256, 32) != 0) return -1;
  int held = openat(FD_PROTECTED_PARENT_DIR, target, O_PATH | O_NOFOLLOW | O_CLOEXEC);
  if (held < 0) return -1;
  struct statx before, after;
  if (statx_fd(held, &before) != 0 || !same_statx(&before, descriptor)) { close(held); return -1; }
  if (syscall(SYS_renameat2, FD_PROTECTED_PARENT_DIR, target, FD_QUARANTINE_DIR, tombstone, RENAME_NOREPLACE) != 0) { close(held); return -1; }
  int reopened = openat(FD_QUARANTINE_DIR, tombstone, O_PATH | O_NOFOLLOW | O_CLOEXEC);
  if (reopened < 0 || statx_fd(reopened, &after) != 0 || !same_statx(&after, descriptor) || before.stx_ino != after.stx_ino || before.stx_mnt_id != after.stx_mnt_id) {
    if (reopened >= 0) close(reopened);
    close(held);
    return -1;
  }
  if (fsync(FD_PROTECTED_PARENT_DIR) != 0 || fsync(FD_QUARANTINE_DIR) != 0) { close(reopened); close(held); return -1; }
  if (unlinkat(FD_QUARANTINE_DIR, tombstone, 0) != 0 || fsync(FD_QUARANTINE_DIR) != 0) { close(reopened); close(held); return -1; }
  struct statx missing;
  errno = 0;
  if (syscall(SYS_statx, FD_QUARANTINE_DIR, tombstone, AT_SYMLINK_NOFOLLOW | AT_NO_AUTOMOUNT, STATX_BASIC_STATS, &missing) == 0 || errno != ENOENT) {
    close(reopened);
    close(held);
    return -1;
  }
  struct stat held_stat;
  int ok = fstat(held, &held_stat) == 0 && held_stat.st_nlink == 0;
  close(reopened);
  close(held);
  return ok ? 0 : -1;
}

static int load_and_preflight(struct kernel_descriptor_v1 *descriptor, unsigned char descriptor_digest[32], unsigned char token_digest[32]) {
  if (sealed_memfd(FD_KERNEL_DESCRIPTOR, sizeof(*descriptor), 0) != 0 || read_exact_at(FD_KERNEL_DESCRIPTOR, descriptor, sizeof(*descriptor)) != 0) return -1;
  if (sealed_memfd(FD_RUNTIME_RECEIPT, 0, 131072) != 0) return -1;
  if (memcmp(descriptor->magic, DESCRIPTOR_MAGIC, 8) != 0 || ntohl(descriptor->version_be) != DESCRIPTOR_VERSION || ntohl(descriptor->byte_length_be) != sizeof(*descriptor)) return -1;
  struct stat receipt_stat;
  unsigned char observed_receipt_sha256[32], observed_provider_sha256[32];
  if (fstat(FD_RUNTIME_RECEIPT, &receipt_stat) != 0 ||
      sha256_fd_exact(FD_RUNTIME_RECEIPT, (size_t)receipt_stat.st_size, observed_receipt_sha256) != 0 ||
      memcmp(observed_receipt_sha256, descriptor->runtime_receipt_sha256, 32) != 0 ||
      sha256_path("/proc/self/exe", 0, observed_provider_sha256) != 0 ||
      memcmp(observed_provider_sha256, descriptor->provider_executable_sha256, 32) != 0 ||
      verify_descriptor_quorum(descriptor) != 0) return -1;
  SHA256((const unsigned char *)descriptor, sizeof(*descriptor), descriptor_digest);
  if (validate_peer(FD_WATCHDOG_CHANNEL, FD_WATCHDOG_PIDFD, &descriptor->peers[0]) != 0) return -1;
  if (validate_peer(FD_OBSERVER_CHANNEL, FD_OBSERVER_PIDFD, &descriptor->peers[1]) != 0) return -1;
  if (validate_peer(FD_CUSTODIAN_CHANNEL, FD_CUSTODIAN_PIDFD, &descriptor->peers[2]) != 0) return -1;
#ifdef IAT_B3_BPS08A_NATIVE_LAYOUT
  if (validate_directory(FD_PROTECTED_PARENT_DIR, &descriptor->directories[2]) != 0 ||
      validate_directory(FD_QUARANTINE_DIR, &descriptor->directories[3]) != 0) return -1;
#else
  if (validate_directory(FD_SYSROOT_DIR, &descriptor->directories[0]) != 0 ||
      validate_directory(FD_CWD_DIR, &descriptor->directories[1]) != 0 ||
      validate_directory(FD_PROTECTED_PARENT_DIR, &descriptor->directories[2]) != 0 ||
      validate_directory(FD_QUARANTINE_DIR, &descriptor->directories[3]) != 0) return -1;
#endif
  uint64_t operation_deadline_ns=be64toh(descriptor->timer_deadline_ns_be[0]),teardown_deadline_ns=be64toh(descriptor->timer_deadline_ns_be[1]);
  if (operation_deadline_ns>=teardown_deadline_ns||syscall(SYS_kcmp,getpid(),getpid(),KCMP_FILE,(unsigned long)FD_OPERATION_TIMER,(unsigned long)FD_TEARDOWN_TIMER)==0||
      validate_timer(FD_OPERATION_TIMER,operation_deadline_ns,descriptor->timer_ofd_sha256[0]) != 0 ||
      validate_timer(FD_TEARDOWN_TIMER,teardown_deadline_ns,descriptor->timer_ofd_sha256[1]) != 0) return -1;
  struct stat parent_stat, quarantine_stat;
  if (fstat(FD_PROTECTED_PARENT_DIR, &parent_stat) != 0 ||
      fstat(FD_QUARANTINE_DIR, &quarantine_stat) != 0 ||
      parent_stat.st_dev != quarantine_stat.st_dev ||
      (parent_stat.st_dev == quarantine_stat.st_dev && parent_stat.st_ino == quarantine_stat.st_ino)) return -1;
  unsigned char token[32];
  if (read_token_once(token) != 0) return -1;
  SHA256(token, sizeof(token), token_digest);
  wipe(token, sizeof(token));
  return memcmp(token_digest, descriptor->cas_token_sha256, 32) == 0 ? 0 : -1;
}

static int acquire_external_cas(const char *key_hex) {
  if (key_hex == NULL || strlen(key_hex) != 64 || strspn(key_hex, "0123456789abcdef") != 64) return fail("CAS_KEY_INVALID");
  struct stat ledger;
  if (fstat(FD_CAS_LEDGER_DIR, &ledger) != 0 || !S_ISDIR(ledger.st_mode) || ledger.st_uid != geteuid() || (ledger.st_mode & 0077) != 0) return fail("CAS_LEDGER_UNPROTECTED");
  unsigned char token[32];
  if (sealed_memfd(FD_CAS_SEED, sizeof(token), 0) != 0 || read_exact_at(FD_CAS_SEED, token, sizeof(token)) != 0) return fail("CAS_SEED_INVALID");
  char name[80];
  if (snprintf(name, sizeof(name), "cas-%s", key_hex) <= 0) { wipe(token, sizeof(token)); return fail("CAS_NAME_INVALID"); }
  int marker = openat(FD_CAS_LEDGER_DIR, name, O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW, 0400);
  if (marker < 0) { wipe(token, sizeof(token)); return fail("CAS_ALREADY_ACQUIRED_OR_UNAVAILABLE"); }
  char token_hex[65], record[160];
  hex32(token, token_hex);
  int record_length = snprintf(record, sizeof(record), "IAT_B3_BPS08A_CAS_V1\n%s\n", token_hex);
  wipe(token, sizeof(token));
  if (record_length <= 0 || write(marker, record, (size_t)record_length) != record_length || fdatasync(marker) != 0 || fsync(FD_CAS_LEDGER_DIR) != 0) {
    close(marker);
    return fail("CAS_DURABILITY_FAILED");
  }
  struct stat marker_stat;
  if (fstat(marker, &marker_stat) != 0 || marker_stat.st_nlink != 1 || marker_stat.st_uid != geteuid() || (marker_stat.st_mode & 0777) != 0400) {
    close(marker);
    return fail("CAS_IDENTITY_FAILED");
  }
  close(marker);
  unsigned char ledger_digest[32];
  char projection[256];
  int projection_length = snprintf(projection, sizeof(projection), "ledgerDev=%llu\nledgerIno=%llu\nmarkerDev=%llu\nmarkerIno=%llu\nkey=%s\n",
    (unsigned long long)ledger.st_dev, (unsigned long long)ledger.st_ino,
    (unsigned long long)marker_stat.st_dev, (unsigned long long)marker_stat.st_ino, key_hex);
  if (projection_length <= 0 || (size_t)projection_length >= sizeof(projection)) return fail("CAS_PROJECTION_FAILED");
  SHA256((const unsigned char *)projection, (size_t)projection_length, ledger_digest);
  char digest_hex[65];
  hex32(ledger_digest, digest_hex);
  return dprintf(STDOUT_FILENO, "{\"ledgerIdentitySha256\":\"%s\",\"outcome\":\"ACQUIRED_ONCE_EXTERNAL_DURABLE\"}\n", digest_hex) > 0 ? 0 : fail("CAS_EVIDENCE_FAILED");
}

int main(int argc, char **argv) {
  if (argc == 3 && strcmp(argv[1], "--acquire-cas") == 0) return acquire_external_cas(argv[2]);
  if (argc != 2 && argc != 4) return fail("USAGE");
  int recover = argc == 4 && strcmp(argv[1], "--recover") == 0;
#ifdef IAT_B3_BPS08A_NATIVE_LAYOUT
  if (!recover && strcmp(argv[1], "--preflight-native") != 0) return fail("MODE_INVALID");
#else
  if (!recover && strcmp(argv[1], "--preflight-compile") != 0) return fail("MODE_INVALID");
#endif
  struct kernel_descriptor_v1 descriptor;
  unsigned char descriptor_digest[32], token_digest[32];
  if (load_and_preflight(&descriptor, descriptor_digest, token_digest) != 0) return fail("LIVE_KERNEL_BINDING_REJECTED");
  if (recover && identity_atomic_recover(&descriptor, argv[2], argv[3]) != 0) return fail("IDENTITY_ATOMIC_RECOVERY_REJECTED");
  char descriptor_hex[65], token_hex[65], ledger_hex[65];
  hex32(descriptor_digest, descriptor_hex);
  hex32(token_digest, token_hex);
  hex32(descriptor.ledger_identity_sha256, ledger_hex);
  wipe(&descriptor, sizeof(descriptor));
  return dprintf(STDOUT_FILENO, "{\"casTokenSha256\":\"%s\",\"kernelDescriptorSha256\":\"%s\",\"ledgerIdentitySha256\":\"%s\",\"outcome\":\"LIVE_KERNEL_BINDING_VERIFIED\"}\n", token_hex, descriptor_hex, ledger_hex) > 0 ? 0 : fail("PREFLIGHT_EVIDENCE_FAILED");
}
