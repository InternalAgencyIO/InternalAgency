#define _GNU_SOURCE 1

#include "iat_b3_containment.h"

#if !defined(_WIN32)

#include <errno.h>
#include <fcntl.h>
#include <linux/sched.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/timerfd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef P_PIDFD
#define P_PIDFD 3
#endif

#ifndef __WALL
#define __WALL 0x40000000
#endif

#ifndef SYS_clone3
#define SYS_clone3 __NR_clone3
#endif

#ifndef SYS_execveat
#define SYS_execveat __NR_execveat
#endif

#ifndef SYS_pidfd_open
#define SYS_pidfd_open __NR_pidfd_open
#endif

#ifndef SYS_pidfd_send_signal
#define SYS_pidfd_send_signal __NR_pidfd_send_signal
#endif

extern char **environ;

/*
 * This adapter is behind IAT_B3_PHASE_A_EXECUTION_ENABLED in main.c.  Its
 * tokens describe an implementation, never evidence that the host supplied a
 * capability or that the implementation was compiled or run.
 */

#define IAT_B3_LINUX_CONTROL_VERSION 1U
#define IAT_B3_LINUX_READY_MAGIC 0x49334252U
#define IAT_B3_LINUX_STARTED_MAGIC 0x49334253U
#define IAT_B3_LINUX_STATUS_MAGIC 0x49334254U
#define IAT_B3_LINUX_MAP_TOKEN 0x4dU
#define IAT_B3_LINUX_START_TOKEN 0x53U
#define IAT_B3_LINUX_IO_CHUNK 16384U

typedef enum iat_b3_linux_drain_result {
  IAT_B3_LINUX_DRAIN_ERROR = 0,
  IAT_B3_LINUX_DRAIN_PROGRESS,
  IAT_B3_LINUX_DRAIN_CLOSED,
  IAT_B3_LINUX_DRAIN_CAP_EXCEEDED
} iat_b3_linux_drain_result;

typedef enum iat_b3_linux_status_observation {
  IAT_B3_LINUX_STATUS_INVALID = 0,
  IAT_B3_LINUX_STATUS_PROGRESS,
  IAT_B3_LINUX_STATUS_COMMITTED
} iat_b3_linux_status_observation;

typedef struct iat_b3_linux_exec_identity {
  uint64_t device;
  uint64_t inode;
  uint32_t mode;
} iat_b3_linux_exec_identity;

typedef struct iat_b3_linux_ready_frame {
  uint32_t magic;
  uint32_t version;
  uint32_t namespace_pid;
  uint32_t parent_death_signal;
  uint64_t exec_device;
  uint64_t exec_inode;
  uint32_t exec_mode;
  uint32_t proc_private;
} iat_b3_linux_ready_frame;

typedef struct iat_b3_linux_started_frame {
  uint32_t magic;
  uint32_t version;
  uint32_t root_namespace_pid;
  uint32_t reserved;
} iat_b3_linux_started_frame;

typedef struct iat_b3_linux_status_frame {
  uint32_t magic;
  uint32_t version;
  int32_t root_exit_code;
  int32_t root_signal;
  uint64_t descendants_reaped;
  uint32_t root_status_committed;
  uint32_t complete_reap;
} iat_b3_linux_status_frame;

typedef struct iat_b3_linux_child_context {
  const iat_b3_config *config;
  iat_b3_linux_exec_identity exec_identity;
  int exec_fd;
  int parent_guard_pidfd;
  int map_gate_read_fd;
  int ready_write_fd;
  int start_read_fd;
  int status_write_fd;
  int stdout_write_fd;
  int stderr_write_fd;
  int parent_map_gate_write_fd;
  int parent_ready_read_fd;
  int parent_start_write_fd;
  int parent_status_read_fd;
  int parent_stdout_read_fd;
  int parent_stderr_read_fd;
  int inherited_startup_watchdog_fd;
  int inherited_outer_watchdog_fd;
  int inherited_execution_deadline_fd;
  int inherited_finalization_deadline_fd;
  int inherited_teardown_deadline_fd;
} iat_b3_linux_child_context;

typedef struct iat_b3_linux_supervisor {
  const iat_b3_config *config;
  iat_b3_result *result;
  uint64_t immutable_execution_deadline_ms;
  uint64_t immutable_teardown_observation_deadline_ms;
  uint64_t teardown_deadline_at_ms;
  uint64_t started_at_ms;
  int exec_fd;
  int parent_guard_pidfd;
  int namespace_pidfd;
  pid_t namespace_outer_pid;
  int map_gate_write_fd;
  int ready_read_fd;
  int start_write_fd;
  int status_read_fd;
  int stdout_read_fd;
  int stderr_read_fd;
  int startup_watchdog_fd;
  int immutable_outer_watchdog_fd;
  int execution_deadline_fd;
  int finalization_deadline_fd;
  int teardown_observation_deadline_fd;
  int watchdogs_armed_before_clone3;
  int forced_teardown_started;
  int teardown_bound_armed;
  int teardown_timer_armed;
  int teardown_timer_arm_failed;
  int teardown_signal_attempted;
  int teardown_signal_delivered;
  int teardown_target_already_terminal;
  int failure_outcome_committed;
  iat_b3_outcome frozen_failure_outcome;
  int status_committed;
  int status_eof_confirmed;
  int status_trailing_observed;
  unsigned char status_frame_bytes[sizeof(iat_b3_linux_status_frame) + 1U];
  size_t status_frame_length;
  int namespace_terminal;
  int namespace_pid1_exit_validated;
  int stdout_closed;
  int stderr_closed;
  unsigned char *stdout_transcript;
  size_t stdout_transcript_length;
  size_t stdout_transcript_capacity;
} iat_b3_linux_supervisor;

static void close_owned_fd(int *fd) {
  if (fd != NULL && *fd >= 0) {
    (void)close(*fd);
    *fd = -1;
  }
}

static void freeze_failure_outcome_once(
    iat_b3_linux_supervisor *supervisor, iat_b3_outcome outcome) {
  if (supervisor == NULL || outcome == IAT_B3_OUTCOME_PASS ||
      supervisor->failure_outcome_committed) {
    return;
  }
  supervisor->frozen_failure_outcome = outcome;
  supervisor->failure_outcome_committed = 1;
  supervisor->result->outcome = outcome;
}

static void initialize_child_context(iat_b3_linux_child_context *context) {
  memset(context, 0, sizeof(*context));
  context->exec_fd = -1;
  context->parent_guard_pidfd = -1;
  context->map_gate_read_fd = -1;
  context->ready_write_fd = -1;
  context->start_read_fd = -1;
  context->status_write_fd = -1;
  context->stdout_write_fd = -1;
  context->stderr_write_fd = -1;
  context->parent_map_gate_write_fd = -1;
  context->parent_ready_read_fd = -1;
  context->parent_start_write_fd = -1;
  context->parent_status_read_fd = -1;
  context->parent_stdout_read_fd = -1;
  context->parent_stderr_read_fd = -1;
  context->inherited_startup_watchdog_fd = -1;
  context->inherited_outer_watchdog_fd = -1;
  context->inherited_execution_deadline_fd = -1;
  context->inherited_finalization_deadline_fd = -1;
  context->inherited_teardown_deadline_fd = -1;
}

