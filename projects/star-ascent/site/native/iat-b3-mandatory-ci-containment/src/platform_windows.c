#include "iat_b3_containment.h"

#if defined(_WIN32)

#define WIN32_LEAN_AND_MEAN 1
#include <windows.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#ifndef PROC_THREAD_ATTRIBUTE_JOB_LIST
#define PROC_THREAD_ATTRIBUTE_JOB_LIST \
  ProcThreadAttributeValue(13, FALSE, TRUE, FALSE)
#endif

#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002UL
#endif

/*
 * This adapter remains behind IAT_B3_PHASE_A_EXECUTION_ENABLED in main.c.
 * Its tokens describe an implementation.  They never assert runtime evidence
 * that this host supplied, compiled, or exercised a Windows capability.
 */
#define IAT_B3_WINDOWS_IO_CHUNK 16384U
#define IAT_B3_WINDOWS_ARBITRATION_SLICE_MS 25U
#define IAT_B3_WINDOWS_CANCEL_DRAIN_MS 1000U
#define IAT_B3_WINDOWS_FORCED_EXIT_CODE 0x49334254UL
#define IAT_B3_WINDOWS_COMPLETION_COOKIE 0x4933424aUL

typedef struct iat_b3_windows_pipe_pair {
  HANDLE read_handle;
  HANDLE write_handle;
} iat_b3_windows_pipe_pair;

typedef struct iat_b3_windows_stream {
  HANDLE read_handle;
  HANDLE event;
  OVERLAPPED *operation;
  unsigned char *buffer;
  int read_pending;
  int eof_confirmed;
  iat_b3_stream_observation *observation;
  uint64_t immutable_cap_bytes;
  unsigned char *transcript;
  size_t transcript_capacity;
  size_t transcript_length;
} iat_b3_windows_stream;

typedef struct iat_b3_windows_supervisor {
  const iat_b3_config *config;
  iat_b3_result *result;
  uint64_t started_at_ms;
  uint64_t immutable_startup_deadline_ms;
  uint64_t immutable_execution_deadline_ms;
  uint64_t immutable_outer_deadline_ms;
  uint64_t immutable_finalization_deadline_ms;
  uint64_t immutable_teardown_observation_deadline_ms;
  uint64_t immutable_startup_expires_at_ms;
  uint64_t immutable_execution_expires_at_ms;
  uint64_t immutable_outer_expires_at_ms;
  uint64_t immutable_finalization_expires_at_ms;
  uint64_t immutable_teardown_expires_at_ms;
  HANDLE executable_handle;
  HANDLE job_handle;
  HANDLE completion_port;
  HANDLE root_process;
  HANDLE root_thread;
  HANDLE startup_deadline_timer;
  HANDLE execution_deadline_timer;
  HANDLE outer_deadline_timer;
  HANDLE finalization_deadline_timer;
  HANDLE teardown_observation_timer;
  iat_b3_windows_stream stdout_stream;
  iat_b3_windows_stream stderr_stream;
  ULONG_PTR completion_key_cookie;
  int job_list_attribute_installed;
  int inherited_handle_list_installed;
  int process_created_suspended;
  int membership_proved_before_resume;
  int execution_timer_armed_before_resume;
  int root_terminal_observed;
  int active_process_zero_observed;
  int finalization_timer_armed;
  int teardown_bound_armed;
  int teardown_requested;
  int completion_protocol_validated;
  int failure_outcome_committed;
  iat_b3_outcome frozen_failure_outcome;
} iat_b3_windows_supervisor;

uint64_t iat_b3_windows_monotonic_ms(void) {
  LARGE_INTEGER counter;
  LARGE_INTEGER frequency;
  uint64_t whole_seconds;
  uint64_t remainder;
  if (!QueryPerformanceCounter(&counter) ||
      !QueryPerformanceFrequency(&frequency) || frequency.QuadPart <= 0 ||
      (uint64_t)frequency.QuadPart > UINT64_MAX / 1000ULL)
    return 0;
  whole_seconds = (uint64_t)counter.QuadPart / (uint64_t)frequency.QuadPart;
  remainder = (uint64_t)counter.QuadPart % (uint64_t)frequency.QuadPart;
  if (whole_seconds > UINT64_MAX / 1000ULL) return UINT64_MAX;
  return whole_seconds * 1000ULL +
         (remainder * 1000ULL) / (uint64_t)frequency.QuadPart;
}

static void close_owned_handle(HANDLE *handle) {
  if (handle != NULL && *handle != NULL && *handle != INVALID_HANDLE_VALUE) {
    (void)CloseHandle(*handle);
    *handle = NULL;
  }
}

static void freeze_failure_outcome_once(
    iat_b3_windows_supervisor *supervisor, iat_b3_outcome outcome) {
  if (supervisor == NULL || outcome == IAT_B3_OUTCOME_PASS ||
      supervisor->failure_outcome_committed)
    return;
  supervisor->frozen_failure_outcome = outcome;
  supervisor->failure_outcome_committed = 1;
  supervisor->result->outcome = outcome;
}

static HANDLE create_deadline_timer(void) {
  return CreateWaitableTimerExW(NULL, NULL,
                                CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,
                                TIMER_MODIFY_STATE | SYNCHRONIZE);
}

static int arm_timer_once(HANDLE timer, uint64_t milliseconds) {
  LARGE_INTEGER due_time;
  if (timer == NULL || milliseconds == 0U ||
      milliseconds > (uint64_t)INT64_MAX / 10000ULL)
    return 0;
  due_time.QuadPart = -(LONGLONG)(milliseconds * 10000ULL);
  return SetWaitableTimer(timer, &due_time, 0, NULL, NULL, FALSE) != 0;
}

