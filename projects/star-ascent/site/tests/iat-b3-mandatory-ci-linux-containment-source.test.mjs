import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(
  SITE_ROOT,
  "native/iat-b3-mandatory-ci-containment/src/platform_linux.c",
);
const source = readFileSync(SOURCE_PATH, "utf8");

const ordered = (...needles) => {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert(next > cursor, `missing or out of order: ${needle}`);
    cursor = next;
  }
};

test("Linux execution is descriptor-bound to the same regular object", () => {
  for (const token of [
    "O_PATH | O_CLOEXEC",
    "fstat(fd, &metadata)",
    "S_ISREG(metadata.st_mode)",
    "immediately_before_exec",
    "exec_identity_equal",
    "SYS_execveat",
    "AT_EMPTY_PATH",
  ]) assert(source.includes(token), token);
  assert.equal(source.includes("/proc/self/fd/"), false);
  assert.equal(source.includes("execvp("), false);
  assert.equal(source.includes("execvpe("), false);
});

test("clone3 creates a pidfd-bound user, PID and mount namespace", () => {
  assert.match(
    source,
    /namespace_arguments\.flags =\s*\n\s*CLONE_NEWUSER \| CLONE_NEWPID \| CLONE_NEWNS \| CLONE_PIDFD;/u,
  );
  assert.match(source, /namespace_arguments\.pidfd = [^;]+supervisor\.namespace_pidfd/u);
  assert.match(source, /if \(getpid\(\) != 1/u);
  assert.match(source, /mount\(NULL, "\/", NULL, MS_REC \| MS_PRIVATE, NULL\)/u);
  assert.match(source, /mount\("proc", "\/proc", "proc",/u);
});

test("PID 1 closes the parent-death race before announcing READY", () => {
  const guard = source.slice(
    source.indexOf("static int install_parent_death_guard"),
    source.indexOf("static int make_private_proc_mount"),
  );
  assert.match(
    guard,
    /parent_guard_is_alive\(parent_guard_pidfd\)[\s\S]*prctl\(PR_SET_PDEATHSIG, SIGKILL\)[\s\S]*parent_guard_is_alive\(parent_guard_pidfd\)/u,
  );
  const pid1 = source.slice(
    source.indexOf("static void namespace_pid1"),
    source.indexOf("static int namespace_pid1_not_terminal(int namespace_pidfd);"),
  );
  assert(
    pid1.indexOf("install_parent_death_guard") <
      pid1.indexOf("write_control_without_sigpipe(context->ready_write_fd, &ready"),
  );
  assert.match(source, /sys_pidfd_open\(getpid\(\)\)/u);
});

test("watchdogs are armed before the namespace can start", () => {
  ordered(
    "arm_timer_once(supervisor.startup_watchdog_fd",
    "arm_timer_once(supervisor.immutable_outer_watchdog_fd",
    "supervisor.watchdogs_armed_before_clone3 = 1",
    "clone_result = sys_clone3(&namespace_arguments)",
  );
  assert.match(source, /if \(!supervisor\.watchdogs_armed_before_clone3\) goto cleanup;/u);
});

test("each readable stream gets one cap-aware chunk per poll turn", () => {
  const drain = source.slice(
    source.indexOf("static iat_b3_linux_drain_result observe_one_bounded_stream_chunk"),
    source.indexOf("static int commit_status_frame_once"),
  );
  assert.equal((drain.match(/\bread\(/gu) ?? []).length, 1);
  assert.doesNotMatch(drain, /for\s*\(\s*;\s*;\s*\)/u);
  assert.match(drain, /remaining_plus_one = cap_bytes - observation->bytes_observed \+ 1U;/u);
  assert.match(drain, /count = read\(\*fd, buffer, read_limit\);/u);
  assert.match(
    drain,
    /return observation->cap_exceeded\s*\n\s*\? IAT_B3_LINUX_DRAIN_CAP_EXCEEDED/u,
  );
  const observationLoop = source.slice(
    source.indexOf("static void observe_until_terminal"),
    source.indexOf("static void close_supervisor"),
  );
  assert.equal(
    (observationLoop.match(/observe_one_bounded_stream_chunk\(/gu) ?? []).length,
    2,
  );
  assert.match(observationLoop, /IAT_B3_LINUX_DRAIN_CAP_EXCEEDED[\s\S]*IAT_B3_OUTCOME_OUTPUT_LIMIT[\s\S]*require_bounded_forced_teardown/u);
  for (const watchdog of [
    "execution_deadline_fd",
    "immutable_outer_watchdog_fd",
  ]) assert(observationLoop.includes(watchdog), watchdog);
  assert.equal(source.includes("static int observe_stream"), false);
});

test("expired deadlines arbitrate before pidfd, status and streams and freeze first failure", () => {
  const observationLoop = source.slice(
    source.indexOf("static void observe_until_terminal"),
    source.indexOf("static void close_supervisor"),
  );
  const descriptorBlock = observationLoop.slice(
    observationLoop.indexOf("ADD_POLL_DESCRIPTOR(supervisor->teardown_observation_deadline_fd"),
    observationLoop.indexOf("#undef ADD_POLL_DESCRIPTOR"),
  );
  const descriptorPriority = [
    "teardown_observation_deadline_fd",
    "immutable_outer_watchdog_fd",
    "execution_deadline_fd",
    "finalization_deadline_fd",
    "namespace_pidfd",
    "status_read_fd",
    "stdout_read_fd",
    "stderr_read_fd",
  ];
  let cursor = -1;
  for (const descriptor of descriptorPriority) {
    const next = descriptorBlock.indexOf(descriptor, cursor + 1);
    assert(next > cursor, descriptor);
    cursor = next;
  }

  const arbitration = observationLoop.slice(
    observationLoop.indexOf("for (nfds_t index = 0U; index < count; ++index)"),
  );
  const branchPriority = [
    "supervisor->teardown_observation_deadline_fd) {",
    "supervisor->immutable_outer_watchdog_fd) {",
    "supervisor->execution_deadline_fd) {",
    "supervisor->finalization_deadline_fd) {",
    "descriptors[index].fd == supervisor->namespace_pidfd",
    "descriptors[index].fd == supervisor->status_read_fd",
    "descriptors[index].fd == supervisor->stdout_read_fd",
    "descriptors[index].fd == supervisor->stderr_read_fd",
  ];
  cursor = -1;
  for (const branch of branchPriority) {
    const next = arbitration.indexOf(branch, cursor + 1);
    assert(next > cursor, branch);
    cursor = next;
  }
  const beforePidfd = arbitration.slice(
    0,
    arbitration.indexOf("descriptors[index].fd == supervisor->namespace_pidfd"),
  );
  assert.equal(beforePidfd.includes("close_owned_fd(&supervisor->namespace_pidfd)"), false);

  const freeze = source.slice(
    source.indexOf("static void freeze_failure_outcome_once"),
    source.indexOf("static void initialize_child_context"),
  );
  assert.match(freeze, /supervisor->failure_outcome_committed\) \{\s*\n\s*return;/u);
  assert.match(
    freeze,
    /supervisor->frozen_failure_outcome = outcome;\s*\n\s*supervisor->failure_outcome_committed = 1;\s*\n\s*supervisor->result->outcome = outcome;/u,
  );
  assert.equal(
    (source.match(/(?:supervisor->)?result->outcome\s*=(?!=)/gu) ?? []).length,
    3,
  );
  for (const outcome of [
    "IAT_B3_OUTCOME_TIMEOUT",
    "IAT_B3_OUTCOME_OUTPUT_LIMIT",
    "IAT_B3_OUTCOME_INTERNAL_HOLD",
  ]) assert.match(
    observationLoop,
    new RegExp(`freeze_failure_outcome_once\\(supervisor,\\s*${outcome}\\)`, "u"),
    outcome,
  );
  const finish = source.slice(source.indexOf("finish:"), source.indexOf("cleanup:"));
  assert.match(finish, /if \(!supervisor\.failure_outcome_committed &&/u);
  assert.match(finish, /else if \(!supervisor\.failure_outcome_committed\)\s*\n\s*result->outcome = IAT_B3_OUTCOME_PASS;/u);
});

test("numeric proc selection is held live by pidfd and mapping uses one directory fd", () => {
  const mapping = source.slice(
    source.indexOf("static int configure_user_namespace"),
    source.indexOf("static int validate_ready_frame"),
  );
  assert.match(mapping, /configure_user_namespace\(pid_t namespace_outer_pid,\s*\n\s*int namespace_pidfd\)/u);
  assert.match(mapping, /snprintf\(proc_pid_path, sizeof\(proc_pid_path\), "\/proc\/%ld"/u);
  assert.match(mapping, /open\(proc_pid_path,\s*\n\s*O_PATH \| O_DIRECTORY \| O_CLOEXEC \| O_NOFOLLOW\)/u);
  for (const name of ["setgroups", "uid_map", "gid_map"]) {
    assert(mapping.includes(`write_text_at(proc_pid_fd, "${name}"`), name);
  }
  assert((mapping.match(/namespace_pid1_not_terminal\(namespace_pidfd\)/gu) ?? []).length >= 5);
  assert.equal(source.includes('"/proc/%ld/uid_map"'), false);
  assert.equal(source.includes('"/proc/%ld/gid_map"'), false);
  assert.match(
    source,
    /configure_user_namespace\(supervisor\.namespace_outer_pid,\s*\n\s*supervisor\.namespace_pidfd\)/u,
  );
});

test("pipe and timer descriptors have one owner on each side of clone3", () => {
  const main = source.slice(source.indexOf("int iat_b3_platform_run"));
  for (const [owner, local] of [
    ["supervisor.map_gate_write_fd", "map_gate[1]"],
    ["supervisor.ready_read_fd", "ready_pipe[0]"],
    ["supervisor.start_write_fd", "start_pipe[1]"],
    ["supervisor.status_read_fd", "status_pipe[0]"],
    ["supervisor.stdout_read_fd", "stdout_pipe[0]"],
    ["supervisor.stderr_read_fd", "stderr_pipe[0]"],
    ["child_context.map_gate_read_fd", "map_gate[0]"],
    ["child_context.ready_write_fd", "ready_pipe[1]"],
    ["child_context.start_read_fd", "start_pipe[0]"],
    ["child_context.status_write_fd", "status_pipe[1]"],
    ["child_context.stdout_write_fd", "stdout_pipe[1]"],
    ["child_context.stderr_write_fd", "stderr_pipe[1]"],
  ]) {
    assert.match(
      main,
      new RegExp(`${owner.replaceAll(".", "\\.").replaceAll("[", "\\[").replaceAll("]", "\\]")} = ${local.replaceAll("[", "\\[").replaceAll("]", "\\]")};\\s*\\n\\s*${local.replaceAll("[", "\\[").replaceAll("]", "\\]")} = -1;`, "u"),
      `${owner} transfer`,
    );
  }
  const childClose = source.slice(
    source.indexOf("static void close_pid1_unused_parent_endpoints_and_timers"),
    source.indexOf("static int make_cloexec_pipe"),
  );
  for (const field of [
    "parent_map_gate_write_fd",
    "parent_ready_read_fd",
    "parent_start_write_fd",
    "parent_status_read_fd",
    "parent_stdout_read_fd",
    "parent_stderr_read_fd",
    "inherited_startup_watchdog_fd",
    "inherited_outer_watchdog_fd",
    "inherited_execution_deadline_fd",
    "inherited_finalization_deadline_fd",
    "inherited_teardown_deadline_fd",
  ]) assert(childClose.includes(`close_owned_fd(&context->${field})`), field);
  const parentOwnership = source.slice(
    source.indexOf("static void close_parent_copy_of_child_endpoints"),
    source.indexOf("static void close_pid1_unused_parent_endpoints_and_timers"),
  );
  for (const alias of [
    "exec_fd",
    "parent_guard_pidfd",
    "parent_map_gate_write_fd",
    "parent_ready_read_fd",
    "parent_start_write_fd",
    "parent_status_read_fd",
    "parent_stdout_read_fd",
    "parent_stderr_read_fd",
    "inherited_startup_watchdog_fd",
    "inherited_outer_watchdog_fd",
    "inherited_execution_deadline_fd",
    "inherited_finalization_deadline_fd",
    "inherited_teardown_deadline_fd",
  ]) assert(parentOwnership.includes(`context->${alias} = -1;`), alias);
  const pid1 = source.slice(
    source.indexOf("static void namespace_pid1"),
    source.indexOf("static int namespace_pid1_not_terminal(int namespace_pidfd);"),
  );
  assert(pid1.indexOf("close_pid1_unused_parent_endpoints_and_timers(context)") < pid1.indexOf("getpid() != 1"));
  const postClone = main.slice(
    main.indexOf("if (clone_result == 0) namespace_pid1(&child_context)"),
    main.indexOf("if (!make_nonblocking"),
  );
  assert.match(postClone, /close_parent_copy_of_child_endpoints\(&child_context\);/u);
  assert.doesNotMatch(postClone, /close_owned_fd\(&(?:map_gate|ready_pipe|start_pipe|status_pipe|stdout_pipe|stderr_pipe)/u);
});

test("READY is an exact two-phase barrier and cannot race workload creation", () => {
  const pid1 = source.slice(
    source.indexOf("static void namespace_pid1"),
    source.indexOf("static int namespace_pid1_not_terminal(int namespace_pidfd);"),
  );
  const readyWrite = pid1.indexOf("write_control_without_sigpipe(context->ready_write_fd, &ready");
  const startRead = pid1.indexOf("wait_for_start_token");
  const workloadClone = pid1.indexOf("clone_result = sys_clone3(&workload_arguments)");
  assert(readyWrite >= 0 && startRead > readyWrite && workloadClone > startRead);
  const parent = source.slice(source.indexOf("int iat_b3_platform_run"));
  const readyValidation = parent.indexOf("validate_ready_frame(&ready, &exec_identity)");
  const terminalCheck = parent.indexOf("namespace_pid1_not_terminal(supervisor.namespace_pidfd)");
  const executionArm = parent.indexOf("arm_timer_once(supervisor.execution_deadline_fd");
  const startWrite = parent.indexOf("write_control_without_sigpipe(supervisor.start_write_fd, &start_token");
  const resumed = parent.indexOf("result->workload_resumed = 1");
  assert(readyValidation >= 0 && terminalCheck > readyValidation);
  assert(executionArm > terminalCheck);
  assert(startWrite > executionArm && resumed > startWrite);
  assert.match(source, /WEXITED \| WNOHANG \| WNOWAIT/u);
});

test("execution and observation-only teardown deadlines are immutable and distinct", () => {
  assert.match(source, /uint64_t immutable_execution_deadline_ms;/u);
  assert.match(source, /uint64_t immutable_teardown_observation_deadline_ms;/u);
  assert.match(
    source,
    /immutable_execution_deadline_ms = config->execution_deadline_ms;/u,
  );
  assert.match(
    source,
    /immutable_teardown_observation_deadline_ms =\s*\n\s*config->teardown_observation_deadline_ms;/u,
  );
  const teardown = source.slice(
    source.indexOf("static int establish_teardown_observation_bound"),
    source.indexOf("static int containment_absence_can_be_committed"),
  );
  assert.equal((teardown.match(/sys_pidfd_send_signal/gu) ?? []).length, 1);
  assert.match(teardown, /arm_timer_once\(\s*\n\s*supervisor->teardown_observation_deadline_fd/u);
  const bound = teardown.indexOf("supervisor->teardown_bound_armed = 1");
  const signalAttempt = teardown.indexOf("supervisor->teardown_signal_attempted = 1");
  const signalDelivery = teardown.indexOf("sys_pidfd_send_signal");
  const successLatch = teardown.indexOf("supervisor->forced_teardown_started =");
  assert(bound >= 0 && signalAttempt > bound);
  assert(signalDelivery > signalAttempt && successLatch > signalDelivery);
  assert.match(teardown, /teardown_timer_arm_failed = 1;[\s\S]*IAT_B3_OUTCOME_INTERNAL_HOLD/u);
  assert.match(teardown, /if \(begin_forced_teardown\(supervisor\)\) return 1;[\s\S]*freeze_failure_outcome_once\(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD\);[\s\S]*return supervisor->teardown_bound_armed;/u);
  assert.equal(source.includes("(void)begin_forced_teardown"), false);
  assert.equal(source.includes("(void)sys_pidfd_send_signal"), false);
  const observationLoop = source.slice(
    source.indexOf("static void observe_until_terminal"),
    source.indexOf("static void close_supervisor"),
  );
  const outerStart = observationLoop.indexOf(
    "supervisor->immutable_outer_watchdog_fd) {",
  );
  const outerEnd = observationLoop.indexOf(
    "      } else if (descriptors[index].fd ==\n                 supervisor->execution_deadline_fd)",
    outerStart,
  );
  const outerBranch = observationLoop.slice(outerStart, outerEnd);
  assert.match(outerBranch, /consume_timer_expiration[\s\S]*close_owned_fd[\s\S]*require_bounded_forced_teardown/u);
  assert.equal(outerBranch.includes("return;"), false);
  assert.match(observationLoop, /poll_timeout_ms =\s*\n\s*remaining > \(uint64_t\)INT_MAX/u);
  assert.match(observationLoop, /status = poll\(descriptors, count, poll_timeout_ms\);\s*\n\s*if \(status < 0 && errno == EINTR\) continue;/u);
  assert.doesNotMatch(observationLoop, /while \(status < 0 && errno == EINTR\)/u);
  assert.match(source, /Observation-only: expiry never authorizes a second signal\./u);
});

test("all READY, START and status writes restore a local SIGPIPE mask", () => {
  const safeWrite = source.slice(
    source.indexOf("static int write_control_without_sigpipe"),
    source.indexOf("static int create_monotonic_timer"),
  );
  assert.match(safeWrite, /sigpending\(&pending_before\)/u);
  assert.match(safeWrite, /sigprocmask\(SIG_BLOCK, &blocked, &previous\)/u);
  assert.match(safeWrite, /sigtimedwait\(&blocked, NULL, &no_wait\)/u);
  assert.match(safeWrite, /sigprocmask\(SIG_SETMASK, &previous, NULL\)/u);
  assert.match(safeWrite, /errno = restore_errno != 0 \? restore_errno : operation_errno;/u);
  for (const controlWrite of [
    "context->ready_write_fd, &ready",
    "context->ready_write_fd, &started",
    "context->status_write_fd, &status",
    "supervisor.map_gate_write_fd, &map_token",
    "supervisor.start_write_fd, &start_token",
  ]) assert(source.includes(`write_control_without_sigpipe(${controlWrite}`), controlWrite);
  assert.doesNotMatch(source, /write_exact\((?:context->(?:ready_write_fd|status_write_fd)|supervisor\.(?:map_gate_write_fd|start_write_fd))/u);
});

test("PID 1 completely reaps every clone wait class before destruction evidence", () => {
  assert.match(source, /waitid\(P_ALL, 0, &information, WEXITED \| __WALL\)/u);
  assert.doesNotMatch(source, /waitid\(P_ALL, 0, &information, WEXITED\)/u);
  assert.match(source, /if \(errno != ECHILD\) return 0;/u);
  assert.match(source, /status->complete_reap = status->root_status_committed;/u);
  assert.match(
    source,
    /waitid\(P_PIDFD, \(id_t\)supervisor->namespace_pidfd, &information,\s*\n\s*WEXITED \| WNOHANG\)/u,
  );
  assert.match(
    source,
    /direct_child_reaped = 1;[\s\S]*namespace_pid1_exit_validated[\s\S]*close_owned_fd\(&supervisor->namespace_pidfd\);/u,
  );
  const absence = source.slice(
    source.indexOf("static int containment_absence_can_be_committed"),
    source.indexOf("static void close_supervisor"),
  );
  for (const token of [
    "namespace_terminal",
    "direct_child_reaped",
    "stdout_closed",
    "stderr_closed",
    "containment_empty = 1",
    "absence_proof_observed = 1",
  ]) assert(absence.includes(token), token);
});

test("namespace PID 1 must itself exit zero before PASS can be considered", () => {
  const pidfdReap = source.slice(
    source.indexOf("static int reap_namespace_pid1_by_pidfd"),
    source.indexOf("static int establish_teardown_observation_bound"),
  );
  assert.match(
    pidfdReap,
    /information\.si_code == CLD_EXITED && information\.si_status == 0/u,
  );
  assert.match(pidfdReap, /namespace_pid1_exit_validated = 1;/u);
  assert.match(
    pidfdReap,
    /else \{\s*\n\s*freeze_failure_outcome_once\(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD\);\s*\n\s*\}/u,
  );
  const finish = source.slice(source.indexOf("finish:"), source.indexOf("cleanup:"));
  assert.match(
    finish,
    /if \(!supervisor\.failure_outcome_committed &&\s*\n\s*supervisor\.namespace_pid1_exit_validated &&/u,
  );
  assert(
    finish.indexOf("supervisor.namespace_pid1_exit_validated") <
      finish.indexOf("result->outcome = IAT_B3_OUTCOME_PASS"),
  );
});

test("cleanup never targets a numeric PID or process group", () => {
  for (const forbidden of [
    "kill(",
    "killpg(",
    "tgkill(",
    "tkill(",
    "pkill",
    "pgrep",
    "setsid(",
    "setpgid(",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
  const teardown = source.slice(
    source.indexOf("static int begin_forced_teardown"),
    source.indexOf("static int containment_absence_can_be_committed"),
  );
  assert.match(teardown, /sys_pidfd_send_signal\(supervisor->namespace_pidfd, SIGKILL\)/u);
});

test("root terminal status is write-once at both trust boundaries", () => {
  const pid1Commit = source.slice(
    source.indexOf("static int commit_root_wait_status_once"),
    source.indexOf("static int reap_pid_namespace_to_echild"),
  );
  assert.match(pid1Commit, /status->root_status_committed != 0U/u);
  assert.match(pid1Commit, /status->root_status_committed = 1U;/u);
  const supervisorCommit = source.slice(
    source.indexOf("static int commit_status_frame_once"),
    source.indexOf("static int observe_status_pipe"),
  );
  assert.match(supervisorCommit, /if \(supervisor->status_committed/u);
  assert.match(supervisorCommit, /!supervisor->status_eof_confirmed/u);
  assert.match(supervisorCommit, /supervisor->status_trailing_observed/u);
  assert.match(supervisorCommit, /status_frame_length != sizeof\(\*status\)/u);
  assert.match(supervisorCommit, /supervisor->status_committed = 1;/u);
  assert.equal((supervisorCommit.match(/root_exit_code = status->root_exit_code/gu) ?? []).length, 1);
  assert.equal((supervisorCommit.match(/root_signal = status->root_signal/gu) ?? []).length, 1);
});

test("status observation is nonblocking, bounded, trailing-strict and EOF-gated", () => {
  const main = source.slice(source.indexOf("int iat_b3_platform_run"));
  const statusNonblocking = main.indexOf("make_nonblocking(supervisor.status_read_fd)");
  const mapping = main.indexOf("configure_user_namespace(supervisor.namespace_outer_pid");
  assert(statusNonblocking >= 0 && mapping > statusNonblocking);
  assert.match(source, /status_frame_bytes\[sizeof\(iat_b3_linux_status_frame\) \+ 1U\]/u);
  assert.match(source, /size_t status_frame_length;/u);
  assert.match(source, /int status_eof_confirmed;/u);
  assert.match(source, /int status_trailing_observed;/u);

  const statusObservation = source.slice(
    source.indexOf("static iat_b3_linux_status_observation observe_one_status_pipe_chunk"),
    source.indexOf("static int reap_namespace_pid1_by_pidfd"),
  );
  assert.equal((statusObservation.match(/\bread\(/gu) ?? []).length, 1);
  assert.equal(statusObservation.includes("read_exact("), false);
  assert.equal(statusObservation.includes("for (;;)"), false);
  assert.equal(statusObservation.includes("do {"), false);
  assert.match(statusObservation, /remaining = sizeof\(supervisor->status_frame_bytes\) -\s*\n\s*supervisor->status_frame_length;/u);
  assert.match(statusObservation, /status_frame_length > sizeof\(status\)[\s\S]*status_trailing_observed = 1;/u);
  const eof = statusObservation.indexOf("supervisor->status_eof_confirmed = 1");
  const exactLength = statusObservation.indexOf("status_frame_length != sizeof(status)");
  const copy = statusObservation.indexOf("memcpy(&status, supervisor->status_frame_bytes");
  const commit = statusObservation.indexOf("commit_status_frame_once(supervisor, &status)");
  assert(eof >= 0 && exactLength > eof && copy > exactLength && commit > copy);
  assert.equal((source.match(/commit_status_frame_once\(/gu) ?? []).length, 2);
  assert.equal((source.match(/protocol_validated = 1;/gu) ?? []).length, 1);
  assert.equal(source.includes("static int observe_status_pipe"), false);
  assert.match(source, /observation_arbitration_complete[\s\S]*containment_absence_can_be_committed\(supervisor\) &&\s*\n\s*supervisor->status_read_fd < 0;/u);
  assert.match(source, /while \(!observation_arbitration_complete\(supervisor\)\)/u);
});

test("source text cannot stand in for observed host capability", () => {
  assert.match(source, /behind IAT_B3_PHASE_A_EXECUTION_ENABLED in main\.c/u);
  assert.match(source, /never evidence that the host supplied a\s*\n \* capability/u);
  for (const forbiddenClaim of [
    "CAPABILITY_OBSERVED=1",
    "NAMESPACE_CAPABILITY_PROVEN",
    "PIDFD_CAPABILITY_PROVEN",
    "MAINNET_READY",
    "DEVNET_READY",
  ]) assert.equal(source.includes(forbiddenClaim), false, forbiddenClaim);
});