static void close_parent_copy_of_child_endpoints(
    iat_b3_linux_child_context *context) {
  close_owned_fd(&context->map_gate_read_fd);
  close_owned_fd(&context->ready_write_fd);
  close_owned_fd(&context->start_read_fd);
  close_owned_fd(&context->status_write_fd);
  close_owned_fd(&context->stdout_write_fd);
  close_owned_fd(&context->stderr_write_fd);
  context->exec_fd = -1;
  context->parent_guard_pidfd = -1;
  context->parent_map_gate_write_fd = -1;
  context->parent_ready_read_fd = -1;
  context->parent_start_write_fd = -1;
  context->parent_status_read_fd = -1;
  context->parent_stdout_read_fd = -1;
  context->parent_stderr_read_fd = -1;
  context->inherited_startup_watchdog_fd = -1;
  context->inherited_outer_watchdog_fd = -1;
  context->inherited_execution_deadline_fd = -1;
  context->inherited_finalization_deadline_fd = -1;
  context->inherited_teardown_deadline_fd = -1;
}

static void close_pid1_unused_parent_endpoints_and_timers(
    iat_b3_linux_child_context *context) {
  close_owned_fd(&context->parent_map_gate_write_fd);
  close_owned_fd(&context->parent_ready_read_fd);
  close_owned_fd(&context->parent_start_write_fd);
  close_owned_fd(&context->parent_status_read_fd);
  close_owned_fd(&context->parent_stdout_read_fd);
  close_owned_fd(&context->parent_stderr_read_fd);
  close_owned_fd(&context->inherited_startup_watchdog_fd);
  close_owned_fd(&context->inherited_outer_watchdog_fd);
  close_owned_fd(&context->inherited_execution_deadline_fd);
  close_owned_fd(&context->inherited_finalization_deadline_fd);
  close_owned_fd(&context->inherited_teardown_deadline_fd);
}

static int make_cloexec_pipe(int pair[2]) {
  return pipe2(pair, O_CLOEXEC) == 0;
}

static int make_nonblocking(int fd) {
  int flags = fcntl(fd, F_GETFL, 0);
  return flags >= 0 && fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
}

static int read_exact(int fd, void *bytes, size_t length) {
  unsigned char *cursor = (unsigned char *)bytes;
  while (length > 0U) {
    ssize_t count = read(fd, cursor, length);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return 0;
    cursor += (size_t)count;
    length -= (size_t)count;
  }
  return 1;
}

static int write_exact(int fd, const void *bytes, size_t length) {
  return iat_b3_write_all(fd, bytes, length);
}

static int write_control_without_sigpipe(int fd, const void *bytes,
                                         size_t length) {
  sigset_t blocked;
  sigset_t previous;
  sigset_t pending_before;
  sigset_t pending_after;
  struct timespec no_wait;
  int sigpipe_was_pending;
  int success;
  int operation_errno;
  int restore_errno = 0;

  if (sigemptyset(&blocked) != 0 || sigaddset(&blocked, SIGPIPE) != 0 ||
      sigpending(&pending_before) != 0) {
    return 0;
  }
  sigpipe_was_pending = sigismember(&pending_before, SIGPIPE) == 1;
  if (sigprocmask(SIG_BLOCK, &blocked, &previous) != 0) return 0;
  success = write_exact(fd, bytes, length);
  operation_errno = errno;

  if (!sigpipe_was_pending && sigpending(&pending_after) == 0 &&
      sigismember(&pending_after, SIGPIPE) == 1) {
    memset(&no_wait, 0, sizeof(no_wait));
    while (sigtimedwait(&blocked, NULL, &no_wait) < 0 && errno == EINTR) {
    }
  }
  if (sigprocmask(SIG_SETMASK, &previous, NULL) != 0) {
    restore_errno = errno;
    success = 0;
  }
  errno = restore_errno != 0 ? restore_errno : operation_errno;
  return success;
}

static int create_monotonic_timer(void) {
  return timerfd_create(CLOCK_MONOTONIC, TFD_CLOEXEC | TFD_NONBLOCK);
}

static int arm_timer_once(int fd, uint64_t milliseconds) {
  struct itimerspec specification;
  if (fd < 0 || milliseconds == 0U) return 0;
  memset(&specification, 0, sizeof(specification));
  specification.it_value.tv_sec = (time_t)(milliseconds / 1000ULL);
  specification.it_value.tv_nsec =
      (long)((milliseconds % 1000ULL) * 1000000ULL);
  return timerfd_settime(fd, 0, &specification, NULL) == 0;
}

static int disarm_timer(int fd) {
  struct itimerspec specification;
  if (fd < 0) return 0;
  memset(&specification, 0, sizeof(specification));
  return timerfd_settime(fd, 0, &specification, NULL) == 0;
}

static int consume_timer_expiration(int fd) {
  uint64_t expirations = 0U;
  ssize_t count = read(fd, &expirations, sizeof(expirations));
  return count == (ssize_t)sizeof(expirations) && expirations > 0U;
}

static int sys_pidfd_open(pid_t pid) {
  return (int)syscall(SYS_pidfd_open, pid, 0U);
}

static int sys_pidfd_send_signal(int pidfd, int signal_number) {
  return (int)syscall(SYS_pidfd_send_signal, pidfd, signal_number, NULL, 0U);
}

static long sys_clone3(struct clone_args *arguments) {
  return syscall(SYS_clone3, arguments, sizeof(*arguments));
}

static int exec_identity_from_fd(int fd,
                                 iat_b3_linux_exec_identity *identity) {
  struct stat metadata;
  if (fd < 0 || identity == NULL || fstat(fd, &metadata) != 0 ||
      !S_ISREG(metadata.st_mode) || (metadata.st_mode & 0111) == 0) {
    return 0;
  }
  identity->device = (uint64_t)metadata.st_dev;
  identity->inode = (uint64_t)metadata.st_ino;
  identity->mode = (uint32_t)metadata.st_mode;
  return 1;
}

static int exec_identity_equal(const iat_b3_linux_exec_identity *left,
                               const iat_b3_linux_exec_identity *right) {
  return left != NULL && right != NULL && left->device == right->device &&
         left->inode == right->inode && left->mode == right->mode;
}

static void same_object_exec_or_exit(
    const iat_b3_linux_child_context *context) {
  iat_b3_linux_exec_identity immediately_before_exec;
  if (context == NULL ||
      !exec_identity_from_fd(context->exec_fd, &immediately_before_exec) ||
      !exec_identity_equal(&context->exec_identity,
                           &immediately_before_exec)) {
    _exit(126);
  }
  (void)syscall(SYS_execveat, context->exec_fd, "", context->config->child_argv,
                environ, AT_EMPTY_PATH);
  _exit(errno == ENOENT ? 127 : 126);
}