static int timer_is_expired(HANDLE timer) {
  return timer != NULL && WaitForSingleObject(timer, 0) == WAIT_OBJECT_0;
}

static uint64_t immutable_expiry_from(uint64_t now_ms, uint64_t delay_ms) {
  return delay_ms > UINT64_MAX - now_ms ? UINT64_MAX : now_ms + delay_ms;
}

static int immutable_deadline_reached(uint64_t expires_at_ms) {
  uint64_t now_ms = iat_b3_windows_monotonic_ms();
  return now_ms == 0U || now_ms >= expires_at_ms;
}

static wchar_t *utf8_to_wide(const char *text) {
  wchar_t *wide;
  int length;
  if (text == NULL) return NULL;
  length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text, -1,
                               NULL, 0);
  if (length <= 0 || (size_t)length > SIZE_MAX / sizeof(wchar_t)) return NULL;
  wide = (wchar_t *)malloc((size_t)length * sizeof(wchar_t));
  if (wide == NULL ||
      MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text, -1, wide,
                          length) != length) {
    free(wide);
    return NULL;
  }
  return wide;
}

static wchar_t *build_command_line(const iat_b3_config *config) {
  wchar_t *command_line;
  wchar_t *cursor;
  size_t capacity = 1U;
  int index;
  if (config == NULL || config->child_argc < 1) return NULL;
  for (index = 0; index < config->child_argc; ++index) {
    size_t bytes = strlen(config->child_argv[index]);
    if (bytes > (SIZE_MAX - capacity - 4U) / 2U) return NULL;
    capacity += bytes * 2U + 4U;
  }
  if (capacity > SIZE_MAX / sizeof(wchar_t)) return NULL;
  command_line = (wchar_t *)calloc(capacity, sizeof(wchar_t));
  if (command_line == NULL) return NULL;
  cursor = command_line;
  for (index = 0; index < config->child_argc; ++index) {
    wchar_t *argument = utf8_to_wide(config->child_argv[index]);
    const wchar_t *source;
    size_t backslashes = 0U;
    if (argument == NULL) {
      free(command_line);
      return NULL;
    }
    if (index != 0) *cursor++ = L' ';
    *cursor++ = L'"';
    for (source = argument; *source != L'\0'; ++source) {
      if (*source == L'\\') {
        ++backslashes;
        continue;
      }
      if (*source == L'"') {
        while (backslashes > 0U) {
          *cursor++ = L'\\';
          *cursor++ = L'\\';
          --backslashes;
        }
        *cursor++ = L'\\';
      } else {
        while (backslashes > 0U) {
          *cursor++ = L'\\';
          --backslashes;
        }
      }
      backslashes = 0U;
      *cursor++ = *source;
    }
    while (backslashes > 0U) {
      *cursor++ = L'\\';
      *cursor++ = L'\\';
      --backslashes;
    }
    *cursor++ = L'"';
    free(argument);
  }
  *cursor = L'\0';
  return command_line;
}

