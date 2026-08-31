import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourceUrl = new URL(
  '../native/iat-b3-mandatory-ci-containment/src/platform_windows.c',
  import.meta.url,
);
const headerUrl = new URL(
  '../native/iat-b3-mandatory-ci-containment/include/iat_b3_containment.h',
  import.meta.url,
);
const mainUrl = new URL(
  '../native/iat-b3-mandatory-ci-containment/src/main.c',
  import.meta.url,
);
const source = readFileSync(sourceUrl, 'utf8');
const header = readFileSync(headerUrl, 'utf8');
const main = readFileSync(mainUrl, 'utf8');

function sliceFunction(name, nextName) {
  const start = source.indexOf(name);
  const end = nextName === undefined ? source.length : source.indexOf(nextName, start);
  assert.notEqual(start, -1, `missing ${name}`);
  assert.notEqual(end, -1, `missing boundary ${nextName}`);
  return source.slice(start, end);
}

test('BP05 remains source-only behind the Phase-A hard HOLD boundary', () => {
  assert.match(header, /#define IAT_B3_PHASE_A_EXECUTION_ENABLED 0/);
  assert.match(main, /#if !IAT_B3_PHASE_A_EXECUTION_ENABLED[\s\S]*PHASE_A_HARD_DISABLED_HOLD/);
  assert.match(source, /tokens describe an implementation[\s\S]*never assert runtime evidence/);
  assert.doesNotMatch(source, /CAPABILITY_(?:OBSERVED|AVAILABLE)|RUNTIME_EVIDENCE|WINDOWS_SUPPORTED\s*=\s*1/);
});

test('the executable is held share-write/delete-denying for any future launch', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const openStart = run.indexOf('supervisor.executable_handle = CreateFileW');
  const openEnd = run.indexOf(');', openStart);
  const executableOpen = run.slice(openStart, openEnd + 2);
  assert.match(executableOpen, /GENERIC_READ \| GENERIC_EXECUTE, FILE_SHARE_READ/);
  assert.doesNotMatch(executableOpen, /FILE_SHARE_WRITE|FILE_SHARE_DELETE/);
  assert.match(source, /GetFinalPathNameByHandleW\(executable_handle/);
  assert.ok(run.indexOf('close_supervisor(&supervisor)') > run.indexOf('observe_job_and_streams(&supervisor)'));
});

test('unsupported path launch fails HOLD before CreateProcess rather than claiming same-object execution', () => {
  const support = sliceFunction('static int supported_same_object_image_launch_available', 'static int cancel_and_observe_overlapped');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const guard = run.indexOf('if (!supported_same_object_image_launch_available())');
  const create = run.indexOf('CreateProcessW(');
  assert.match(source, /CreateProcessW accepts an image path[\s\S]*cannot[\s\S]*prove/);
  assert.match(support, /return 0/);
  assert.ok(guard !== -1 && guard < create);
  assert.match(run.slice(guard, create), /freeze_failure_outcome_once\(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD\)[\s\S]*goto cleanup/);
  assert.doesNotMatch(source, /executable_identity_equal|identity_after|same-handle recapture/i);
});

test('STARTUPINFOEX installs Job and exact inherited handles before creation', () => {
  const install = sliceFunction('static int install_atomic_job_and_handle_attributes', 'static int prove_membership_while_suspended');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.match(source, /STARTUPINFOEXW/);
  assert.match(install, /PROC_THREAD_ATTRIBUTE_JOB_LIST/);
  assert.match(install, /PROC_THREAD_ATTRIBUTE_HANDLE_LIST/);
  assert.match(install, /3U \* sizeof\(inherited_handles\[0\]\)/);
  assert.ok(run.indexOf('install_atomic_job_and_handle_attributes') < run.indexOf('CreateProcessW('));
  assert.doesNotMatch(source, /\bAssignProcessToJobObject\s*\(/);
});

test('the root is created suspended, proved in-Job, then resumed', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const create = run.indexOf('CreateProcessW(');
  const prove = run.indexOf('prove_membership_while_suspended');
  const resume = run.indexOf('ResumeThread(');
  assert.match(run, /CREATE_SUSPENDED \| EXTENDED_STARTUPINFO_PRESENT/);
  assert.match(source, /IsProcessInJob\(supervisor->root_process, supervisor->job_handle/);
  assert.match(source, /accounting\.ActiveProcesses >= 1U/);
  assert.ok(create < prove && prove < resume);
});

test('the Job is kill-on-close with no admitted breakaway bit', () => {
  const configure = sliceFunction('static int configure_nonbreakaway_kill_on_close_job', 'static int poll_one_job_completion');
  assert.match(configure, /LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  const assignment = configure.match(/LimitFlags\s*=\s*([^;]+);/u)?.[1] ?? '';
  assert.doesNotMatch(assignment, /BREAKAWAY_OK|SILENT_BREAKAWAY_OK/);
  assert.match(source, /Closing KILL_ON_JOB_CLOSE is containment, never evidence of empty/);
});

test('Job completion-port ACTIVE_PROCESS_ZERO is the descendant absence proof', () => {
  const poll = sliceFunction('static int poll_one_job_completion', 'static int begin_bounded_job_teardown');
  const complete = sliceFunction('static int containment_observation_complete', 'static int process_expired_timer_first');
  const observe = sliceFunction('static void observe_job_and_streams', 'static int install_atomic_job_and_handle_attributes');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.match(source, /JobObjectAssociateCompletionPortInformation/);
  assert.match(poll, /GetQueuedCompletionStatus[\s\S]*JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO/);
  assert.match(complete, /active_process_zero_observed/);
  assert.match(observe, /containment_observation_complete[\s\S]*containment_empty = 1[\s\S]*absence_proof_observed = 1/);
  assert.match(run, /containment_empty[\s\S]*absence_proof_observed[\s\S]*completion_protocol_validated/);
});

test('stdout and stderr use overlapped reads bounded to one chunk per turn', () => {
  const beginRead = sliceFunction('static int begin_one_overlapped_read', 'static int complete_one_bounded_read');
  const complete = sliceFunction('static int complete_one_bounded_read', 'static int configure_nonbreakaway_kill_on_close_job');
  const observe = sliceFunction('static void observe_job_and_streams', 'static int install_atomic_job_and_handle_attributes');
  assert.match(source, /PIPE_ACCESS_INBOUND \| FILE_FLAG_OVERLAPPED/);
  assert.match(source, /#define IAT_B3_WINDOWS_IO_CHUNK 16384U/);
  assert.match(beginRead, /remaining_with_sentinel[\s\S]*IAT_B3_WINDOWS_IO_CHUNK/);
  assert.match(beginRead, /ReadFile\([\s\S]*stream->operation\)/);
  assert.equal((complete.match(/iat_b3_stream_update\(/g) ?? []).length, 1);
  assert.equal((observe.match(/complete_one_bounded_read\(/g) ?? []).length, 2);
  assert.doesNotMatch(source, /PeekNamedPipe|ReadFile\([^;]+,\s*NULL\s*\)\s*;/s);
});

test('continuously readable output returns to deadline arbitration every turn', () => {
  const observe = sliceFunction('static void observe_job_and_streams', 'static int install_atomic_job_and_handle_attributes');
  assert.match(observe, /process_expired_timer_first\(supervisor\)[\s\S]*poll_one_job_completion/);
  assert.match(observe, /complete_one_bounded_read[\s\S]*begin_one_overlapped_read[\s\S]*wait_for_next_arbitration_turn/);
  assert.match(source, /IAT_B3_WINDOWS_ARBITRATION_SLICE_MS 25U/);
  assert.doesNotMatch(source, /\bINFINITE\b/);
});

test('all deadline values and timer handles are distinct and immutable after capture', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  for (const field of ['startup', 'execution', 'outer', 'finalization']) {
    assert.match(source, new RegExp(`immutable_${field}_deadline_ms`));
    assert.match(source, new RegExp(`${field}_deadline_timer`));
  }
  assert.match(source, /immutable_teardown_observation_deadline_ms/);
  assert.match(source, /teardown_observation_timer/);
  assert.equal((run.match(/immutable_execution_deadline_ms\s*=/g) ?? []).length, 1);
  assert.equal((run.match(/immutable_finalization_deadline_ms\s*=/g) ?? []).length, 1);
  assert.equal((run.match(/immutable_teardown_observation_deadline_ms\s*=/g) ?? []).length, 1);
});

test('startup and outer watchdogs are armed before CreateProcess', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const create = run.indexOf('CreateProcessW(');
  assert.ok(run.indexOf('arm_timer_once(supervisor.startup_deadline_timer') < create);
  assert.ok(run.indexOf('arm_timer_once(supervisor.outer_deadline_timer') < create);
});

test('execution deadline is armed before ResumeThread', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.ok(run.indexOf('arm_timer_once(supervisor.execution_deadline_timer') < run.indexOf('ResumeThread('));
  assert.ok(run.indexOf('execution_timer_armed_before_resume = 1') < run.indexOf('ResumeThread('));
});

test('expired timers have stable priority before Job, root, and stream events', () => {
  const timers = sliceFunction('static int process_expired_timer_first', 'static DWORD wait_for_next_arbitration_turn');
  const wait = sliceFunction('static DWORD wait_for_next_arbitration_turn', 'static void observe_job_and_streams');
  const orderedTimerTokens = [
    'teardown_observation_timer',
    'outer_deadline_timer',
    'startup_deadline_timer',
    'execution_deadline_timer',
    'finalization_deadline_timer',
  ];
  let offset = -1;
  for (const token of orderedTimerTokens) {
    const next = timers.indexOf(token, offset + 1);
    assert.ok(next > offset, `${token} is out of priority order`);
    offset = next;
  }
  assert.ok(wait.indexOf('outer_deadline_timer') < wait.indexOf('root_process'));
  assert.ok(wait.indexOf('finalization_deadline_timer') < wait.indexOf('stdout_stream.event'));
});

test('terminal observations and PASS are linearized by immutable timer arbitration', () => {
  const root = sliceFunction('static int record_root_terminal', 'static int containment_observation_complete');
  const observe = sliceFunction('static void observe_job_and_streams', 'static int install_atomic_job_and_handle_attributes');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const rootArbitrate = root.indexOf('process_expired_timer_first(supervisor)');
  assert.ok(rootArbitrate < root.indexOf('root_terminal_observed = 1'));
  const eventPoll = observe.indexOf('poll_one_job_completion(supervisor)');
  const postEventArbitrate = observe.indexOf('process_expired_timer_first(supervisor)', eventPoll);
  const containmentCommit = observe.indexOf('containment_empty = 1');
  assert.ok(eventPoll < postEventArbitrate && postEventArbitrate < containmentCommit);
  const pass = run.lastIndexOf('result->outcome = IAT_B3_OUTCOME_PASS');
  assert.ok(run.lastIndexOf('process_expired_timer_first(&supervisor)', pass) < pass);
  assert.match(source, /immutable_(?:startup|execution|outer|finalization|teardown)_expires_at_ms/);
  assert.doesNotMatch(root, /CancelWaitableTimer\(supervisor->execution_deadline_timer\)/);
  const cancelStartup = run.indexOf('CancelWaitableTimer(supervisor.startup_deadline_timer)');
  assert.ok(run.lastIndexOf('immutable_deadline_reached(', cancelStartup) < cancelStartup);
});

test('failure outcome is write-once and clean completion cannot overwrite it', () => {
  const freeze = sliceFunction('static void freeze_failure_outcome_once', 'static HANDLE create_deadline_timer');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.match(freeze, /failure_outcome_committed\)\s*return/);
  assert.match(freeze, /frozen_failure_outcome = outcome[\s\S]*failure_outcome_committed = 1[\s\S]*result->outcome = outcome/);
  assert.match(run, /if \(!supervisor\.failure_outcome_committed &&[\s\S]*result->outcome = IAT_B3_OUTCOME_PASS/);
  for (const outcome of ['TIMEOUT', 'OUTPUT_LIMIT', 'SPAWN_ERROR', 'SIGNAL', 'NONZERO', 'INCOMPLETE_TAP', 'INTERNAL_HOLD']) {
    assert.match(source, new RegExp(`freeze_failure_outcome_once\\([^;]*IAT_B3_OUTCOME_${outcome}`, 's'));
  }
});

test('teardown observation is armed before whole-Job termination', () => {
  const teardown = sliceFunction('static int begin_bounded_job_teardown', 'static int record_root_terminal');
  assert.ok(teardown.indexOf('arm_timer_once(') < teardown.indexOf('TerminateJobObject('));
  assert.ok(teardown.indexOf('teardown_bound_armed = 1') < teardown.indexOf('TerminateJobObject('));
  assert.match(teardown, /if \(!TerminateJobObject[\s\S]*freeze_failure_outcome_once/);
});

test('complete containment requires natural root terminal, ACTIVE_PROCESS_ZERO, and both EOFs', () => {
  const complete = sliceFunction('static int containment_observation_complete', 'static int process_expired_timer_first');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.match(complete, /root_terminal_observed[\s\S]*active_process_zero_observed[\s\S]*stdout_stream\.eof_confirmed[\s\S]*stderr_stream\.eof_confirmed/);
  assert.match(run, /!result->intervention_used/);
  assert.match(run, /completion_protocol_validated/);
});

test('parent closes inherited writers immediately after suspended creation', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const create = run.indexOf('CreateProcessW(');
  const closeOut = run.indexOf('close_owned_handle(&stdout_pipe.write_handle)', create);
  const closeErr = run.indexOf('close_owned_handle(&stderr_pipe.write_handle)', create);
  const membership = run.indexOf('prove_membership_while_suspended', create);
  assert.ok(create < closeOut && closeOut < membership);
  assert.ok(create < closeErr && closeErr < membership);
});

test('CancelIoEx is followed by bounded terminal completion observation before release', () => {
  const cancel = sliceFunction('static int cancel_and_observe_overlapped', 'static int make_overlapped_capture_pipe');
  const makePipe = sliceFunction('static int make_overlapped_capture_pipe', 'static void initialize_stream');
  const closeStream = sliceFunction('static int close_stream', 'static void close_supervisor');
  assert.match(cancel, /CancelIoEx\(handle, operation\)[\s\S]*WaitForSingleObject\(operation->hEvent,[\s\S]*IAT_B3_WINDOWS_CANCEL_DRAIN_MS\)[\s\S]*GetOverlappedResult\(handle, operation/);
  assert.doesNotMatch(cancel, /\bINFINITE\b/);
  const pipeCancel = makePipe.indexOf('cancel_and_observe_overlapped(pair->read_handle, connection)');
  assert.ok(pipeCancel < makePipe.indexOf('close_owned_handle(&pair->read_handle)', pipeCancel));
  assert.match(makePipe, /Quarantine ownership[\s\S]*pair->read_handle = NULL[\s\S]*connection = NULL[\s\S]*return 0/);
  const streamCancel = closeStream.indexOf('cancel_and_observe_overlapped(stream->read_handle');
  assert.ok(streamCancel < closeStream.indexOf('close_owned_handle(&stream->read_handle)'));
  assert.ok(streamCancel < closeStream.indexOf('free(stream->operation)'));
  assert.match(source, /stream->buffer\s*=\s*[\s\S]*malloc\(\(size_t\)IAT_B3_WINDOWS_IO_CHUNK\)/);
  assert.ok(streamCancel < closeStream.indexOf('free(stream->buffer)'));
});

test('attribute-list deletion is gated by successful initialization', () => {
  const install = sliceFunction('static int install_atomic_job_and_handle_attributes', 'static int prove_membership_while_suspended');
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  assert.match(install, /\*attribute_list_initialized = 0[\s\S]*InitializeProcThreadAttributeList\(\*attribute_list[\s\S]*\*attribute_list_initialized = 1/);
  assert.match(run, /if \(attribute_list_initialized\) \{[\s\S]*DeleteProcThreadAttributeList\(attribute_list\)/);
  assert.ok(run.indexOf('&attribute_list_initialized') < run.indexOf('CreateProcessW('));
  assert.doesNotMatch(run, /if \(attribute_list != NULL\) \{\s*DeleteProcThreadAttributeList/);
});

test('forbidden assign-after-start, numeric-PID cleanup, and path-hash substitutes are absent', () => {
  assert.doesNotMatch(source, /\bAssignProcessToJobObject\s*\(|\bTerminateProcess\s*\(|\bOpenProcess\s*\(|taskkill|Process32(?:First|Next)/i);
  assert.doesNotMatch(source, /BCrypt|CryptHashData|HashFile|iat_b3_sha256_(?:init|update|final)/);
  assert.doesNotMatch(source, /QueryFullProcessImageName|CreateToolhelp32Snapshot/);
});

test('PASS depends on observations and never on source token presence', () => {
  const run = sliceFunction('int iat_b3_platform_run', '#endif');
  const pass = run.lastIndexOf('result->outcome = IAT_B3_OUTCOME_PASS');
  assert.ok(pass > run.indexOf('observe_job_and_streams(&supervisor)'));
  assert.ok(pass > run.indexOf('iat_b3_validate_tap_transcript'));
  assert.match(run.slice(0, pass), /root_terminal_observed[\s\S]*containment_empty[\s\S]*absence_proof_observed/);
  assert.equal((run.match(/result->protocol_validated = 1/g) ?? []).length, 1);
});