static int parent_guard_is_alive(int parent_guard_pidfd) {
  struct pollfd descriptor;
  int status;
  memset(&descriptor, 0, sizeof(descriptor));
  descriptor.fd = parent_guard_pidfd;
  descriptor.events = POLLIN;
  do {
    status = poll(&descriptor, 1U, 0);
  } while (status < 0 && errno == EINTR);
  return status == 0;
}

static int install_parent_death_guard(int parent_guard_pidfd) {
  if (parent_guard_pidfd < 0 || !parent_guard_is_alive(parent_guard_pidfd) ||
      prctl(PR_SET_PDEATHSIG, SIGKILL) != 0 ||
      !parent_guard_is_alive(parent_guard_pidfd)) {
    return 0;
  }
  return 1;
}

static int make_private_proc_mount(void) {
  if (mount(NULL, "/", NULL, MS_REC | MS_PRIVATE, NULL) != 0) return 0;
  if (umount2("/proc", MNT_DETACH) != 0 && errno != EINVAL &&
      errno != ENOENT) {
    return 0;
  }
  return mount("proc", "/proc", "proc",
               MS_NOSUID | MS_NODEV | MS_NOEXEC, NULL) == 0;
}

static int wait_for_start_token(int fd) {
  unsigned char token = 0U;
  return read_exact(fd, &token, sizeof(token)) &&
         token == IAT_B3_LINUX_START_TOKEN;
}

static void workload_child(iat_b3_linux_child_context *context) {
  if (dup2(context->stdout_write_fd, STDOUT_FILENO) < 0 ||
      dup2(context->stderr_write_fd, STDERR_FILENO) < 0) {
    _exit(126);
  }
  close_owned_fd(&context->stdout_write_fd);
  close_owned_fd(&context->stderr_write_fd);
  close_owned_fd(&context->ready_write_fd);
  close_owned_fd(&context->start_read_fd);
  close_owned_fd(&context->status_write_fd);
  close_owned_fd(&context->map_gate_read_fd);
  close_owned_fd(&context->parent_guard_pidfd);
  same_object_exec_or_exit(context);
}

static int commit_root_wait_status_once(
    iat_b3_linux_status_frame *status, const siginfo_t *information) {
  if (status == NULL || information == NULL ||
      status->root_status_committed != 0U) {
    return 0;
  }
  if (information->si_code == CLD_EXITED) {
    status->root_exit_code = information->si_status;
    status->root_signal = 0;
  } else if (information->si_code == CLD_KILLED ||
             information->si_code == CLD_DUMPED) {
    status->root_exit_code = -1;
    status->root_signal = information->si_status;
  } else {
    return 0;
  }
  status->root_status_committed = 1U;
  return 1;
}

static int reap_pid_namespace_to_echild(
    pid_t root_namespace_pid, iat_b3_linux_status_frame *status) {
  for (;;) {
    siginfo_t information;
    memset(&information, 0, sizeof(information));
    if (waitid(P_ALL, 0, &information, WEXITED | __WALL) == 0) {
      if (information.si_pid == 0) continue;
      if (information.si_pid == root_namespace_pid) {
        if (!commit_root_wait_status_once(status, &information)) return 0;
      } else {
        status->descendants_reaped += 1U;
      }
      continue;
    }
    if (errno == EINTR) continue;
    if (errno != ECHILD) return 0;
    status->complete_reap = status->root_status_committed;
    return status->complete_reap != 0U;
  }
}

static void namespace_pid1(iat_b3_linux_child_context *context) {
  unsigned char map_token = 0U;
  iat_b3_linux_ready_frame ready;
  iat_b3_linux_started_frame started;
  iat_b3_linux_status_frame status;
  iat_b3_linux_exec_identity ready_exec_identity;
  struct clone_args workload_arguments;
  int workload_pidfd = -1;
  long clone_result;
  pid_t root_namespace_pid;

  close_pid1_unused_parent_endpoints_and_timers(context);
  if (getpid() != 1 ||
      !install_parent_death_guard(context->parent_guard_pidfd) ||
      !read_exact(context->map_gate_read_fd, &map_token, sizeof(map_token)) ||
      map_token != IAT_B3_LINUX_MAP_TOKEN) {
    _exit(125);
  }
  close_owned_fd(&context->map_gate_read_fd);
  if (!make_private_proc_mount() ||
      !exec_identity_from_fd(context->exec_fd, &ready_exec_identity) ||
      !exec_identity_equal(&context->exec_identity, &ready_exec_identity)) {
    _exit(125);
  }

  memset(&ready, 0, sizeof(ready));
  ready.magic = IAT_B3_LINUX_READY_MAGIC;
  ready.version = IAT_B3_LINUX_CONTROL_VERSION;
  ready.namespace_pid = (uint32_t)getpid();
  ready.parent_death_signal = (uint32_t)SIGKILL;
  ready.exec_device = ready_exec_identity.device;
  ready.exec_inode = ready_exec_identity.inode;
  ready.exec_mode = ready_exec_identity.mode;
  ready.proc_private = 1U;
  if (!write_control_without_sigpipe(context->ready_write_fd, &ready,
                                     sizeof(ready)) ||
      !wait_for_start_token(context->start_read_fd) ||
      !parent_guard_is_alive(context->parent_guard_pidfd)) {
    _exit(125);
  }
  close_owned_fd(&context->start_read_fd);

  memset(&workload_arguments, 0, sizeof(workload_arguments));
  workload_arguments.flags = CLONE_PIDFD;
  workload_arguments.pidfd = (uint64_t)(uintptr_t)&workload_pidfd;
  workload_arguments.exit_signal = SIGCHLD;
  clone_result = sys_clone3(&workload_arguments);
  if (clone_result < 0) _exit(125);
  if (clone_result == 0) workload_child(context);
  root_namespace_pid = (pid_t)clone_result;

  close_owned_fd(&context->stdout_write_fd);
  close_owned_fd(&context->stderr_write_fd);
  memset(&started, 0, sizeof(started));
  started.magic = IAT_B3_LINUX_STARTED_MAGIC;
  started.version = IAT_B3_LINUX_CONTROL_VERSION;
  started.root_namespace_pid = (uint32_t)root_namespace_pid;
  if (!write_control_without_sigpipe(context->ready_write_fd, &started,
                                     sizeof(started))) {
    if (sys_pidfd_send_signal(workload_pidfd, SIGKILL) != 0 &&
        errno != ESRCH) {
      _exit(124);
    }
    _exit(125);
  }
  close_owned_fd(&context->ready_write_fd);
  close_owned_fd(&workload_pidfd);

  memset(&status, 0, sizeof(status));
  status.magic = IAT_B3_LINUX_STATUS_MAGIC;
  status.version = IAT_B3_LINUX_CONTROL_VERSION;
  status.root_exit_code = -1;
  if (!reap_pid_namespace_to_echild(root_namespace_pid, &status) ||
      !write_control_without_sigpipe(context->status_write_fd, &status,
                                     sizeof(status))) {
    _exit(125);
  }
  close_owned_fd(&context->status_write_fd);
  _exit(0);
}