static wchar_t *final_path_from_held_handle(HANDLE executable_handle) {
  DWORD required = GetFinalPathNameByHandleW(
      executable_handle, NULL, 0, FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  wchar_t *path;
  if (required == 0 || (size_t)required + 1U > SIZE_MAX / sizeof(wchar_t))
    return NULL;
  path = (wchar_t *)malloc(((size_t)required + 1U) * sizeof(wchar_t));
  if (path == NULL ||
      GetFinalPathNameByHandleW(executable_handle, path, required + 1U,
                                FILE_NAME_NORMALIZED | VOLUME_NAME_DOS) == 0) {
    free(path);
    return NULL;
  }
  return path;
}

/*
 * CreateProcessW accepts an image path, not the already-held executable
 * HANDLE.  A second identity capture can describe the held object but cannot
 * prove that the image loader consumed that object.  No supported Win32 API
 * used by this adapter provides an atomic handle-to-image launch, so the
 * source must remain HOLD before CreateProcessW rather than claim same-object
 * execution from path stability.
 */
static int supported_same_object_image_launch_available(void) {
  return 0;
}

/*
 * Cancellation is not completion.  The OVERLAPPED and both referenced
 * handles remain owned until the event is observed and GetOverlappedResult
 * reports a terminal completion.  The wait is locally bounded.
 */
static int cancel_and_observe_overlapped(HANDLE handle,
                                         OVERLAPPED *operation) {
  DWORD transferred = 0;
  DWORD error;
  DWORD waited;
  if (handle == NULL || operation == NULL || operation->hEvent == NULL)
    return 0;
  if (!CancelIoEx(handle, operation)) {
    error = GetLastError();
    if (error != ERROR_NOT_FOUND) return 0;
  }
  waited = WaitForSingleObject(operation->hEvent,
                               IAT_B3_WINDOWS_CANCEL_DRAIN_MS);
  if (waited != WAIT_OBJECT_0) return 0;
  if (GetOverlappedResult(handle, operation, &transferred, FALSE)) return 1;
  error = GetLastError();
  return error == ERROR_OPERATION_ABORTED || error == ERROR_BROKEN_PIPE ||
         error == ERROR_PIPE_NOT_CONNECTED;
}

static int make_overlapped_capture_pipe(iat_b3_windows_pipe_pair *pair) {
  static volatile LONG sequence = 0;
  SECURITY_ATTRIBUTES security;
  OVERLAPPED *connection = NULL;
  HANDLE connection_event = NULL;
  wchar_t name[160];
  DWORD transferred = 0;
  DWORD error;
  int connection_pending = 0;
  pair->read_handle = NULL;
  pair->write_handle = NULL;
  if (_snwprintf_s(name, sizeof(name) / sizeof(name[0]), _TRUNCATE,
                   L"\\\\.\\pipe\\iat-b3-containment-%llu-%ld-%p",
                   (unsigned long long)GetTickCount64(),
                   InterlockedIncrement(&sequence),
                   (void *)pair) < 0)
    return 0;
  memset(&security, 0, sizeof(security));
  security.nLength = sizeof(security);
  security.bInheritHandle = TRUE;
  pair->read_handle = CreateNamedPipeW(
      name, PIPE_ACCESS_INBOUND | FILE_FLAG_OVERLAPPED,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT, 1,
      IAT_B3_WINDOWS_IO_CHUNK, IAT_B3_WINDOWS_IO_CHUNK, 0, NULL);
  if (pair->read_handle == INVALID_HANDLE_VALUE) {
    pair->read_handle = NULL;
    return 0;
  }
  connection_event = CreateEventW(NULL, TRUE, FALSE, NULL);
  connection = (OVERLAPPED *)calloc(1U, sizeof(*connection));
  if (connection_event == NULL || connection == NULL) goto fail;
  connection->hEvent = connection_event;
  if (!ConnectNamedPipe(pair->read_handle, connection)) {
    error = GetLastError();
    if (error != ERROR_IO_PENDING && error != ERROR_PIPE_CONNECTED) goto fail;
    connection_pending = error == ERROR_IO_PENDING;
  }
  pair->write_handle = CreateFileW(name, GENERIC_WRITE, 0, &security,
                                   OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (pair->write_handle == INVALID_HANDLE_VALUE) {
    pair->write_handle = NULL;
    goto fail;
  }
  if (connection_pending &&
      (WaitForSingleObject(connection_event,
                           IAT_B3_WINDOWS_CANCEL_DRAIN_MS) != WAIT_OBJECT_0 ||
       !GetOverlappedResult(pair->read_handle, connection, &transferred,
                            FALSE)))
    goto fail;
  if (!SetHandleInformation(pair->read_handle, HANDLE_FLAG_INHERIT, 0) ||
      !SetHandleInformation(pair->write_handle, HANDLE_FLAG_INHERIT,
                            HANDLE_FLAG_INHERIT))
    goto fail;
  close_owned_handle(&connection_event);
  free(connection);
  return 1;
fail:
  if (connection_pending && pair->read_handle != NULL &&
      !cancel_and_observe_overlapped(pair->read_handle, connection)) {
    /* Quarantine ownership on terminal-observation failure; do not close the
     * handles or let heap OVERLAPPED storage expire while I/O may reference it. */
    pair->read_handle = NULL;
    pair->write_handle = NULL;
    connection_event = NULL;
    connection = NULL;
    return 0;
  }
  close_owned_handle(&connection_event);
  close_owned_handle(&pair->read_handle);
  close_owned_handle(&pair->write_handle);
  free(connection);
  return 0;
}

static void initialize_stream(iat_b3_windows_stream *stream,
                              HANDLE read_handle,
                              iat_b3_stream_observation *observation,
                              uint64_t cap_bytes, unsigned char *transcript,
                              size_t transcript_capacity) {
  memset(stream, 0, sizeof(*stream));
  stream->read_handle = read_handle;
  stream->event = CreateEventW(NULL, TRUE, FALSE, NULL);
  stream->operation = (OVERLAPPED *)calloc(1U, sizeof(*stream->operation));
  stream->buffer =
      (unsigned char *)malloc((size_t)IAT_B3_WINDOWS_IO_CHUNK);
  if (stream->operation != NULL) stream->operation->hEvent = stream->event;
  stream->observation = observation;
  stream->immutable_cap_bytes = cap_bytes;
  stream->transcript = transcript;
  stream->transcript_capacity = transcript_capacity;
}

static int begin_one_overlapped_read(iat_b3_windows_stream *stream) {
  uint64_t remaining_with_sentinel;
  DWORD requested;
  BOOL completed;
  DWORD error;
  if (stream == NULL || stream->event == NULL || stream->operation == NULL ||
      stream->buffer == NULL ||
      stream->read_handle == NULL ||
      stream->read_pending || stream->eof_confirmed ||
      stream->observation->cap_exceeded)
    return stream != NULL;
  remaining_with_sentinel =
      stream->immutable_cap_bytes - stream->observation->bytes_observed + 1ULL;
  requested = remaining_with_sentinel < IAT_B3_WINDOWS_IO_CHUNK
                  ? (DWORD)remaining_with_sentinel
                  : (DWORD)IAT_B3_WINDOWS_IO_CHUNK;
  ResetEvent(stream->event);
  memset(stream->operation, 0, sizeof(*stream->operation));
  stream->operation->hEvent = stream->event;
  completed = ReadFile(stream->read_handle, stream->buffer, requested, NULL,
                       stream->operation);
  error = completed ? ERROR_SUCCESS : GetLastError();
  if (!completed &&
      (error == ERROR_BROKEN_PIPE || error == ERROR_PIPE_NOT_CONNECTED)) {
    stream->eof_confirmed = 1;
    return 1;
  }
  if (!completed && error != ERROR_IO_PENDING) return 0;
  stream->read_pending = 1;
  return 1;
}

/* Each stream admits at most one bounded chunk per arbitration turn. */
static int complete_one_bounded_read(iat_b3_windows_supervisor *supervisor,
                                     iat_b3_windows_stream *stream) {
  DWORD count = 0;
  DWORD error;
  if (!stream->read_pending ||
      WaitForSingleObject(stream->event, 0) != WAIT_OBJECT_0)
    return 1;
  if (!GetOverlappedResult(stream->read_handle, stream->operation, &count,
                           FALSE)) {
    error = GetLastError();
    stream->read_pending = 0;
    if (error == ERROR_BROKEN_PIPE || error == ERROR_PIPE_NOT_CONNECTED) {
      stream->eof_confirmed = 1;
      return 1;
    }
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    return 0;
  }
  stream->read_pending = 0;
  if (count == 0U) {
    stream->eof_confirmed = 1;
    return 1;
  }
  if (stream->transcript != NULL) {
    if ((size_t)count >
        stream->transcript_capacity - stream->transcript_length) {
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
      return 0;
    }
    memcpy(stream->transcript + stream->transcript_length, stream->buffer,
           (size_t)count);
    stream->transcript_length += (size_t)count;
  }
  iat_b3_stream_update(stream->observation, stream->buffer, (size_t)count,
                       stream->immutable_cap_bytes);
  if (stream->observation->cap_exceeded)
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_OUTPUT_LIMIT);
  return 1;
}

static int configure_nonbreakaway_kill_on_close_job(
    iat_b3_windows_supervisor *supervisor) {
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits;
  JOBOBJECT_ASSOCIATE_COMPLETION_PORT association;
  memset(&limits, 0, sizeof(limits));
  /* BREAKAWAY_OK and SILENT_BREAKAWAY_OK are intentionally absent. */
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(supervisor->job_handle,
                               JobObjectExtendedLimitInformation, &limits,
                               sizeof(limits)))
    return 0;
  supervisor->completion_key_cookie = IAT_B3_WINDOWS_COMPLETION_COOKIE;
  memset(&association, 0, sizeof(association));
  association.CompletionKey = &supervisor->completion_key_cookie;
  association.CompletionPort = supervisor->completion_port;
  return SetInformationJobObject(supervisor->job_handle,
                                 JobObjectAssociateCompletionPortInformation,
                                 &association, sizeof(association)) != 0;
}