static int namespace_pid1_not_terminal(int namespace_pidfd);

static int write_text_at(int directory_fd, const char *name,
                         const char *text) {
  size_t length = strlen(text);
  int fd = openat(directory_fd, name,
                  O_WRONLY | O_CLOEXEC | O_NOFOLLOW);
  int success;
  if (fd < 0) return 0;
  success = write_exact(fd, text, length);
  if (close(fd) != 0) success = 0;
  return success;
}

static int configure_user_namespace(pid_t namespace_outer_pid,
                                    int namespace_pidfd) {
  char proc_pid_path[64];
  char mapping[96];
  uid_t uid = getuid();
  gid_t gid = getgid();
  int proc_pid_fd = -1;
  int count;
  int success = 0;

  if (!namespace_pid1_not_terminal(namespace_pidfd)) return 0;
  count = snprintf(proc_pid_path, sizeof(proc_pid_path), "/proc/%ld",
                   (long)namespace_outer_pid);
  if (count <= 0 || (size_t)count >= sizeof(proc_pid_path)) return 0;
  proc_pid_fd = open(proc_pid_path,
                     O_PATH | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (proc_pid_fd < 0 ||
      !namespace_pid1_not_terminal(namespace_pidfd)) {
    goto done;
  }
  if (!write_text_at(proc_pid_fd, "setgroups", "deny\n") &&
      errno != ENOENT) {
    goto done;
  }
  if (!namespace_pid1_not_terminal(namespace_pidfd)) goto done;
  count = snprintf(mapping, sizeof(mapping), "0 %lu 1\n", (unsigned long)uid);
  if (count <= 0 || (size_t)count >= sizeof(mapping) ||
      !write_text_at(proc_pid_fd, "uid_map", mapping) ||
      !namespace_pid1_not_terminal(namespace_pidfd)) {
    goto done;
  }
  count = snprintf(mapping, sizeof(mapping), "0 %lu 1\n", (unsigned long)gid);
  if (count <= 0 || (size_t)count >= sizeof(mapping) ||
      !write_text_at(proc_pid_fd, "gid_map", mapping) ||
      !namespace_pid1_not_terminal(namespace_pidfd)) {
    goto done;
  }
  success = 1;

done:
  close_owned_fd(&proc_pid_fd);
  return success;
}

static int validate_ready_frame(
    const iat_b3_linux_ready_frame *ready,
    const iat_b3_linux_exec_identity *expected_exec_identity) {
  iat_b3_linux_exec_identity reported;
  if (ready == NULL || expected_exec_identity == NULL) return 0;
  reported.device = ready->exec_device;
  reported.inode = ready->exec_inode;
  reported.mode = ready->exec_mode;
  return ready->magic == IAT_B3_LINUX_READY_MAGIC &&
         ready->version == IAT_B3_LINUX_CONTROL_VERSION &&
         ready->namespace_pid == 1U &&
         ready->parent_death_signal == (uint32_t)SIGKILL &&
         ready->proc_private == 1U &&
         exec_identity_equal(&reported, expected_exec_identity);
}

static int namespace_pid1_terminal_state(int namespace_pidfd, int *terminal) {
  siginfo_t information;
  int status;
  if (terminal == NULL) return 0;
  memset(&information, 0, sizeof(information));
  do {
    status = waitid(P_PIDFD, (id_t)namespace_pidfd, &information,
                    WEXITED | WNOHANG | WNOWAIT);
  } while (status != 0 && errno == EINTR);
  if (status != 0) return 0;
  *terminal = information.si_pid != 0;
  return 1;
}

static int namespace_pid1_not_terminal(int namespace_pidfd) {
  int terminal = 0;
  return namespace_pid1_terminal_state(namespace_pidfd, &terminal) &&
         !terminal;
}

static int wait_for_control_bytes(iat_b3_linux_supervisor *supervisor,
                                  void *bytes, size_t length,
                                  int startup_phase) {
  unsigned char *cursor = (unsigned char *)bytes;
  size_t received = 0U;
  while (received < length) {
    struct pollfd descriptors[3];
    int status;
    memset(descriptors, 0, sizeof(descriptors));
    descriptors[0].fd = supervisor->ready_read_fd;
    descriptors[0].events = POLLIN | POLLHUP;
    descriptors[1].fd = startup_phase ? supervisor->startup_watchdog_fd
                                      : supervisor->execution_deadline_fd;
    descriptors[1].events = POLLIN;
    descriptors[2].fd = supervisor->immutable_outer_watchdog_fd;
    descriptors[2].events = POLLIN;
    do {
      status = poll(descriptors, 3U, -1);
    } while (status < 0 && errno == EINTR);
    if (status <= 0) return 0;
    if ((descriptors[1].revents & POLLIN) != 0) {
      if (startup_phase) {
        supervisor->result->startup_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
      } else {
        supervisor->result->execution_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_TIMEOUT);
      }
      (void)consume_timer_expiration(descriptors[1].fd);
      return 0;
    }
    if ((descriptors[2].revents & POLLIN) != 0) {
      (void)consume_timer_expiration(descriptors[2].fd);
      freeze_failure_outcome_once(supervisor,
                                  IAT_B3_OUTCOME_INTERNAL_HOLD);
      return 0;
    }
    if ((descriptors[0].revents & (POLLIN | POLLHUP)) != 0) {
      ssize_t count = read(supervisor->ready_read_fd, cursor + received,
                           length - received);
      if (count < 0 && (errno == EINTR || errno == EAGAIN)) continue;
      if (count <= 0) return 0;
      received += (size_t)count;
    }
  }
  return 1;
}

static int append_stdout_transcript(iat_b3_linux_supervisor *supervisor,
                                    const unsigned char *bytes,
                                    size_t length) {
  if (length > supervisor->stdout_transcript_capacity -
                   supervisor->stdout_transcript_length) {
    return 0;
  }
  memcpy(supervisor->stdout_transcript + supervisor->stdout_transcript_length,
         bytes, length);
  supervisor->stdout_transcript_length += length;
  return 1;
}

static iat_b3_linux_drain_result observe_one_bounded_stream_chunk(
    iat_b3_linux_supervisor *supervisor, int *fd,
    iat_b3_stream_observation *observation, uint64_t cap_bytes,
    int capture_stdout, int *closed) {
  unsigned char buffer[IAT_B3_LINUX_IO_CHUNK];
  uint64_t remaining_plus_one;
  size_t read_limit;
  ssize_t count;

  if (observation->bytes_observed > cap_bytes) {
    return IAT_B3_LINUX_DRAIN_CAP_EXCEEDED;
  }
  remaining_plus_one = cap_bytes - observation->bytes_observed + 1U;
  read_limit = remaining_plus_one < sizeof(buffer)
                   ? (size_t)remaining_plus_one
                   : sizeof(buffer);
  count = read(*fd, buffer, read_limit);
  if (count > 0) {
    iat_b3_stream_update(observation, buffer, (size_t)count, cap_bytes);
    if (capture_stdout &&
        !append_stdout_transcript(supervisor, buffer, (size_t)count)) {
      observation->cap_exceeded = 1;
    }
    return observation->cap_exceeded
               ? IAT_B3_LINUX_DRAIN_CAP_EXCEEDED
               : IAT_B3_LINUX_DRAIN_PROGRESS;
  }
  if (count < 0 && (errno == EINTR || errno == EAGAIN))
    return IAT_B3_LINUX_DRAIN_PROGRESS;
  if (count < 0) return IAT_B3_LINUX_DRAIN_ERROR;
  *closed = 1;
  close_owned_fd(fd);
  return IAT_B3_LINUX_DRAIN_CLOSED;
}

static int commit_status_frame_once(iat_b3_linux_supervisor *supervisor,
                                    const iat_b3_linux_status_frame *status) {
  if (supervisor->status_committed || !supervisor->status_eof_confirmed ||
      supervisor->status_trailing_observed || status == NULL ||
      supervisor->status_frame_length != sizeof(*status) ||
      status->magic != IAT_B3_LINUX_STATUS_MAGIC ||
      status->version != IAT_B3_LINUX_CONTROL_VERSION ||
      status->root_status_committed != 1U || status->complete_reap != 1U ||
      status->root_exit_code < -1 || status->root_signal < 0 ||
      status->root_signal > 255 ||
      (status->root_exit_code >= 0 && status->root_signal != 0) ||
      (status->root_exit_code == -1 && status->root_signal == 0)) {
    return 0;
  }
  supervisor->result->root_exit_code = status->root_exit_code;
  supervisor->result->root_signal = status->root_signal;
  supervisor->result->root_terminal_observed = 1;
  supervisor->result->zombie_descendant_count = 0U;
  supervisor->result->protocol_validated = 1;
  supervisor->status_committed = 1;
  return 1;
}

static iat_b3_linux_status_observation observe_one_status_pipe_chunk(
    iat_b3_linux_supervisor *supervisor) {
  iat_b3_linux_status_frame status;
  size_t remaining;
  ssize_t count;

  if (supervisor->status_read_fd < 0 || supervisor->status_eof_confirmed ||
      supervisor->status_committed ||
      supervisor->status_frame_length >=
          sizeof(supervisor->status_frame_bytes)) {
    return IAT_B3_LINUX_STATUS_INVALID;
  }
  remaining = sizeof(supervisor->status_frame_bytes) -
              supervisor->status_frame_length;
  count = read(supervisor->status_read_fd,
               supervisor->status_frame_bytes +
                   supervisor->status_frame_length,
               remaining);
  if (count > 0) {
    supervisor->status_frame_length += (size_t)count;
    if (supervisor->status_frame_length > sizeof(status)) {
      supervisor->status_trailing_observed = 1;
      close_owned_fd(&supervisor->status_read_fd);
      return IAT_B3_LINUX_STATUS_INVALID;
    }
    return IAT_B3_LINUX_STATUS_PROGRESS;
  }
  if (count < 0 && (errno == EINTR || errno == EAGAIN))
    return IAT_B3_LINUX_STATUS_PROGRESS;
  if (count < 0) {
    close_owned_fd(&supervisor->status_read_fd);
    return IAT_B3_LINUX_STATUS_INVALID;
  }

  supervisor->status_eof_confirmed = 1;
  close_owned_fd(&supervisor->status_read_fd);
  if (supervisor->status_trailing_observed ||
      supervisor->status_frame_length != sizeof(status)) {
    return IAT_B3_LINUX_STATUS_INVALID;
  }
  memcpy(&status, supervisor->status_frame_bytes, sizeof(status));
  return commit_status_frame_once(supervisor, &status)
             ? IAT_B3_LINUX_STATUS_COMMITTED
             : IAT_B3_LINUX_STATUS_INVALID;
}

static int reap_namespace_pid1_by_pidfd(
    iat_b3_linux_supervisor *supervisor) {
  siginfo_t information;
  memset(&information, 0, sizeof(information));
  if (waitid(P_PIDFD, (id_t)supervisor->namespace_pidfd, &information,
             WEXITED | WNOHANG) != 0) {
    return errno == EINTR;
  }
  if (information.si_pid == 0) return 1;
  supervisor->namespace_terminal = 1;
  supervisor->result->direct_child_reaped = 1;
  if (information.si_code == CLD_EXITED && information.si_status == 0) {
    supervisor->namespace_pid1_exit_validated = 1;
  } else {
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
  }
  close_owned_fd(&supervisor->namespace_pidfd);
  return 1;
}

static int establish_teardown_observation_bound(
    iat_b3_linux_supervisor *supervisor) {
  uint64_t now;
  if (supervisor->teardown_bound_armed) return 1;
  now = iat_b3_monotonic_ms();
  supervisor->teardown_deadline_at_ms =
      now > UINT64_MAX -
                supervisor->immutable_teardown_observation_deadline_ms
          ? UINT64_MAX
          : now + supervisor->immutable_teardown_observation_deadline_ms;
  supervisor->teardown_bound_armed = 1;
  supervisor->teardown_timer_armed = arm_timer_once(
      supervisor->teardown_observation_deadline_fd,
      supervisor->immutable_teardown_observation_deadline_ms);
  if (!supervisor->teardown_timer_armed) {
    supervisor->teardown_timer_arm_failed = 1;
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    close_owned_fd(&supervisor->teardown_observation_deadline_fd);
  }
  return 1;
}

static int begin_forced_teardown(iat_b3_linux_supervisor *supervisor) {
  int target_terminal = 0;
  if (!establish_teardown_observation_bound(supervisor)) return 0;
  if (supervisor->forced_teardown_started) return 1;
  if (supervisor->teardown_signal_attempted) return 0;
  supervisor->teardown_signal_attempted = 1;
  supervisor->result->intervention_used = 1;
  if (sys_pidfd_send_signal(supervisor->namespace_pidfd, SIGKILL) == 0) {
    supervisor->teardown_signal_delivered = 1;
  } else if (errno == ESRCH &&
             namespace_pid1_terminal_state(supervisor->namespace_pidfd,
                                           &target_terminal) &&
             target_terminal) {
    supervisor->teardown_target_already_terminal = 1;
  } else {
    return 0;
  }
  supervisor->forced_teardown_started =
      supervisor->teardown_bound_armed &&
      (supervisor->teardown_signal_delivered ||
       supervisor->teardown_target_already_terminal);
  return supervisor->forced_teardown_started;
}