/* Exactly one Job packet is consumed per turn after timer arbitration. */
static int poll_one_job_completion(iat_b3_windows_supervisor *supervisor) {
  DWORD message = 0;
  ULONG_PTR completion_key = 0;
  LPOVERLAPPED value = NULL;
  BOOL dequeued = GetQueuedCompletionStatus(supervisor->completion_port,
                                            &message, &completion_key, &value, 0);
  if (!dequeued && value == NULL) {
    DWORD error = GetLastError();
    if (error == WAIT_TIMEOUT) return 1;
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    return 0;
  }
  if (completion_key != (ULONG_PTR)&supervisor->completion_key_cookie) {
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    return 0;
  }
  if (message == JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO)
    supervisor->active_process_zero_observed = 1;
  return 1;
}

static int begin_bounded_job_teardown(
    iat_b3_windows_supervisor *supervisor) {
  if (supervisor->teardown_requested) return supervisor->teardown_bound_armed;
  supervisor->teardown_requested = 1;
  /* Observation-only deadline is armed before termination delivery. */
  if (!arm_timer_once(
          supervisor->teardown_observation_timer,
          supervisor->immutable_teardown_observation_deadline_ms)) {
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    supervisor->result->teardown_deadline_expired = 1;
    supervisor->result->descendant_leak_observed = 1;
    /* KILL_ON_JOB_CLOSE is the fail-closed fallback when no bound can arm. */
    close_owned_handle(&supervisor->job_handle);
    return 0;
  }
  supervisor->immutable_teardown_expires_at_ms = immutable_expiry_from(
      iat_b3_windows_monotonic_ms(),
      supervisor->immutable_teardown_observation_deadline_ms);
  supervisor->teardown_bound_armed = 1;
  supervisor->result->intervention_used = 1;
  if (!TerminateJobObject(supervisor->job_handle,
                          IAT_B3_WINDOWS_FORCED_EXIT_CODE))
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
  return 1;
}

static int process_expired_timer_first(
    iat_b3_windows_supervisor *supervisor);

static int record_root_terminal(iat_b3_windows_supervisor *supervisor) {
  DWORD exit_code;
  if (supervisor->root_terminal_observed ||
      WaitForSingleObject(supervisor->root_process, 0) != WAIT_OBJECT_0)
    return 1;
  if (!GetExitCodeProcess(supervisor->root_process, &exit_code) ||
      exit_code == STILL_ACTIVE) {
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    return 0;
  }
  /* Root success cannot outrun a concurrently expired execution/outer bound. */
  if (process_expired_timer_first(supervisor) != 0) return 1;
  supervisor->root_terminal_observed = 1;
  supervisor->result->root_terminal_observed = 1;
  supervisor->result->direct_child_reaped = 1;
  if (exit_code <= INT_MAX) {
    supervisor->result->root_exit_code = (int)exit_code;
    supervisor->result->root_signal = 0;
  } else {
    supervisor->result->root_exit_code = -1;
    supervisor->result->root_signal = 1;
  }
  if (supervisor->result->root_signal > 0)
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_SIGNAL);
  else if (supervisor->result->root_exit_code > 0)
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_NONZERO);
  if (!supervisor->teardown_requested) {
    supervisor->immutable_finalization_expires_at_ms = immutable_expiry_from(
        iat_b3_windows_monotonic_ms(),
        supervisor->immutable_finalization_deadline_ms);
    if (!arm_timer_once(supervisor->finalization_deadline_timer,
                        supervisor->immutable_finalization_deadline_ms)) {
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
      return 0;
    }
    supervisor->finalization_timer_armed = 1;
  }
  return 1;
}

static int containment_observation_complete(
    const iat_b3_windows_supervisor *supervisor) {
  return supervisor->root_terminal_observed &&
         supervisor->active_process_zero_observed &&
         supervisor->stdout_stream.eof_confirmed &&
         supervisor->stderr_stream.eof_confirmed;
}

/* Stable priority: teardown, outer, startup, execution, finalization. */
static int process_expired_timer_first(
    iat_b3_windows_supervisor *supervisor) {
  if (supervisor->teardown_bound_armed &&
      (timer_is_expired(supervisor->teardown_observation_timer) ||
       immutable_deadline_reached(
           supervisor->immutable_teardown_expires_at_ms))) {
    supervisor->result->teardown_deadline_expired = 1;
    if (!supervisor->active_process_zero_observed) {
      supervisor->result->descendant_leak_observed = 1;
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    }
    return -1;
  }
  if (!supervisor->teardown_requested &&
      (timer_is_expired(supervisor->outer_deadline_timer) ||
       immutable_deadline_reached(supervisor->immutable_outer_expires_at_ms))) {
    if (supervisor->result->workload_resumed)
      supervisor->result->execution_deadline_expired = 1;
    else
      supervisor->result->startup_deadline_expired = 1;
    freeze_failure_outcome_once(
        supervisor, supervisor->result->workload_resumed
                        ? IAT_B3_OUTCOME_TIMEOUT
                        : IAT_B3_OUTCOME_SPAWN_ERROR);
    (void)begin_bounded_job_teardown(supervisor);
    return 1;
  }
  if (!supervisor->teardown_requested &&
      !supervisor->result->workload_resumed &&
      (timer_is_expired(supervisor->startup_deadline_timer) ||
       immutable_deadline_reached(
           supervisor->immutable_startup_expires_at_ms))) {
    supervisor->result->startup_deadline_expired = 1;
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    (void)begin_bounded_job_teardown(supervisor);
    return 1;
  }
  if (!supervisor->teardown_requested &&
      supervisor->result->workload_resumed &&
      !supervisor->root_terminal_observed &&
      (timer_is_expired(supervisor->execution_deadline_timer) ||
       immutable_deadline_reached(
           supervisor->immutable_execution_expires_at_ms))) {
    supervisor->result->execution_deadline_expired = 1;
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_TIMEOUT);
    (void)begin_bounded_job_teardown(supervisor);
    return 1;
  }
  if (!supervisor->teardown_requested &&
      supervisor->finalization_timer_armed &&
      (timer_is_expired(supervisor->finalization_deadline_timer) ||
       immutable_deadline_reached(
           supervisor->immutable_finalization_expires_at_ms))) {
    supervisor->result->finalization_deadline_expired = 1;
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    (void)begin_bounded_job_teardown(supervisor);
    return 1;
  }
  return 0;
}

static DWORD wait_for_next_arbitration_turn(
    iat_b3_windows_supervisor *supervisor) {
  HANDLE waits[8];
  DWORD count = 0;
  if (supervisor->teardown_bound_armed)
    waits[count++] = supervisor->teardown_observation_timer;
  waits[count++] = supervisor->outer_deadline_timer;
  if (!supervisor->result->workload_resumed)
    waits[count++] = supervisor->startup_deadline_timer;
  if (supervisor->result->workload_resumed &&
      !supervisor->root_terminal_observed)
    waits[count++] = supervisor->execution_deadline_timer;
  if (supervisor->finalization_timer_armed)
    waits[count++] = supervisor->finalization_deadline_timer;
  waits[count++] = supervisor->root_process;
  if (supervisor->stdout_stream.read_pending)
    waits[count++] = supervisor->stdout_stream.event;
  if (supervisor->stderr_stream.read_pending)
    waits[count++] = supervisor->stderr_stream.event;
  return WaitForMultipleObjects(count, waits, FALSE,
                                IAT_B3_WINDOWS_ARBITRATION_SLICE_MS);
}

static void observe_job_and_streams(iat_b3_windows_supervisor *supervisor) {
  for (;;) {
    int timer_result;
    if (supervisor->teardown_requested && !supervisor->teardown_bound_armed)
      break;
    timer_result = process_expired_timer_first(supervisor);
    if (timer_result < 0) break;
    if (timer_result > 0) continue;
    if (!poll_one_job_completion(supervisor) ||
        !record_root_terminal(supervisor) ||
        !complete_one_bounded_read(supervisor,
                                   &supervisor->stdout_stream) ||
        !complete_one_bounded_read(supervisor,
                                   &supervisor->stderr_stream)) {
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    }
    /* Event observations are provisional until every relevant timer is
     * re-arbitrated.  This is the terminal-observation linearization point. */
    timer_result = process_expired_timer_first(supervisor);
    if (timer_result < 0) break;
    if (timer_result > 0) continue;
    if (supervisor->failure_outcome_committed &&
        !supervisor->teardown_requested)
      (void)begin_bounded_job_teardown(supervisor);
    if (containment_observation_complete(supervisor)) {
      timer_result = process_expired_timer_first(supervisor);
      if (timer_result < 0) break;
      if (timer_result > 0) continue;
      supervisor->result->containment_empty = 1;
      supervisor->result->absence_proof_observed = 1;
      break;
    }
    if (!begin_one_overlapped_read(&supervisor->stdout_stream) ||
        !begin_one_overlapped_read(&supervisor->stderr_stream)) {
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
      (void)begin_bounded_job_teardown(supervisor);
    }
    if (wait_for_next_arbitration_turn(supervisor) == WAIT_FAILED) {
      freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
      (void)begin_bounded_job_teardown(supervisor);
    }
  }
}