static int require_bounded_forced_teardown(
    iat_b3_linux_supervisor *supervisor) {
  if (begin_forced_teardown(supervisor)) return 1;
  freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
  return supervisor->teardown_bound_armed;
}

static int containment_absence_can_be_committed(
    const iat_b3_linux_supervisor *supervisor) {
  return supervisor->namespace_terminal &&
         supervisor->result->direct_child_reaped && supervisor->stdout_closed &&
         supervisor->stderr_closed;
}

static int observation_arbitration_complete(
    const iat_b3_linux_supervisor *supervisor) {
  return containment_absence_can_be_committed(supervisor) &&
         supervisor->status_read_fd < 0;
}

static void observe_until_terminal(iat_b3_linux_supervisor *supervisor) {
  int finalization_armed = 0;
  while (!observation_arbitration_complete(supervisor)) {
    struct pollfd descriptors[8];
    nfds_t count = 0U;
    int status;
    int poll_timeout_ms = -1;
    memset(descriptors, 0, sizeof(descriptors));
#define ADD_POLL_DESCRIPTOR(value, mask)       \
  do {                                          \
    if ((value) >= 0) {                         \
      descriptors[count].fd = (value);          \
      descriptors[count].events = (mask);       \
      count += 1U;                              \
    }                                           \
  } while (0)
    ADD_POLL_DESCRIPTOR(supervisor->teardown_observation_deadline_fd, POLLIN);
    ADD_POLL_DESCRIPTOR(supervisor->immutable_outer_watchdog_fd, POLLIN);
    ADD_POLL_DESCRIPTOR(supervisor->execution_deadline_fd, POLLIN);
    ADD_POLL_DESCRIPTOR(supervisor->finalization_deadline_fd, POLLIN);
    ADD_POLL_DESCRIPTOR(supervisor->namespace_pidfd, POLLIN);
    ADD_POLL_DESCRIPTOR(supervisor->status_read_fd, POLLIN | POLLHUP);
    ADD_POLL_DESCRIPTOR(supervisor->stdout_read_fd, POLLIN | POLLHUP);
    ADD_POLL_DESCRIPTOR(supervisor->stderr_read_fd, POLLIN | POLLHUP);
#undef ADD_POLL_DESCRIPTOR
    if (supervisor->teardown_bound_armed) {
      uint64_t now = iat_b3_monotonic_ms();
      uint64_t remaining;
      if (now >= supervisor->teardown_deadline_at_ms) {
        supervisor->result->teardown_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
        return;
      }
      remaining = supervisor->teardown_deadline_at_ms - now;
      poll_timeout_ms =
          remaining > (uint64_t)INT_MAX ? INT_MAX : (int)remaining;
      if (poll_timeout_ms == 0) poll_timeout_ms = 1;
    }
    status = poll(descriptors, count, poll_timeout_ms);
    if (status < 0 && errno == EINTR) continue;
    if (status == 0 && supervisor->teardown_bound_armed) {
      supervisor->result->teardown_deadline_expired = 1;
      freeze_failure_outcome_once(supervisor,
                                  IAT_B3_OUTCOME_INTERNAL_HOLD);
      return;
    }
    if (status <= 0) {
      if (!require_bounded_forced_teardown(supervisor)) return;
      continue;
    }
    for (nfds_t index = 0U; index < count; ++index) {
      if (descriptors[index].revents == 0) continue;
      if (descriptors[index].fd ==
          supervisor->teardown_observation_deadline_fd) {
        (void)consume_timer_expiration(
            supervisor->teardown_observation_deadline_fd);
        supervisor->result->teardown_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
        /* Observation-only: expiry never authorizes a second signal. */
        return;
      } else if (descriptors[index].fd ==
                 supervisor->immutable_outer_watchdog_fd) {
        (void)consume_timer_expiration(
            supervisor->immutable_outer_watchdog_fd);
        freeze_failure_outcome_once(supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
        close_owned_fd(&supervisor->immutable_outer_watchdog_fd);
        if (!require_bounded_forced_teardown(supervisor))
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_INTERNAL_HOLD);
      } else if (descriptors[index].fd ==
                 supervisor->execution_deadline_fd) {
        (void)consume_timer_expiration(supervisor->execution_deadline_fd);
        supervisor->result->execution_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_TIMEOUT);
        if (!require_bounded_forced_teardown(supervisor)) return;
      } else if (descriptors[index].fd ==
                 supervisor->finalization_deadline_fd) {
        (void)consume_timer_expiration(supervisor->finalization_deadline_fd);
        supervisor->result->finalization_deadline_expired = 1;
        freeze_failure_outcome_once(supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
        if (!require_bounded_forced_teardown(supervisor)) return;
      } else if (descriptors[index].fd == supervisor->namespace_pidfd) {
        if (!reap_namespace_pid1_by_pidfd(supervisor)) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_INTERNAL_HOLD);
          if (!require_bounded_forced_teardown(supervisor)) return;
        }
      } else if (descriptors[index].fd == supervisor->status_read_fd) {
        iat_b3_linux_status_observation status_observation =
            observe_one_status_pipe_chunk(supervisor);
        if (status_observation == IAT_B3_LINUX_STATUS_INVALID) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_INTERNAL_HOLD);
          if (!require_bounded_forced_teardown(supervisor)) return;
        } else if (status_observation == IAT_B3_LINUX_STATUS_COMMITTED &&
                   !finalization_armed &&
                   !supervisor->failure_outcome_committed) {
          if (!disarm_timer(supervisor->execution_deadline_fd)) {
            freeze_failure_outcome_once(supervisor,
                                        IAT_B3_OUTCOME_INTERNAL_HOLD);
            if (!require_bounded_forced_teardown(supervisor)) return;
            continue;
          }
          finalization_armed =
              arm_timer_once(supervisor->finalization_deadline_fd,
                             supervisor->config->finalization_deadline_ms);
          if (!finalization_armed) {
            freeze_failure_outcome_once(supervisor,
                                        IAT_B3_OUTCOME_INTERNAL_HOLD);
            if (!require_bounded_forced_teardown(supervisor)) return;
          }
        }
      } else if (descriptors[index].fd == supervisor->stdout_read_fd) {
        iat_b3_linux_drain_result drain =
            observe_one_bounded_stream_chunk(
                supervisor, &supervisor->stdout_read_fd,
                &supervisor->result->stdout_observation,
                supervisor->config->stdout_cap_bytes, 1,
                &supervisor->stdout_closed);
        if (drain == IAT_B3_LINUX_DRAIN_ERROR) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_INTERNAL_HOLD);
          if (!require_bounded_forced_teardown(supervisor)) return;
        } else if (drain == IAT_B3_LINUX_DRAIN_CAP_EXCEEDED) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_OUTPUT_LIMIT);
          if (!require_bounded_forced_teardown(supervisor)) return;
        }
      } else if (descriptors[index].fd == supervisor->stderr_read_fd) {
        iat_b3_linux_drain_result drain =
            observe_one_bounded_stream_chunk(
                supervisor, &supervisor->stderr_read_fd,
                &supervisor->result->stderr_observation,
                supervisor->config->stderr_cap_bytes, 0,
                &supervisor->stderr_closed);
        if (drain == IAT_B3_LINUX_DRAIN_ERROR) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_INTERNAL_HOLD);
          if (!require_bounded_forced_teardown(supervisor)) return;
        } else if (drain == IAT_B3_LINUX_DRAIN_CAP_EXCEEDED) {
          freeze_failure_outcome_once(supervisor,
                                      IAT_B3_OUTCOME_OUTPUT_LIMIT);
          if (!require_bounded_forced_teardown(supervisor)) return;
        }
      }
    }
  }
  if (containment_absence_can_be_committed(supervisor)) {
    supervisor->result->containment_empty = 1;
    supervisor->result->absence_proof_observed = 1;
  }
}