static int install_atomic_job_and_handle_attributes(
    STARTUPINFOEXW *startup, HANDLE job_handle, HANDLE inherited_handles[3],
    PPROC_THREAD_ATTRIBUTE_LIST *attribute_list,
    int *attribute_list_initialized) {
  SIZE_T bytes = 0;
  *attribute_list_initialized = 0;
  InitializeProcThreadAttributeList(NULL, 2, 0, &bytes);
  if (bytes == 0 || GetLastError() != ERROR_INSUFFICIENT_BUFFER) return 0;
  *attribute_list = (PPROC_THREAD_ATTRIBUTE_LIST)malloc(bytes);
  if (*attribute_list == NULL ||
      !InitializeProcThreadAttributeList(*attribute_list, 2, 0, &bytes))
    return 0;
  *attribute_list_initialized = 1;
  if (!UpdateProcThreadAttribute(*attribute_list, 0,
                                 PROC_THREAD_ATTRIBUTE_JOB_LIST, &job_handle,
                                 sizeof(job_handle), NULL, NULL) ||
      !UpdateProcThreadAttribute(*attribute_list, 0,
                                 PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                 inherited_handles,
                                 3U * sizeof(inherited_handles[0]), NULL,
                                 NULL))
    return 0;
  startup->lpAttributeList = *attribute_list;
  return 1;
}

static int prove_membership_while_suspended(
    iat_b3_windows_supervisor *supervisor) {
  BOOL in_job = FALSE;
  JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;
  memset(&accounting, 0, sizeof(accounting));
  return IsProcessInJob(supervisor->root_process, supervisor->job_handle,
                        &in_job) &&
         in_job &&
         QueryInformationJobObject(supervisor->job_handle,
                                   JobObjectBasicAccountingInformation,
                                   &accounting, sizeof(accounting), NULL) &&
         accounting.ActiveProcesses >= 1U;
}

static int close_stream(iat_b3_windows_supervisor *supervisor,
                        iat_b3_windows_stream *stream) {
  if (stream->read_pending && stream->read_handle != NULL &&
      !cancel_and_observe_overlapped(stream->read_handle,
                                     stream->operation)) {
    /* Preserve live handle/event/heap-operation ownership on failed drain. */
    freeze_failure_outcome_once(supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    return 0;
  }
  stream->read_pending = 0;
  close_owned_handle(&stream->read_handle);
  close_owned_handle(&stream->event);
  free(stream->operation);
  stream->operation = NULL;
  free(stream->buffer);
  stream->buffer = NULL;
  free(stream->transcript);
  stream->transcript = NULL;
  return 1;
}

static void close_supervisor(iat_b3_windows_supervisor *supervisor) {
  (void)close_stream(supervisor, &supervisor->stdout_stream);
  (void)close_stream(supervisor, &supervisor->stderr_stream);
  close_owned_handle(&supervisor->root_thread);
  close_owned_handle(&supervisor->root_process);
  close_owned_handle(&supervisor->startup_deadline_timer);
  close_owned_handle(&supervisor->execution_deadline_timer);
  close_owned_handle(&supervisor->outer_deadline_timer);
  close_owned_handle(&supervisor->finalization_deadline_timer);
  close_owned_handle(&supervisor->teardown_observation_timer);
  close_owned_handle(&supervisor->completion_port);
  /* Closing KILL_ON_JOB_CLOSE is containment, never evidence of empty. */
  close_owned_handle(&supervisor->job_handle);
  close_owned_handle(&supervisor->executable_handle);
}

int iat_b3_platform_run(const iat_b3_config *config, iat_b3_result *result) {
  iat_b3_windows_supervisor supervisor;
  iat_b3_windows_pipe_pair stdout_pipe = {NULL, NULL};
  iat_b3_windows_pipe_pair stderr_pipe = {NULL, NULL};
  STARTUPINFOEXW startup;
  PROCESS_INFORMATION process;
  PPROC_THREAD_ATTRIBUTE_LIST attribute_list = NULL;
  HANDLE inherited_handles[3] = {NULL, NULL, NULL};
  HANDLE null_input = NULL;
  wchar_t *requested_path = NULL;
  wchar_t *held_final_path = NULL;
  wchar_t *command_line = NULL;
  unsigned char *stdout_transcript = NULL;
  const char *tap_error = NULL;
  int return_status = -1;
  int attribute_list_initialized = 0;

  if (config == NULL || result == NULL || !iat_b3_validate_config(config))
    return -1;
  memset(&supervisor, 0, sizeof(supervisor));
  memset(&startup, 0, sizeof(startup));
  memset(&process, 0, sizeof(process));
  supervisor.config = config;
  supervisor.result = result;
  supervisor.immutable_startup_deadline_ms = config->startup_deadline_ms;
  supervisor.immutable_execution_deadline_ms = config->execution_deadline_ms;
  supervisor.immutable_outer_deadline_ms =
      config->execution_deadline_ms == IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS
          ? IAT_B3_ALL_FEATURE_OUTER_DEADLINE_MS
          : IAT_B3_DEFAULT_OUTER_DEADLINE_MS;
  supervisor.immutable_finalization_deadline_ms =
      config->finalization_deadline_ms;
  supervisor.immutable_teardown_observation_deadline_ms =
      config->teardown_observation_deadline_ms;
  supervisor.started_at_ms = iat_b3_windows_monotonic_ms();
  supervisor.immutable_startup_expires_at_ms = immutable_expiry_from(
      supervisor.started_at_ms, supervisor.immutable_startup_deadline_ms);
  supervisor.immutable_outer_expires_at_ms = immutable_expiry_from(
      supervisor.started_at_ms, supervisor.immutable_outer_deadline_ms);

  result->outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD;
  result->root_exit_code = -1;
  result->root_signal = 0;
  result->root_terminal_observed = 0;
  result->direct_child_reaped = 0;
  result->containment_empty = 0;
  result->descendant_leak_observed = 0;
  result->workload_resumed = 0;
  result->intervention_used = 0;
  result->startup_deadline_expired = 0;
  result->execution_deadline_expired = 0;
  result->finalization_deadline_expired = 0;
  result->teardown_deadline_expired = 0;
  result->strict_tap_validated = 0;
  result->protocol_validated = 0;
  result->absence_proof_observed = 0;
  result->zombie_descendant_count = 0;

  /* Startup and immutable outer watchdogs exist and are armed before start. */
  supervisor.startup_deadline_timer = create_deadline_timer();
  supervisor.execution_deadline_timer = create_deadline_timer();
  supervisor.outer_deadline_timer = create_deadline_timer();
  supervisor.finalization_deadline_timer = create_deadline_timer();
  supervisor.teardown_observation_timer = create_deadline_timer();
  if (supervisor.startup_deadline_timer == NULL ||
      supervisor.execution_deadline_timer == NULL ||
      supervisor.outer_deadline_timer == NULL ||
      supervisor.finalization_deadline_timer == NULL ||
      supervisor.teardown_observation_timer == NULL ||
      !arm_timer_once(supervisor.startup_deadline_timer,
                      supervisor.immutable_startup_deadline_ms) ||
      !arm_timer_once(supervisor.outer_deadline_timer,
                      supervisor.immutable_outer_deadline_ms)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    goto cleanup;
  }

  requested_path = utf8_to_wide(config->child_argv[0]);
  if (requested_path == NULL) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }
  /* FILE_SHARE_READ alone denies share-write and share-delete replacement. */
  supervisor.executable_handle = CreateFileW(
      requested_path, GENERIC_READ | GENERIC_EXECUTE, FILE_SHARE_READ, NULL,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, NULL);
  if (supervisor.executable_handle == INVALID_HANDLE_VALUE) {
    supervisor.executable_handle = NULL;
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }
  if ((held_final_path =
           final_path_from_held_handle(supervisor.executable_handle)) == NULL ||
      (command_line = build_command_line(config)) == NULL) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }

  /* A held no-share-write/delete file is necessary but CreateProcessW cannot
   * bind its path argument to that HANDLE.  Fail closed until a supported,
   * reviewed handle-to-image launch primitive is implemented. */
  if (!supported_same_object_image_launch_available()) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    goto cleanup;
  }

  supervisor.job_handle = CreateJobObjectW(NULL, NULL);
  supervisor.completion_port =
      CreateIoCompletionPort(INVALID_HANDLE_VALUE, NULL, 0, 1);
  if (supervisor.job_handle == NULL || supervisor.completion_port == NULL ||
      !configure_nonbreakaway_kill_on_close_job(&supervisor) ||
      !make_overlapped_capture_pipe(&stdout_pipe) ||
      !make_overlapped_capture_pipe(&stderr_pipe)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    goto cleanup;
  }
  null_input = CreateFileW(L"NUL", GENERIC_READ,
                           FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                           OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (null_input == INVALID_HANDLE_VALUE) null_input = NULL;
  if (null_input == NULL ||
      !SetHandleInformation(null_input, HANDLE_FLAG_INHERIT,
                            HANDLE_FLAG_INHERIT)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    goto cleanup;
  }

  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = null_input;
  startup.StartupInfo.hStdOutput = stdout_pipe.write_handle;
  startup.StartupInfo.hStdError = stderr_pipe.write_handle;
  inherited_handles[0] = null_input;
  inherited_handles[1] = stdout_pipe.write_handle;
  inherited_handles[2] = stderr_pipe.write_handle;
  if (!install_atomic_job_and_handle_attributes(
          &startup, supervisor.job_handle, inherited_handles,
          &attribute_list, &attribute_list_initialized)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    goto cleanup;
  }
  supervisor.job_list_attribute_installed = 1;
  supervisor.inherited_handle_list_installed = 1;

  /* Job membership is atomic at birth; there is no assign-after-start path. */
  if (!CreateProcessW(
          held_final_path, command_line, NULL, NULL, TRUE,
          CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT |
              CREATE_UNICODE_ENVIRONMENT,
          NULL, NULL, &startup.StartupInfo, &process)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
    goto cleanup;
  }
  supervisor.process_created_suspended = 1;
  supervisor.root_process = process.hProcess;
  supervisor.root_thread = process.hThread;
  process.hProcess = NULL;
  process.hThread = NULL;

  /* Invalidate transferred ownership and close every parent output writer. */
  close_owned_handle(&stdout_pipe.write_handle);
  close_owned_handle(&stderr_pipe.write_handle);
  close_owned_handle(&null_input);

  stdout_transcript =
      (unsigned char *)malloc((size_t)config->stdout_cap_bytes + 1U);
  if (stdout_transcript == NULL) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    (void)begin_bounded_job_teardown(&supervisor);
  }
  initialize_stream(&supervisor.stdout_stream, stdout_pipe.read_handle,
                    &result->stdout_observation, config->stdout_cap_bytes,
                    stdout_transcript,
                    (size_t)config->stdout_cap_bytes + 1U);
  stdout_pipe.read_handle = NULL;
  stdout_transcript = NULL;
  initialize_stream(&supervisor.stderr_stream, stderr_pipe.read_handle,
                    &result->stderr_observation, config->stderr_cap_bytes,
                    NULL, 0U);
  stderr_pipe.read_handle = NULL;
  if (supervisor.stdout_stream.event == NULL ||
      supervisor.stdout_stream.operation == NULL ||
      supervisor.stdout_stream.buffer == NULL ||
      supervisor.stderr_stream.event == NULL ||
      supervisor.stderr_stream.operation == NULL ||
      supervisor.stderr_stream.buffer == NULL) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    (void)begin_bounded_job_teardown(&supervisor);
  }

  if (!prove_membership_while_suspended(&supervisor)) {
    freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
    (void)begin_bounded_job_teardown(&supervisor);
  } else {
    supervisor.membership_proved_before_resume = 1;
  }

  if (!supervisor.failure_outcome_committed &&
      process_expired_timer_first(&supervisor) != 0) {
    (void)begin_bounded_job_teardown(&supervisor);
  } else if (!supervisor.failure_outcome_committed) {
    if (timer_is_expired(supervisor.startup_deadline_timer) ||
        immutable_deadline_reached(
            supervisor.immutable_startup_expires_at_ms)) {
      supervisor.result->startup_deadline_expired = 1;
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SPAWN_ERROR);
      (void)begin_bounded_job_teardown(&supervisor);
    } else if (!CancelWaitableTimer(supervisor.startup_deadline_timer)) {
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_INTERNAL_HOLD);
      (void)begin_bounded_job_teardown(&supervisor);
    } else {
      supervisor.immutable_execution_expires_at_ms = immutable_expiry_from(
          iat_b3_windows_monotonic_ms(),
          supervisor.immutable_execution_deadline_ms);
      if (!arm_timer_once(supervisor.execution_deadline_timer,
                          supervisor.immutable_execution_deadline_ms)) {
        freeze_failure_outcome_once(&supervisor,
                                    IAT_B3_OUTCOME_INTERNAL_HOLD);
        (void)begin_bounded_job_teardown(&supervisor);
      } else {
        supervisor.execution_timer_armed_before_resume = 1;
        if (process_expired_timer_first(&supervisor) != 0) {
          (void)begin_bounded_job_teardown(&supervisor);
        } else if (ResumeThread(supervisor.root_thread) == (DWORD)-1) {
          freeze_failure_outcome_once(&supervisor,
                                      IAT_B3_OUTCOME_SPAWN_ERROR);
          (void)begin_bounded_job_teardown(&supervisor);
        } else {
          result->workload_resumed = 1;
        }
      }
    }
  }

  /* Never return while a live Job is outside a timer-bounded observation. */
  observe_job_and_streams(&supervisor);

  if (!supervisor.failure_outcome_committed &&
      supervisor.job_list_attribute_installed &&
      supervisor.inherited_handle_list_installed &&
      supervisor.process_created_suspended &&
      supervisor.membership_proved_before_resume &&
      supervisor.execution_timer_armed_before_resume &&
      result->root_terminal_observed && result->direct_child_reaped &&
      result->containment_empty && result->absence_proof_observed &&
      !result->intervention_used &&
      !result->stdout_observation.cap_exceeded &&
      !result->stderr_observation.cap_exceeded) {
    result->strict_tap_validated = iat_b3_validate_tap_transcript(
        supervisor.stdout_stream.transcript,
        supervisor.stdout_stream.transcript_length, &tap_error);
    if (result->root_signal > 0)
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_SIGNAL);
    else if (result->root_exit_code > 0)
      freeze_failure_outcome_once(&supervisor, IAT_B3_OUTCOME_NONZERO);
    else if (!result->strict_tap_validated)
      freeze_failure_outcome_once(&supervisor,
                                  IAT_B3_OUTCOME_INCOMPLETE_TAP);
    else if (!supervisor.failure_outcome_committed &&
             process_expired_timer_first(&supervisor) == 0 &&
             !supervisor.teardown_requested) {
      /* All observation and protocol facts are provisional until this final
       * immutable-timer arbitration.  Only this branch commits success. */
      supervisor.completion_protocol_validated = 1;
      result->protocol_validated = 1;
      result->outcome = IAT_B3_OUTCOME_PASS;
    }
  }
  return_status = result->outcome == IAT_B3_OUTCOME_PASS ? 0 : -1;

cleanup:
  if (attribute_list_initialized) {
    DeleteProcThreadAttributeList(attribute_list);
  }
  if (attribute_list != NULL) {
    free(attribute_list);
  }
  close_owned_handle(&process.hThread);
  close_owned_handle(&process.hProcess);
  close_owned_handle(&null_input);
  close_owned_handle(&stdout_pipe.read_handle);
  close_owned_handle(&stdout_pipe.write_handle);
  close_owned_handle(&stderr_pipe.read_handle);
  close_owned_handle(&stderr_pipe.write_handle);
  free(stdout_transcript);
  free(command_line);
  free(held_final_path);
  free(requested_path);
  close_supervisor(&supervisor);
  result->elapsed_ms =
      iat_b3_windows_monotonic_ms() - supervisor.started_at_ms;
  return return_status;
}

#endif