static void close_supervisor(iat_b3_linux_supervisor *supervisor) {
  close_owned_fd(&supervisor->exec_fd);
  close_owned_fd(&supervisor->parent_guard_pidfd);
  close_owned_fd(&supervisor->namespace_pidfd);
  close_owned_fd(&supervisor->map_gate_write_fd);
  close_owned_fd(&supervisor->ready_read_fd);
  close_owned_fd(&supervisor->start_write_fd);
  close_owned_fd(&supervisor->status_read_fd);
  close_owned_fd(&supervisor->stdout_read_fd);
  close_owned_fd(&supervisor->stderr_read_fd);
  close_owned_fd(&supervisor->startup_watchdog_fd);
  close_owned_fd(&supervisor->immutable_outer_watchdog_fd);
  close_owned_fd(&supervisor->execution_deadline_fd);
  close_owned_fd(&supervisor->finalization_deadline_fd);
  close_owned_fd(&supervisor->teardown_observation_deadline_fd);
  free(supervisor->stdout_transcript);
  supervisor->stdout_transcript = NULL;
}

static void initialize_supervisor(iat_b3_linux_supervisor *supervisor,
                                  const iat_b3_config *config,
                                  iat_b3_result *result) {
  memset(supervisor, 0, sizeof(*supervisor));
  supervisor->config = config;
  supervisor->result = result;
  supervisor->immutable_execution_deadline_ms = config->execution_deadline_ms;
  supervisor->immutable_teardown_observation_deadline_ms =
      config->teardown_observation_deadline_ms;
  supervisor->exec_fd = -1;
  supervisor->parent_guard_pidfd = -1;
  supervisor->namespace_pidfd = -1;
  supervisor->map_gate_write_fd = -1;
  supervisor->ready_read_fd = -1;
  supervisor->start_write_fd = -1;
  supervisor->status_read_fd = -1;
  supervisor->stdout_read_fd = -1;
  supervisor->stderr_read_fd = -1;
  supervisor->startup_watchdog_fd = -1;
  supervisor->immutable_outer_watchdog_fd = -1;
  supervisor->execution_deadline_fd = -1;
  supervisor->finalization_deadline_fd = -1;
  supervisor->teardown_observation_deadline_fd = -1;
}

int iat_b3_platform_run(const iat_b3_config *config, iat_b3_result *result) {
  iat_b3_linux_supervisor supervisor;
  iat_b3_linux_child_context child_context;
  iat_b3_linux_exec_identity exec_identity;
  iat_b3_linux_ready_frame ready;
  iat_b3_linux_started_frame started;
  struct clone_args namespace_arguments;
  int map_gate[2] = {-1, -1};
  int ready_pipe[2] = {-1, -1};
  int start_pipe[2] = {-1, -1};
  int status_pipe[2] = {-1, -1};
  int stdout_pipe[2] = {-1, -1};
  int stderr_pipe[2] = {-1, -1};
  uint64_t immutable_outer_deadline_ms;
  unsigned char map_token = IAT_B3_LINUX_MAP_TOKEN;
  unsigned char start_token = IAT_B3_LINUX_START_TOKEN;
  const char *tap_error = NULL;
  long clone_result;
  int return_status = -1;

  if (config == NULL || result == NULL || !iat_b3_validate_config(config)) {
    return -1;
  }
  result->outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD;
  result->root_exit_code = -1;
  initialize_supervisor(&supervisor, config, result);
  initialize_child_context(&child_context);
  supervisor.started_at_ms = iat_b3_monotonic_ms();
  immutable_outer_deadline_ms =
      config->execution_deadline_ms ==
              IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS
          ? IAT_B3_ALL_FEATURE_OUTER_DEADLINE_MS
          : IAT_B3_DEFAULT_OUTER_DEADLINE_MS;

  supervisor.exec_fd = open(config->child_argv[0], O_PATH | O_CLOEXEC);
  supervisor.parent_guard_pidfd = sys_pidfd_open(getpid());
  supervisor.stdout_transcript_capacity = (size_t)config->stdout_cap_bytes + 1U;
  supervisor.stdout_transcript =
      (unsigned char *)malloc(supervisor.stdout_transcript_capacity);
  if (supervisor.exec_fd < 0 || supervisor.parent_guard_pidfd < 0 ||
      supervisor.stdout_transcript == NULL ||
      !exec_identity_from_fd(supervisor.exec_fd, &exec_identity) ||
      !make_cloexec_pipe(map_gate) || !make_cloexec_pipe(ready_pipe) ||
      !make_cloexec_pipe(start_pipe) || !make_cloexec_pipe(status_pipe) ||
      !make_cloexec_pipe(stdout_pipe) || !make_cloexec_pipe(stderr_pipe)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }

  supervisor.map_gate_write_fd = map_gate[1];
  map_gate[1] = -1;
  supervisor.ready_read_fd = ready_pipe[0];
  ready_pipe[0] = -1;
  supervisor.start_write_fd = start_pipe[1];
  start_pipe[1] = -1;
  supervisor.status_read_fd = status_pipe[0];
  status_pipe[0] = -1;
  supervisor.stdout_read_fd = stdout_pipe[0];
  stdout_pipe[0] = -1;
  supervisor.stderr_read_fd = stderr_pipe[0];
  stderr_pipe[0] = -1;
  supervisor.startup_watchdog_fd = create_monotonic_timer();
  supervisor.immutable_outer_watchdog_fd = create_monotonic_timer();
  supervisor.execution_deadline_fd = create_monotonic_timer();
  supervisor.finalization_deadline_fd = create_monotonic_timer();
  supervisor.teardown_observation_deadline_fd = create_monotonic_timer();
  if (supervisor.startup_watchdog_fd < 0 ||
      supervisor.immutable_outer_watchdog_fd < 0 ||
      supervisor.execution_deadline_fd < 0 ||
      supervisor.finalization_deadline_fd < 0 ||
      supervisor.teardown_observation_deadline_fd < 0 ||
      !arm_timer_once(supervisor.startup_watchdog_fd,
                      config->startup_deadline_ms) ||
      !arm_timer_once(supervisor.immutable_outer_watchdog_fd,
                      immutable_outer_deadline_ms)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }
  supervisor.watchdogs_armed_before_clone3 = 1;

  child_context.config = config;
  child_context.exec_identity = exec_identity;
  child_context.exec_fd = supervisor.exec_fd;
  child_context.parent_guard_pidfd = supervisor.parent_guard_pidfd;
  child_context.map_gate_read_fd = map_gate[0];
  map_gate[0] = -1;
  child_context.ready_write_fd = ready_pipe[1];
  ready_pipe[1] = -1;
  child_context.start_read_fd = start_pipe[0];
  start_pipe[0] = -1;
  child_context.status_write_fd = status_pipe[1];
  status_pipe[1] = -1;
  child_context.stdout_write_fd = stdout_pipe[1];
  stdout_pipe[1] = -1;
  child_context.stderr_write_fd = stderr_pipe[1];
  stderr_pipe[1] = -1;
  child_context.parent_map_gate_write_fd = supervisor.map_gate_write_fd;
  child_context.parent_ready_read_fd = supervisor.ready_read_fd;
  child_context.parent_start_write_fd = supervisor.start_write_fd;
  child_context.parent_status_read_fd = supervisor.status_read_fd;
  child_context.parent_stdout_read_fd = supervisor.stdout_read_fd;
  child_context.parent_stderr_read_fd = supervisor.stderr_read_fd;
  child_context.inherited_startup_watchdog_fd =
      supervisor.startup_watchdog_fd;
  child_context.inherited_outer_watchdog_fd =
      supervisor.immutable_outer_watchdog_fd;
  child_context.inherited_execution_deadline_fd =
      supervisor.execution_deadline_fd;
  child_context.inherited_finalization_deadline_fd =
      supervisor.finalization_deadline_fd;
  child_context.inherited_teardown_deadline_fd =
      supervisor.teardown_observation_deadline_fd;

  memset(&namespace_arguments, 0, sizeof(namespace_arguments));
  namespace_arguments.flags =
      CLONE_NEWUSER | CLONE_NEWPID | CLONE_NEWNS | CLONE_PIDFD;
  namespace_arguments.pidfd = (uint64_t)(uintptr_t)&supervisor.namespace_pidfd;
  namespace_arguments.exit_signal = SIGCHLD;
  if (!supervisor.watchdogs_armed_before_clone3) goto cleanup;
  clone_result = sys_clone3(&namespace_arguments);
  if (clone_result < 0) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }
  if (clone_result == 0) namespace_pid1(&child_context);
  supervisor.namespace_outer_pid = (pid_t)clone_result;

  close_parent_copy_of_child_endpoints(&child_context);
  if (!make_nonblocking(supervisor.status_read_fd) ||
      !make_nonblocking(supervisor.stdout_read_fd) ||
      !make_nonblocking(supervisor.stderr_read_fd) ||
      !configure_user_namespace(supervisor.namespace_outer_pid,
                                supervisor.namespace_pidfd) ||
      !write_control_without_sigpipe(supervisor.map_gate_write_fd, &map_token,
                                     sizeof(map_token))) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    if (require_bounded_forced_teardown(&supervisor))
      observe_until_terminal(&supervisor);
    goto finish;
  }
  close_owned_fd(&supervisor.map_gate_write_fd);

  memset(&ready, 0, sizeof(ready));
  if (!wait_for_control_bytes(&supervisor, &ready, sizeof(ready), 1) ||
      !validate_ready_frame(&ready, &exec_identity) ||
      !namespace_pid1_not_terminal(supervisor.namespace_pidfd) ||
      !disarm_timer(supervisor.startup_watchdog_fd) ||
      !arm_timer_once(supervisor.execution_deadline_fd,
                      supervisor.immutable_execution_deadline_ms) ||
      !write_control_without_sigpipe(supervisor.start_write_fd, &start_token,
                                     sizeof(start_token))) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    if (require_bounded_forced_teardown(&supervisor))
      observe_until_terminal(&supervisor);
    goto finish;
  }
  close_owned_fd(&supervisor.start_write_fd);

  memset(&started, 0, sizeof(started));
  if (!wait_for_control_bytes(&supervisor, &started, sizeof(started), 0) ||
      started.magic != IAT_B3_LINUX_STARTED_MAGIC ||
      started.version != IAT_B3_LINUX_CONTROL_VERSION ||
      started.root_namespace_pid <= 1U) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    if (require_bounded_forced_teardown(&supervisor))
      observe_until_terminal(&supervisor);
    goto finish;
  }
  result->workload_resumed = 1;
  close_owned_fd(&supervisor.ready_read_fd);

  observe_until_terminal(&supervisor);

finish:
  if (!supervisor.failure_outcome_committed &&
      supervisor.namespace_pid1_exit_validated &&
      result->root_terminal_observed && result->containment_empty &&
      result->absence_proof_observed && !result->intervention_used &&
      !result->stdout_observation.cap_exceeded &&
      !result->stderr_observation.cap_exceeded) {
    result->strict_tap_validated = iat_b3_validate_tap_transcript(
        supervisor.stdout_transcript, supervisor.stdout_transcript_length,
        &tap_error);
    if (result->root_signal > 0)
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SIGNAL);
    else if (result->root_exit_code > 0)
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_NONZERO);
    else if (!result->strict_tap_validated)
      freeze_failure_outcome_once(&supervisor,
                                  IAT_B3_OUTCOME_INCOMPLETE_TAP);
    else if (!supervisor.failure_outcome_committed)
      result->outcome = IAT_B3_OUTCOME_PASS;
  }
  result->elapsed_ms = iat_b3_monotonic_ms() - supervisor.started_at_ms;
  return_status = result->outcome == IAT_B3_OUTCOME_PASS ? 0 : -1;

cleanup:
  close_parent_copy_of_child_endpoints(&child_context);
  close_owned_fd(&map_gate[0]);
  close_owned_fd(&map_gate[1]);
  close_owned_fd(&ready_pipe[0]);
  close_owned_fd(&ready_pipe[1]);
  close_owned_fd(&start_pipe[0]);
  close_owned_fd(&start_pipe[1]);
  close_owned_fd(&status_pipe[0]);
  close_owned_fd(&status_pipe[1]);
  close_owned_fd(&stdout_pipe[0]);
  close_owned_fd(&stdout_pipe[1]);
  close_owned_fd(&stderr_pipe[0]);
  close_owned_fd(&stderr_pipe[1]);
  close_supervisor(&supervisor);
  return return_status;
}

#endif
