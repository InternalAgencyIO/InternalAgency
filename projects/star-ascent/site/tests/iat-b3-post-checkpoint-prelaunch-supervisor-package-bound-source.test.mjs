import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_PATH = fileURLToPath(import.meta.url);
const SITE_ROOT = resolve(dirname(TEST_PATH), "..");
const PATHS = Object.freeze({
  bootstrap: resolve(SITE_ROOT, "docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-bootstrap-descriptor.v1.schema.json"),
  anchor: resolve(SITE_ROOT, "docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-anchor.v1.schema.json"),
  evidence: resolve(SITE_ROOT, "docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-runtime-evidence.v1.schema.json"),
  native: resolve(SITE_ROOT, "native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound.c"),
  launcher: resolve(SITE_ROOT, "scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-launcher.mjs"),
  test: TEST_PATH,
});

const BYTES = Object.fromEntries(Object.entries(PATHS).map(([name, path]) => [name, readFileSync(path)]));
const SOURCE = Object.freeze({
  native: BYTES.native.toString("utf8"),
  launcher: BYTES.launcher.toString("utf8"),
});
const SCHEMA = Object.freeze({
  bootstrap: JSON.parse(BYTES.bootstrap.toString("utf8")),
  anchor: JSON.parse(BYTES.anchor.toString("utf8")),
  evidence: JSON.parse(BYTES.evidence.toString("utf8")),
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertLfRegular(path, bytes, label) {
  const stat = lstatSync(path);
  assert.equal(stat.isFile(), true, `${label}: regular file`);
  assert.equal(stat.isSymbolicLink(), false, `${label}: no symlink`);
  assert.ok(bytes.length > 0, `${label}: nonempty`);
  assert.equal(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, false, `${label}: no BOM`);
  assert.equal(bytes.includes(0), false, `${label}: no NUL`);
  assert.equal(bytes.includes(0x0d), false, `${label}: LF only`);
  assert.equal(bytes.at(-1), 0x0a, `${label}: final LF`);
}

function assertContains(source, tokens, label) {
  for (const token of tokens) assert.ok(source.includes(token), `${label}: missing ${token}`);
}

function assertOrdered(source, tokens, label) {
  let cursor = 0;
  for (const token of tokens) {
    const found = source.indexOf(token, cursor);
    assert.notEqual(found, -1, `${label}: missing or reordered ${token}`);
    cursor = found + token.length;
  }
}

function extractFunction(source, name) {
  const escapedName = name.replaceAll("$", "\\$");
  const signature = new RegExp(`(?:\\b(?:static\\s+)?[A-Za-z_][A-Za-z0-9_]*(?:\\s*\\*)?\\s+|\\basync\\s+function\\s+|\\bfunction\\s+)${escapedName}\\s*\\(`, "gu");
  let match = null;
  for (let candidate = signature.exec(source); candidate !== null; candidate = signature.exec(source)) {
    const semicolon = source.indexOf(";", candidate.index + candidate[0].length);
    const brace = source.indexOf("{", candidate.index + candidate[0].length);
    if (brace >= 0 && (semicolon < 0 || brace < semicolon)) { match = candidate; break; }
  }
  assert.ok(match, `function ${name} exists`);
  const open = source.indexOf("{", match.index + match[0].length);
  assert.notEqual(open, -1, `function ${name} has a body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote !== null) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`function ${name} body is unterminated`);
}

function assertRecursivelyClosedSchema(value, label = "$schema", seen = new Set()) {
  if (value === null || typeof value !== "object") return;
  assert.equal(seen.has(value), false, `${label}: no shared/cyclic schema node`);
  seen.add(value);
  if (value.type === "object") {
    assert.equal(value.additionalProperties, false, `${label}: object is closed`);
    assert.ok(value.properties && typeof value.properties === "object" && !Array.isArray(value.properties), `${label}: properties`);
    assert.ok(Array.isArray(value.required), `${label}: required array`);
    assert.equal(new Set(value.required).size, value.required.length, `${label}: no duplicate required key`);
    for (const key of value.required) assert.ok(Object.hasOwn(value.properties, key), `${label}: required key ${key} is declared`);
    if (!Array.isArray(value.oneOf)) {
      assert.deepEqual(value.required, Object.keys(value.properties), `${label}: required/property parity and order`);
    } else {
      assert.ok(value.oneOf.length >= 2, `${label}: discriminated object union has alternatives`);
      for (const [index, branch] of value.oneOf.entries()) {
        if (Array.isArray(branch.required)) {
          assert.equal(new Set(branch.required).size, branch.required.length, `${label}.oneOf[${index}]: no duplicate required key`);
          for (const key of branch.required) assert.ok(Object.hasOwn(value.properties, key), `${label}.oneOf[${index}]: required key ${key} is declared by the closed parent`);
        }
      }
    }
  }
  if (value.type === "array" && Array.isArray(value.prefixItems)) {
    assert.equal(value.items, false, `${label}: tuple tail is closed`);
    assert.equal(value.minItems, value.prefixItems.length, `${label}: tuple minimum`);
    assert.equal(value.maxItems, value.prefixItems.length, `${label}: tuple maximum`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "properties" || key === "$defs") {
      for (const [childKey, childValue] of Object.entries(child)) assertRecursivelyClosedSchema(childValue, `${label}.${key}.${childKey}`, seen);
    } else if (Array.isArray(child)) {
      child.forEach((entry, index) => assertRecursivelyClosedSchema(entry, `${label}.${key}[${index}]`, seen));
    } else {
      assertRecursivelyClosedSchema(child, `${label}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function clone(value) {
  return structuredClone(value);
}

function assertMutationRejected(validator, source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `${label}: mutation anchor exists`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `${label}: mutation anchor is unique`);
  const mutated = `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function assertSwapRejected(validator, source, left, right, label) {
  const leftIndex = source.indexOf(left);
  const rightIndex = source.indexOf(right);
  assert.notEqual(leftIndex, -1, `${label}: left anchor exists`);
  assert.notEqual(rightIndex, -1, `${label}: right anchor exists`);
  assert.equal(source.indexOf(left, leftIndex + left.length), -1, `${label}: left anchor is unique`);
  assert.equal(source.indexOf(right, rightIndex + right.length), -1, `${label}: right anchor is unique`);
  const placeholder = "__IAT_B3_BPS05_SWAP_PLACEHOLDER__";
  const mutated = source.replace(left, placeholder).replace(right, left).replace(placeholder, right);
  assert.throws(() => validator(mutated), undefined, label);
}

function assertFunctionMutationRejected(validator, source, functionName, needle, replacement, label) {
  const fragment = extractFunction(source, functionName);
  const first = fragment.indexOf(needle);
  assert.notEqual(first, -1, `${label}: mutation anchor exists in ${functionName}`);
  assert.equal(fragment.indexOf(needle, first + needle.length), -1, `${label}: mutation anchor is unique in ${functionName}`);
  const mutatedFragment = `${fragment.slice(0, first)}${replacement}${fragment.slice(first + needle.length)}`;
  const functionStart = source.indexOf(fragment);
  const mutated = `${source.slice(0, functionStart)}${mutatedFragment}${source.slice(functionStart + fragment.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function extractMainCleanup(source) {
  const main = extractFunction(source, "main");
  const marker = "\ncleanup:";
  const cleanupOffset = main.lastIndexOf(marker);
  assert.notEqual(cleanupOffset, -1, "main has the single terminal cleanup label");
  assert.equal(main.indexOf(marker), cleanupOffset, "main has exactly one cleanup label");
  return {
    cleanup: main.slice(cleanupOffset),
    main,
    mainStart: source.indexOf(main),
    cleanupOffset,
  };
}

function assertMainSuccessMutationRejected(validator, source, needle, replacement, label) {
  const { main, mainStart, cleanupOffset } = extractMainCleanup(source);
  const success = main.slice(0, cleanupOffset);
  const first = success.indexOf(needle);
  assert.notEqual(first, -1, `${label}: success-path mutation anchor exists`);
  assert.equal(success.indexOf(needle, first + needle.length), -1, `${label}: success-path mutation anchor is unique`);
  const mutatedSuccess = `${success.slice(0, first)}${replacement}${success.slice(first + needle.length)}`;
  const mutatedMain = `${mutatedSuccess}${main.slice(cleanupOffset)}`;
  const mutated = `${source.slice(0, mainStart)}${mutatedMain}${source.slice(mainStart + main.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function assertMainSuccessSwapRejected(validator, source, left, right, label) {
  const { main, mainStart, cleanupOffset } = extractMainCleanup(source);
  const success = main.slice(0, cleanupOffset);
  const leftIndex = success.indexOf(left);
  const rightIndex = success.indexOf(right);
  assert.notEqual(leftIndex, -1, `${label}: left success-path anchor exists`);
  assert.notEqual(rightIndex, -1, `${label}: right success-path anchor exists`);
  assert.equal(success.indexOf(left, leftIndex + left.length), -1, `${label}: left success-path anchor is unique`);
  assert.equal(success.indexOf(right, rightIndex + right.length), -1, `${label}: right success-path anchor is unique`);
  const placeholder = "__IAT_B3_BPS05_SUCCESS_SWAP_PLACEHOLDER__";
  const mutatedSuccess = success.replace(left, placeholder).replace(right, left).replace(placeholder, right);
  const mutatedMain = `${mutatedSuccess}${main.slice(cleanupOffset)}`;
  const mutated = `${source.slice(0, mainStart)}${mutatedMain}${source.slice(mainStart + main.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function assertCleanupMutationRejected(validator, source, needle, replacement, label) {
  const { cleanup, main, mainStart, cleanupOffset } = extractMainCleanup(source);
  const first = cleanup.indexOf(needle);
  assert.notEqual(first, -1, `${label}: cleanup mutation anchor exists`);
  assert.equal(cleanup.indexOf(needle, first + needle.length), -1, `${label}: cleanup mutation anchor is unique`);
  const mutatedCleanup = `${cleanup.slice(0, first)}${replacement}${cleanup.slice(first + needle.length)}`;
  const mutatedMain = `${main.slice(0, cleanupOffset)}${mutatedCleanup}`;
  const mutated = `${source.slice(0, mainStart)}${mutatedMain}${source.slice(mainStart + main.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function assertCleanupSwapRejected(validator, source, left, right, label) {
  const { cleanup, main, mainStart, cleanupOffset } = extractMainCleanup(source);
  const leftIndex = cleanup.indexOf(left);
  const rightIndex = cleanup.indexOf(right);
  assert.notEqual(leftIndex, -1, `${label}: left cleanup anchor exists`);
  assert.notEqual(rightIndex, -1, `${label}: right cleanup anchor exists`);
  assert.equal(cleanup.indexOf(left, leftIndex + left.length), -1, `${label}: left cleanup anchor is unique`);
  assert.equal(cleanup.indexOf(right, rightIndex + right.length), -1, `${label}: right cleanup anchor is unique`);
  const placeholder = "__IAT_B3_BPS05_CLEANUP_SWAP_PLACEHOLDER__";
  const mutatedCleanup = cleanup.replace(left, placeholder).replace(right, left).replace(placeholder, right);
  const mutatedMain = `${main.slice(0, cleanupOffset)}${mutatedCleanup}`;
  const mutated = `${source.slice(0, mainStart)}${mutatedMain}${source.slice(mainStart + main.length)}`;
  assert.throws(() => validator(mutated), undefined, label);
}

function validatePreauthorization(source) {
  const main = extractFunction(source, "main");
  const isolate = extractFunction(source, "isolate_fd_table_and_signals");
  const semantic = extractFunction(source, "preauth_verify_and_commit_cleanup_semantics");
  const watchdog = extractFunction(source, "watchdog_rpc");
  const kernelEqual = extractFunction(source, "process_kernel_binding_equal");
  const inWorkload = extractFunction(source, "process_in_workload_cgroup");
  assertOrdered(main, [
    "preauth_init(&preauth)",
    "preauth_timer_kernel_minimal(BPS05_FD_ABSOLUTE_TIMER)",
    "preauth_timer_kernel_minimal(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER)",
    "preauth_read_regular(&preauth,BPS05_FD_BOOTSTRAP_SCHEMA",
    "preauth_read_regular(&preauth,BPS05_FD_ANCHOR_SCHEMA",
    "preauth_read_regular(&preauth,BPS05_FD_EVIDENCE_SCHEMA",
    "preauth_read_regular(&preauth,BPS05_FD_BOOTSTRAP",
    "verify_watchdog_endpoint_preauth(&bootstrap.endpoints[1])",
    "preauth_record_kernel_control(&preauth,&bootstrap)",
    "isolate_fd_table_and_signals()",
    "preauth_verify_and_commit_cleanup_semantics(&preauth,&bootstrap,initial_cgroup_empty)",
    "preauth_final(&preauth,preauth_digest)",
    "watchdog_rpc(WD_ASSERT_PREARMED",
    "watchdog_armed=true",
    "bps05_cleanup_plane_verified=true",
    "teardown_timer_verified=true",
    "verify_absolute_timer_prearmed()",
    "verify_bootstrap_control_plane(&bootstrap,endpoints)",
    "validate_bootstrap_cross_bindings(&bootstrap_doc,&bootstrap)",
    "verify_runtime_source_manifest(&bootstrap)",
    "verify_all_fixed_roots(&bootstrap)",
    "verify_static_node_elf(BPS05_FD_NODE_EXECUTABLE,&bootstrap.node_identity)",
    "verify_root_protected_file_identity(&bootstrap.launcher_identity,false)",
    "validate_node_startup_receipt(&bootstrap_doc,&bootstrap)",
    "bps05_full_control_plane_verified=true",
  ], "preauthorization/main");
  assertOrdered(isolate, ["sigfillset(&all)", "sigprocmask(SIG_SETMASK,&all,NULL)", "unshare(CLONE_FILES)", "fd_table_irreversibly_isolated=true"], "irreversible FD/signal isolation");
  assertContains(semantic, [
    "!fd_table_irreversibly_isolated", "watchdog_counters_initialized", "watchdog_sequence!=0", "watchdog_preauth_io_mode",
    'required_roles[4]={"TRUSTED_INVOKER","WATCHDOG","OBSERVER","EVIDENCE_CUSTODIAN"}',
    "strcmp(bootstrap->endpoints[index].role,required_roles[index])!=0",
    "for(size_t index=0;index<4&&rc==0;++index)if(strcmp", "verify_external_endpoint(&bootstrap->endpoints[index],&observed[index])",
    "observe_process_kernel_binding((pid_t)bootstrap->endpoints[index].peer_pid,&endpoint_kernel_before[index])",
    "validate_peer_no_exec_receipt(&bootstrap->endpoints[index],bootstrap)",
    "observe_process_kernel_binding((pid_t)bootstrap->endpoints[index].peer_pid,&endpoint_kernel_after[index])",
    "!process_kernel_binding_equal(&endpoint_kernel_before[index],&endpoint_kernel_after[index])",
    "for(size_t i=0;i<4&&rc==0;++i)", "for(size_t j=0;j<i;++j)",
    "observed[i].peer.pid==observed[j].peer.pid", "strcmp(observed[i].ofd_sha256,observed[j].ofd_sha256)==0",
    "proc_process_tuple(getpid(),&self_ppid_before,&self_session_before,&self_start_before)",
    "verify_supervisor_pidfd_identity(&bootstrap->supervisor_pidfd,self_start_before)",
    "observe_process_executable(getpid(),self_exe_before", "observe_process_executable(getpid(),self_exe_after",
    "observe_process_security_label(getpid(),self_security_before)", "observe_process_security_label(getpid(),self_security_after)",
    "observe_process_kernel_binding(getpid(),&self_kernel_before)", "observe_process_kernel_binding(getpid(),&self_kernel_after)",
    "self_start_before!=self_start_after", "memcmp(self_exe_before,self_exe_after,32)!=0",
    "!process_kernel_binding_equal(&self_kernel_before,&self_kernel_after)",
    "getuid()!=0", "geteuid()!=0", "getgid()!=0", "getegid()!=0",
    "process_in_workload_cgroup(&endpoint_kernel_before[index],bootstrap)",
    "process_in_workload_cgroup(&self_kernel_before,bootstrap)",
    "bootstrap->endpoints[1].peer_uid!=0", "bootstrap->endpoints[1].peer_gid!=0",
    "bootstrap->endpoints[2].peer_uid==0", "bootstrap->endpoints[2].peer_gid==0",
    "bootstrap->endpoints[3].peer_uid==0", "bootstrap->endpoints[3].peer_gid==0",
    "bootstrap->endpoints[2].peer_uid==bootstrap->endpoints[3].peer_uid",
    "observed[2].peer_security_label_sha256,observed[1].peer_security_label_sha256",
    "outside_self_namespaces[]={0,2,4,5}",
    "endpoint_kernel_before[3].cgroup_path,self_kernel_before.cgroup_path",
    "expected->peer_pid==(uint64_t)getpid()", "expected->peer_pidfd_dev==bootstrap->supervisor_pidfd.dev",
    'proof_domain[]="IAT_B3_BPS05_PREAUTH_CLEANUP_SEMANTIC_REPLAY_V2\\0"',
    'isolated_marker[]="CLONE_FILES_AND_SIGNALS_IRREVERSIBLY_ISOLATED\\0"',
    "expected->peer_start_ticks", "expected->peer_no_exec_task_count", "expected->peer_executable_mount_id",
    "expected->peer_executable_sha256", "expected->peer_no_exec_task_set_sha256", "expected->peer_no_exec_filter_sha256",
    "expected->peer_no_exec_receipt_sha256", "expected->peer_no_exec_attestation_nonce",
    "sha256_update(&proof_hash,expected->role,strlen(expected->role))",
    "sha256_update(&proof_hash,endpoint_kernel_before[index].namespace_digest,32)",
    "sha256_update(&proof_hash,endpoint_kernel_before[index].cgroup_digest,32)",
    "unsigned char self_row[136]", "wire_put_u64(self_row+48,(uint64_t)getuid())", "wire_put_u64(self_row+56,(uint64_t)geteuid())",
    "wire_put_u64(self_row+64,(uint64_t)getgid())", "wire_put_u64(self_row+72,(uint64_t)getegid())",
    "sha256_update(&proof_hash,self_security_before,64)", "sha256_update(&proof_hash,self_kernel_before.namespace_digest,32)",
    "sha256_update(&proof_hash,self_kernel_before.cgroup_digest,32)", "memcpy(row+24,proof,32)",
    "preauth_record(transcript,BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,&identity,row,sizeof(row))",
    "transcript->bytes+=watchdog_preauth_bytes", "transcript->entries+=watchdog_preauth_entries",
  ], "isolated complete cleanup-plane semantic replay");
  assertContains(kernelEqual, ["namespace_dev", "namespace_ino", "namespace_type", "cgroup_path", "namespace_digest", "cgroup_digest"], "complete process-kernel equality");
  assertContains(inWorkload, ['prefix[]="/sys/fs/cgroup"', "bootstrap->workload_cgroup_root_identity.path", "strcmp(binding->cgroup_path,relative)==0", "binding->cgroup_path[length]=='/'"], "exact workload-cgroup ancestry");
  assert.doesNotMatch(semantic, /bootstrap->endpoints\[0\]\.peer_(?:uid|gid)(?:==|!=)0/u, "trusted invoker has no invented root/nonroot requirement");
  assert.equal((semantic.match(/for\(size_t index=0;index<4&&rc==0;\+\+index\)/gu) ?? []).length, 2, "all four endpoints are semantically replayed and checked against supervisor aliasing");
  assertContains(watchdog, [
    "reply->accepted!=1", "reply->timer_expired!=0", "reply->sequence!=request.sequence",
    "reply->operation!=(uint32_t)operation", "reply->cas_state!=request.expected_state",
    "memcmp(reply->request_digest,request.request_digest,32)!=0",
    "operation!=WD_ASSERT_PREARMED", "watchdog_sequence!=1", "reply->sequence!=1",
    "reply->cumulative_bytes!=bytes", "reply->cumulative_entries!=entries",
  ], "exact authenticated WD_ASSERT receipt validation");
  const fullStart = main.indexOf("struct endpoint_observation endpoints[4];if(");
  const fullCommit = ")goto cleanup;bps05_full_control_plane_verified=true;";
  const fullEnd = main.indexOf(fullCommit, fullStart);
  assert.notEqual(fullStart, -1, "post-assert full-control check begins");
  assert.notEqual(fullEnd, -1, "every full-control failure reaches cleanup before the full-plane commit");
  const fullChecks = main.slice(fullStart, fullEnd + fullCommit.length);
  assertOrdered(fullChecks, [
    "verify_absolute_timer_prearmed()", "verify_bootstrap_control_plane(&bootstrap,endpoints)",
    "validate_bootstrap_cross_bindings(&bootstrap_doc,&bootstrap)", "verify_runtime_source_manifest(&bootstrap)",
    "verify_all_fixed_roots(&bootstrap)", "verify_static_node_elf(BPS05_FD_NODE_EXECUTABLE,&bootstrap.node_identity)",
    "verify_root_protected_file_identity(&bootstrap.launcher_identity,false)", "validate_node_startup_receipt(&bootstrap_doc,&bootstrap)",
    fullCommit,
  ], "eight post-assert full-control conjuncts fail into cleanup");
  assert.equal((source.match(/\bbps05_cleanup_plane_verified\s*=\s*true\b/gu) ?? []).length, 1, "cleanup plane commits once after WD_ASSERT");
  assert.equal((source.match(/\bbps05_full_control_plane_verified\s*=\s*true\b/gu) ?? []).length, 1, "full control plane commits once after all eight checks");
  assert.doesNotMatch(main, /\bcontrol_plane_ready\b/u, "no redundant full-plane boolean can become an early-cleanup gate");
  assertContains(source, [
    "if(!fd_table_irreversibly_isolated)return -1",
    "require_single_thread(self)",
    "SYS_kcmp,self,self,KCMP_FILE",
    "require_sole_ofd_reference",
  ], "same-OFD isolation");
}

function validateAssertedCleanupTranscript(source) {
  const control = extractFunction(source, "preauth_record_kernel_control");
  assertContains(control, [
    "derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TIMER,\"OPERATION\",operation_ofd,false)",
    "derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,\"TEARDOWN\",teardown_ofd,false)",
    "preauth_sample_timer_window(BPS05_FD_ABSOLUTE_TIMER,BPS05_OPERATION_NS,&bps05_timer_deadline_lower,&bps05_timer_deadline_upper)",
    "preauth_sample_timer_window(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,BPS05_OPERATION_NS+BPS05_TEARDOWN_NS,&bps05_teardown_deadline_lower,&bps05_teardown_deadline_upper)",
    "unsigned char timer_row[192]", "memcpy(timer_row+64,operation_ofd,64)", "memcpy(timer_row+128,teardown_ofd,64)",
    "preauth_record(transcript,BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,&teardown_stat,timer_row,sizeof(timer_row))",
    "for(size_t index=0;index<4;++index)", "verify_control_endpoint_preauth(expected,&observed)",
    "unsigned char row[328]", "wire_put_u64(row+64,expected->peer_start_ticks)",
    "memcpy(row+72,observed.ofd_sha256,64)", "memcpy(row+136,observed.peer_security_label_sha256,64)",
    "memcpy(row+200,expected->peer_pidfd_identity_sha256,64)", "memcpy(row+264,expected->peer_no_exec_receipt_sha256,64)",
    "preauth_record(transcript,expected->fd,&observed.identity,row,sizeof(row))",
    "preauth_record_fixed_file(transcript,&expected->peer_no_exec_receipt_file)",
    "unsigned char cgroup_row[312]", "wire_put_u64(cgroup_row+80,bootstrap->cgroup_kill_identity.mount_id)",
    "memcpy(cgroup_row+88,bootstrap->proc_root_identity.identity_sha256,64)",
    "memcpy(cgroup_row+152,bootstrap->workload_cgroup_root_identity.identity_sha256,64)",
    "memcpy(cgroup_row+216,bootstrap->cgroup_kill_identity.identity_sha256,64)",
    "memcpy(cgroup_row+280,cleanup_roots_digest,32)",
    "preauth_record(transcript,BPS05_FD_CGROUP_KILL,&cgroup_kill_stat,cgroup_row,sizeof(cgroup_row))",
  ], "WD_ASSERT cleanup-plane transcript rows");
  assert.equal(8 * 8 + 64 + 64, 192, "timer row has eight u64 values and two complete 64-byte identities");
  assert.equal(9 * 8 + 4 * 64, 328, "endpoint row has nine u64 values and four complete 64-byte identities");
  assert.equal(11 * 8 + 3 * 64 + 32, 312, "root row has eleven u64 values, three complete identities, and the complete roots digest");
}

function validateInitialCgroupBarrier(source) {
  const read = extractFunction(source, "read_cgroup_control_snapshot");
  const empty = extractFunction(source, "verify_workload_cgroup_initial_empty");
  const semantic = extractFunction(source, "preauth_verify_and_commit_cleanup_semantics");
  const main = extractFunction(source, "main");
  assertOrdered(read, [
    "openat2_beneath(BPS05_FD_WORKLOAD_CGROUP_ROOT,name,O_RDONLY|O_CLOEXEC|O_NOFOLLOW)",
    "fstat(fd,&st)", "S_ISREG(st.st_mode)", "SYS_statx", "AT_EMPTY_PATH|AT_STATX_DONT_SYNC",
    "fstatfs(fd,&fs)", "fs.f_type==CGROUP2_SUPER_MAGIC", "read_procfs_bounded(fd,4096,bytes,length)",
    "close(fd)", "*identity=st", "*mount_id=(uint64_t)sx.stx_mnt_id",
  ], "same-root cgroup control snapshot");
  assertContains(empty, [
    'read_cgroup_control_snapshot("cgroup.events",&events_first', 'read_cgroup_control_snapshot("cgroup.procs",&procs_first',
    'read_cgroup_control_snapshot("cgroup.events",&events_second', 'read_cgroup_control_snapshot("cgroup.procs",&procs_second',
    "events_first_mount==bootstrap->workload_cgroup_root_identity.mount_id",
    "procs_first_mount==bootstrap->workload_cgroup_root_identity.mount_id",
    "events_first_stat.st_dev==events_second_stat.st_dev", "events_first_stat.st_ino==events_second_stat.st_ino",
    "procs_first_stat.st_dev==procs_second_stat.st_dev", "procs_first_stat.st_ino==procs_second_stat.st_ino",
    "events_first_mount==events_second_mount", "procs_first_mount==procs_second_mount",
    "memcmp(events_first,events_second,events_first_length)==0", "memcmp(procs_first,procs_second,procs_first_length)==0",
    "procs_first_length==0", 'strstr((char*)events_first,"populated 0\\n")!=NULL',
    'strstr((char*)events_first,"populated 1\\n")==NULL',
    'domain[]="IAT_B3_BPS05_WORKLOAD_CGROUP_INITIAL_EMPTY_V1\\0"', "unsigned char encoded[80]",
    "bootstrap->workload_cgroup_root_identity.dev", "bootstrap->workload_cgroup_root_identity.ino",
    "bootstrap->workload_cgroup_root_identity.mount_id", "events_first_stat.st_dev", "events_first_stat.st_ino",
    "events_first_mount", "procs_first_stat.st_dev", "procs_first_stat.st_ino", "procs_first_mount",
    "sha256_update(&hash,events_first,events_first_length)", 'sha256_update(&hash,"\\0",1)',
    "sha256_update(&hash,procs_first,procs_first_length)", "sha256_final(&hash,ledger)",
  ], "double-sampled exact initial-empty cgroup transcript");
  assertContains(semantic, [
    "verify_workload_cgroup_initial_empty(bootstrap,initial_cgroup_empty)",
    "sha256_update(&proof_hash,initial_cgroup_empty,32)",
  ], "initial-empty cgroup digest is inside WD_ASSERT preimage");
  assertOrdered(main, [
    "preauth_verify_and_commit_cleanup_semantics(&preauth,&bootstrap,initial_cgroup_empty)",
    "watchdog_rpc(WD_ASSERT_PREARMED", "bps05_cleanup_plane_verified=true",
    "unsigned char preclone_cgroup_empty[32]", "verify_workload_cgroup_initial_empty(&bootstrap,preclone_cgroup_empty)",
    "memcmp(preclone_cgroup_empty,initial_cgroup_empty,32)!=0", "SYS_clone3",
  ], "asserted initial-empty cgroup is replayed immediately before CLONE_INTO_CGROUP");
  assert.equal((source.match(/\bverify_workload_cgroup_initial_empty\s*\(/gu) ?? []).length, 3, "initial-empty definition, asserted observation, and pre-clone replay only");
}

function validateAuthorityAndAdmissionLock(source) {
  const projectionLine = extractFunction(source, "status_projection_line");
  const authority = extractFunction(source, "observe_peer_authority_projection");
  const noExec = extractFunction(source, "validate_peer_no_exec_receipt");
  const acquire = extractFunction(source, "build_cgroup_admission_acquire_digest");
  const release = extractFunction(source, "build_cgroup_admission_release_digest");
  const finalRelease = extractFunction(source, "build_cgroup_admission_final_release_digest");
  const main = extractFunction(source, "main");
  const success = main.slice(0, main.indexOf("cleanup:"));
  assertContains(authority, [
    'read_proc_child_file((pid_t)expected->peer_pid,"status",32768',
    '"Uid:\\t","Gid:\\t","Groups:\\t","CapInh:\\t","CapPrm:\\t","CapEff:\\t","CapBnd:\\t","CapAmb:\\t","NoNewPrivs:\\t","Seccomp:\\t","Seccomp_filters:\\t","CoreDumping:\\t"',
    "status_projection_line", "uid[0]!=uid[1]", "gid[0]!=gid[1]",
    'strcmp(expected->role,"OBSERVER")==0', 'strcmp(expected->role,"EVIDENCE_CUSTODIAN")==0',
    '"CapInh:\\t0000000000000000\\n"', '"CapPrm:\\t0000000000000000\\n"',
    '"CapEff:\\t0000000000000000\\n"', '"CapAmb:\\t0000000000000000\\n"',
    '"NoNewPrivs:\\t1\\n"', '"Seccomp:\\t2\\n"', '"CoreDumping:\\t0\\n"',
    'domain[]="IAT_B3_BPS05_CONTROL_PEER_AUTHORITY_PROJECTION_V1\\0"',
    "sha256_update(&hash,expected->role,strlen(expected->role))",
    "strcmp(digest_hex,expected->peer_authority_projection_sha256)==0",
  ], "role-bound complete peer authority projection");
  assertContains(projectionLine, ["if(found)return -1", "if(!found)return -1", "memcmp(cursor,label,label_length)==0"], "duplicate-aware exact status-line selection");
  assertContains(noExec, [
    "observe_peer_authority_projection(expected,authority_before)", "observe_peer_authority_projection(expected,authority_after)",
    "strcmp(authority_before,authority_after)!=0", '"authorityProjectionSha256"', '"securebitsLocked"', '"dumpable"',
    "json_is_false(&doc,json_object_get(&doc,body,\"dumpable\"))", "json_is_true(&doc,json_object_get(&doc,body,\"securebitsLocked\"))",
    "strcmp(text,expected->peer_authority_projection_sha256)==0",
    "peerPid", "peerStartTicks", "peerPidfdIdentitySha256",
  ], "same-lineage no-exec and authority receipt");
  assertContains(acquire, [
    "workload_cgroup_admission_lock_policy_sha256", "sha256_update(&hash,empty_digest,32)",
    "sha256_update(&hash,bootstrap->run_id,strlen(bootstrap->run_id))", "sha256_update(&hash,bootstrap->prearm_session_id,strlen(bootstrap->prearm_session_id))",
    "workload_cgroup_root_identity.dev", "workload_cgroup_root_identity.ino", "workload_cgroup_root_identity.mount_id",
    'domain[]="IAT_B3_BPS05_WORKLOAD_CGROUP_ADMISSION_ACQUIRE_V2\\0"',
  ], "non-self-referential admission acquisition preimage");
  assert.doesNotMatch(acquire, /receipt/u, "acquisition policy cannot depend on its own receipt");
  assertContains(release, [
    "workload_cgroup_admission_lock_policy_sha256", "sha256_update(&hash,acquisition_receipt,32)", "holder->pid", "holder->pidfd", "holder->start_ticks",
    "process_in_exact_workload_cgroup(binding,bootstrap)", "binding->cgroup_digest", "binding->namespace_digest",
    'domain[]="IAT_B3_BPS05_WORKLOAD_CGROUP_ADMISSION_RELEASE_V2\\0"',
  ], "identity-bound admission release preimage");
  assertContains(finalRelease, ["workload_cgroup_admission_lock_policy_sha256", "sha256_update(&hash,acquisition_receipt,32)", "sha256_update(&hash,zero_digest,32)", 'IAT_B3_BPS05_WORKLOAD_CGROUP_ADMISSION_FINAL_RELEASE_V1'], "zero-bound final release preimage");
  assertOrdered(success, [
    "watchdog_rpc(WD_ASSERT_PREARMED", "build_cgroup_admission_acquire_digest", "watchdog_rpc(WD_ACQUIRE_CGROUP_ADMISSION",
    "bps05_workload_cgroup_admission_lock_held=true", "verify_workload_cgroup_initial_empty(&bootstrap,preclone_cgroup_empty)",
    "SYS_clone3", "sample_child_identity(child,pidfd", "observe_process_kernel_binding(child,&admitted_before)",
    "observe_process_kernel_binding(child,&admitted_after)", "process_kernel_binding_equal(&admitted_before,&admitted_after)",
    "process_in_exact_workload_cgroup(&admitted_before,&bootstrap)", "build_cgroup_admission_release_digest",
    "watchdog_rpc(WD_BIND_CGROUP_ADMISSION_CHILD", "if(!bps05_workload_cgroup_admission_lock_held||watchdog_rpc(WD_LATCH_CHILD_PEEK",
    'receive_magic_packet(handshake[0],"BPS05DRP")', "wait_child_terminal_and_drain", "watchdog_rpc(WD_BEGIN_TEARDOWN",
    "watchdog_rpc(WD_CONFIRM_ZERO", "build_cgroup_admission_final_release_digest",
    "watchdog_rpc(WD_RELEASE_CGROUP_ADMISSION", "bps05_workload_cgroup_admission_lock_held=false",
  ], "authenticated admission lock lifetime");
  assertContains(success, ["if(!bps05_workload_cgroup_admission_lock_held||watchdog_rpc(WD_LATCH_CHILD_PEEK", "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&watchdog_reply)!=0||!bps05_workload_cgroup_admission_lock_held"], "lock remains held through graph execution and direct zero");
  const cleanup = main.slice(main.indexOf("cleanup:"));
  assertOrdered(cleanup, ["watchdog_rpc(WD_ABORT_TO_TERMINAL_HOLD", "watchdog_current_state!=5", "watchdog_rpc(WD_CONFIRM_ZERO", "if(bps05_workload_cgroup_admission_lock_held)", "build_cgroup_admission_final_release_digest", "watchdog_rpc(WD_RELEASE_CGROUP_ADMISSION", "bps05_workload_cgroup_admission_lock_held=false"], "atomic abort preserves admission exclusion through zero and authenticated release");
  assertContains(cleanup, ["else if(watchdog_current_state==7){if(bps05_workload_cgroup_admission_lock_held)", "build_cgroup_admission_final_release_digest", "watchdog_rpc(WD_RELEASE_CGROUP_ADMISSION", "if(!bps05_workload_cgroup_admission_lock_held)zero_confirmed=true"], "state-7 recovery authenticates release before zero confirmation");
  assert.equal((cleanup.match(/watchdog_rpc\(WD_RELEASE_CGROUP_ADMISSION/gu) ?? []).length, 2, "both normal failure-zero and recovered state-7 paths release admission");
  const plane = SCHEMA.bootstrap.$defs.controlPlane;
  assert.ok(plane.required.includes("workloadCgroupAdmissionLockPolicySha256"));
  assert.equal(plane.properties.workloadCgroupAdmissionLockPolicySha256.$ref, "#/$defs/sha256");
  const endpoint = SCHEMA.bootstrap.$defs.controlEndpoint;
  assert.ok(endpoint.required.includes("peerAuthorityProjectionSha256"));
  assert.equal(endpoint.properties.peerAuthorityProjectionSha256.$ref, "#/$defs/sha256");
  for (const endpointName of ["invokerAnchorEndpoint", "watchdogEndpoint", "observerEndpoint", "custodianEndpoint"])
    assert.equal(plane.properties[endpointName].allOf[0].$ref, "#/$defs/controlEndpoint");
}

function validateTimerStages(source) {
  const main = extractFunction(source, "main");
  const parseBootstrap = extractFunction(source, "parse_bootstrap");
  const deriveIdentity = extractFunction(source, "derive_timer_ofd_identity");
  const controlPlane = extractFunction(source, "verify_bootstrap_control_plane");
  const sample = extractFunction(source, "sample_absolute_timer");
  const verifyPrearmed = extractFunction(source, "verify_absolute_timer_prearmed");
  const anchorResponse = extractFunction(source, "validate_anchor_runtime_response");
  const preauthControl = extractFunction(source, "preauth_record_kernel_control");
  const timerFirst = extractFunction(source, "timer_first_wait");
  const killReap = extractFunction(source, "kill_reap_identity");
  const observerTerminal = extractFunction(source, "require_observer_terminal_after_observation");
  const { cleanup } = extractMainCleanup(source);
  assertContains(source, [
    "BPS05_FD_ABSOLUTE_TIMER = 11", "BPS05_FD_ABSOLUTE_TEARDOWN_TIMER = 51",
    "BPS05_OPERATION_NS = UINT64_C(150000000000)", "BPS05_TEARDOWN_NS = UINT64_C(30000000000)",
    "static bool bps05_teardown_timer_selected=false",
  ], "immutable operation and teardown timer identities");
  assertContains(parseBootstrap, [
    'nested_object(doc,plane,"absoluteTimer")', 'nested_object(doc,plane,"absoluteTeardownTimer")',
    'json_object_get(doc,timer,"openFileDescriptionSha256")',
    'json_object_get(doc,teardown_timer,"openFileDescriptionSha256")',
    "strcmp(view->timer_ofd_sha256,view->teardown_timer_ofd_sha256)==0",
  ], "strict bootstrap parity for two disjoint timers");
  assertContains(deriveIdentity, [
    'domain[]="IAT_B3_BPS05_ABSOLUTE_TIMER_OFD_V2\\0"', "fstat(fd,&st)", "sha256_update(&hash,role,strlen(role))",
    "CLOCK_MONOTONIC", "require_sole_ofd_reference(fd)",
  ], "role-separated same-OFD timer identity");
  assertOrdered(controlPlane, [
    'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TIMER,"OPERATION",timer,true)',
    'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,"TEARDOWN",teardown_timer,true)',
    "strcmp(timer,bootstrap->timer_ofd_sha256)", "strcmp(teardown_timer,bootstrap->teardown_timer_ofd_sha256)",
    "fstat(BPS05_FD_ABSOLUTE_TIMER,&operation_stat)", "fstat(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,&teardown_stat)",
    "operation_stat.st_dev==teardown_stat.st_dev&&operation_stat.st_ino==teardown_stat.st_ino",
  ], "direct and disjoint timer control-plane identities");
  assertContains(sample, [
    "clock_gettime(CLOCK_MONOTONIC,&before)", "timerfd_gettime(timer_fd,&current)", "clock_gettime(CLOCK_MONOTONIC,&after)",
    "current.it_interval.tv_sec!=0", "remaining==0", "remaining>maximum_remaining", "after_ns<before_ns",
    "*deadline_lower=before_ns+remaining", "*deadline_upper=after_ns+remaining", "openat2_beneath(BPS05_FD_PROC_ROOT,path",
    'strstr((char*)bytes,"clockid: 1\\n")', 'strstr((char*)bytes,"settime flags: 01\\n")', "require_sole_ofd_reference(timer_fd)",
  ], "independent absolute CLOCK_MONOTONIC timer sample");
  assertContains(verifyPrearmed, [
    "sample_absolute_timer(BPS05_FD_ABSOLUTE_TIMER,BPS05_OPERATION_NS,&bps05_timer_deadline_lower,&bps05_timer_deadline_upper)",
    "sample_absolute_timer(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,BPS05_OPERATION_NS+BPS05_TEARDOWN_NS,&bps05_teardown_deadline_lower,&bps05_teardown_deadline_upper)",
    "bps05_teardown_deadline_lower<=bps05_timer_deadline_upper",
    "bps05_teardown_deadline_upper-bps05_timer_deadline_lower>BPS05_TEARDOWN_NS",
  ], "immutable disjoint deadline windows");
  assertContains(anchorResponse, [
    "operation<bps05_timer_deadline_lower", "operation>bps05_timer_deadline_upper",
    "teardown<bps05_teardown_deadline_lower", "teardown>bps05_teardown_deadline_upper",
    "teardown<=operation", "teardown-operation>BPS05_TEARDOWN_NS",
  ], "anchor response is constrained to the two directly sampled windows");
  assertContains(preauthControl, [
    "fstat(BPS05_FD_ABSOLUTE_TIMER,&operation_stat)", "fstat(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,&teardown_stat)",
    'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TIMER,"OPERATION",operation_ofd,false)',
    'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,"TEARDOWN",teardown_ofd,false)',
    "preauth_sample_timer_window(BPS05_FD_ABSOLUTE_TIMER,BPS05_OPERATION_NS",
    "preauth_sample_timer_window(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,BPS05_OPERATION_NS+BPS05_TEARDOWN_NS",
    "memcpy(timer_row+64,operation_ofd,64)", "memcpy(timer_row+128,teardown_ofd,64)",
  ], "preauthorization transcript binds both timer preimages");
  for (const [fragment, label] of [[timerFirst, "all bounded I/O"], [killReap, "pidfd cleanup"], [observerTerminal, "observer terminal"]]) {
    assertContains(fragment, [
      "bps05_teardown_timer_selected?BPS05_FD_ABSOLUTE_TEARDOWN_TIMER:BPS05_FD_ABSOLUTE_TIMER",
    ], `${label} uses the selected immutable timer`);
  }
  assertOrdered(main, [
    "preauth_verify_and_commit_cleanup_semantics(&preauth,&bootstrap,initial_cgroup_empty)",
    "watchdog_rpc(WD_ASSERT_PREARMED", "teardown_timer_verified=true",
    "verify_absolute_timer_prearmed()", "verify_bootstrap_control_plane(&bootstrap,endpoints)",
    "bps05_full_control_plane_verified=true",
    "close_execution_temporaries_before_zero(&control[0],&stdout_pipe[0],&stderr_pipe[0],&pidfd,temporary_fd_ledger)",
    "!teardown_timer_verified", "bps05_teardown_timer_selected=true", "watchdog_rpc(WD_BEGIN_TEARDOWN,0,0,phase_digest,&watchdog_reply)",
  ], "success switches from verified FD11 to verified FD51 only at teardown");
  assertOrdered(cleanup, [
    "watchdog_armed&&!final_evidence_durable&&!bps05_cleanup_plane_verified", "cleanup_ok=false",
    "watchdog_armed&&!final_evidence_durable&&bps05_cleanup_plane_verified", "bps05_teardown_timer_selected=true",
    "watchdog_rpc(WD_ABORT_TO_TERMINAL_HOLD,0,0,phase_digest,&cleanup_reply)",
  ], "failure locally selects verified FD51 immediately before atomic abort");
  assert.equal((source.match(/\bbps05_teardown_timer_selected\s*=\s*true\b/gu) ?? []).length, 2, "exact success and failure timer-stage switches");
  assert.equal((source.match(/\bteardown_timer_verified\s*=\s*true\b/gu) ?? []).length, 1, "timer verification is committed exactly once");
}

function validateLauncherInvocation(source) {
  const canonical = extractFunction(source, "canonicalU64");
  const evaluate = extractFunction(source, "evaluatePackageGraph");
  const main = extractFunction(source, "main");
  assertOrdered(canonical, [
    'typeof value !== "string"', "/^(?:0|[1-9][0-9]{0,19})$/", "const parsed = BigInt(value);",
    "parsed > 18_446_744_073_709_551_615n", "return parsed;",
  ], "canonical u64 stays a checked BigInt inside the host");
  assertOrdered(evaluate, [
    "const role5 = makeSourceModule", "await role5.evaluate", "exactNamespace(role5, ROLE5_EXPORTS",
    "const role6 = makeSourceModule", "await role6.evaluate", "exactNamespace(role6, ROLE6_EXPORTS",
    "const invocationSource = `",
    'import entry, { evaluatePostCheckpointToolchainK44Observation as namedEntry } from "iat-b3:role6";',
    'import { snapshotContextNativeFacadeCallCounts } from "iat-b3:role5";',
    'if (typeof entry !== "function" || entry.length !== 1 || entry !== namedEntry) throw new TypeError("entry");',
    "const result = entry(projection);",
    'if (typeof result !== "string") throw new TypeError("result");',
    "const counts = snapshotContextNativeFacadeCallCounts();",
    "Object.getPrototypeOf(counts) !== Object.prototype",
    "counts.isProxy < 1", "counts.structuredClone < 1", "export default result;",
    "new SourceTextModule(invocationSource", 'identifier: "iat-b3-reviewed-in-context-entry-wrapper"',
    'exactModuleRequests(invocation, ["iat-b3:role6", "iat-b3:role5"]',
    'if (specifier === "iat-b3:role6") return role6', 'if (specifier === "iat-b3:role5") return role5',
    "await invocation.evaluate", 'exactNamespace(invocation, ["default"]',
    "const result = invocation.namespace.default;",
    'if (typeof result !== "string") fail("$graph.entry", "only a primitive result string may cross the context boundary")',
    "const parsed = parseCanonicalPackageResult(result)",
    "parsed.runId !== expectedRunId", "parsed.requestSha256 !== acceptedProjectionPrebindingSha256",
    "parsed.bundleSha256 !== expectedBundleSha256", "return result;",
  ], "in-context entry invocation and primitive-only host result");
  assertOrdered(main, [
    "const terminalGraphResult = await evaluatePackageGraph", 'const terminalBytes = Buffer.from(terminalGraphResult, "utf8");',
    "const terminalWritten = writeSync(1, terminalBytes, 0, terminalBytes.length, null);",
    'if (terminalWritten !== terminalBytes.length) fail("$graph.terminal", "partial terminal graph result write")',
  ], "validated primitive bytes are written exactly once to stdout");
  assert.doesNotMatch(evaluate, /\bReflect\.apply\s*\(/u, "host never invokes a cross-realm function");
  assert.doesNotMatch(evaluate, /\brole6\.namespace\.(?:default|evaluatePostCheckpointToolchainK44Observation)\s*\(/u, "role6 function never crosses to the host for invocation");
  assert.doesNotMatch(evaluate, /\brole5\.namespace\.snapshotContextNativeFacadeCallCounts\s*\(/u, "facade count object never crosses to the host");
  assert.doesNotMatch(main, /JSON\.stringify\s*\(\s*terminalGraphResult|String\s*\(\s*terminalGraphResult/u, "terminal result is never reserialized or coerced");
}

function validateTerminalTranscript(source) {
  const main = extractFunction(source, "main");
  const drain = extractFunction(source, "wait_child_terminal_and_drain");
  const graph = extractFunction(source, "validate_terminal_graph_result");
  const transcript = extractFunction(source, "build_terminal_transcript_digest");
  const observation = extractFunction(source, "persist_observation_before_teardown");
  const receipt = extractFunction(source, "validate_observation_receipt_bytes");
  assertContains(main, [
    'projection_domain[]="IAT_B3_BPI01_SUPERVISED_PROJECTION_V1\\0"',
    "sha256_update(&projection_hash,projection.bytes,projection.length)", "sha256_final(&projection_hash,projection_digest)",
    "hex_encode(projection_digest,32,projection_sha)",
  ], "terminal projection digest is derived from the exact native projection bytes");
  assertOrdered(main, [
    "receive_fd3_hold_result(control[0],&result_bytes,&result_length)",
    "validate_pregraph_result(result_bytes,result_length,&anchor,&bundle,prebinding_sha)",
    "sha256_update(&result_hash,result_bytes,result_length)", "sha256_final(&result_hash,pregraph_digest)",
    "struct child_terminal_observation terminal",
    "wait_child_terminal_and_drain(pidfd,stdout_pipe[0],stderr_pipe[0],&terminal)",
    "child_reaped=true;child=-1",
    "validate_terminal_graph_result(&terminal,&anchor,&bundle,prebinding_sha,projection_sha,graph_result_digest)",
    "build_terminal_transcript_digest(&holder,&anchor,&terminal,&bootstrap,&bundle,pregraph_digest,graph_result_digest,phase_digest)",
    "watchdog_rpc(WD_CONSUME_CAS,0,0,final_digest,&watchdog_reply)",
    "watchdog_rpc(WD_TERMINAL_HOLD,0,0,phase_digest,&watchdog_reply)",
    "persist_observation_before_teardown(&bootstrap,&anchor_doc,&anchor,pregraph_digest,phase_digest,final_digest,&observation_bytes,&observation_length,observation_sha,&observation_artifact)",
  ], "pregraph, exact terminal bytes, terminal identity, watchdog HOLD, and observation A");
  assertContains(drain, [
    "struct pollfd pfd[4]", ".fd=BPS05_FD_ABSOLUTE_TIMER", ".fd=pidfd", ".fd=out_eof?-1:stdout_fd", ".fd=err_eof?-1:stderr_fd",
    "pfd[0].revents&(POLLIN|POLLERR|POLLHUP|POLLNVAL)", "watchdog_rpc(WD_CHARGE_READ,sizeof(buffer),1,NULL,&charge)",
    "read(pfd[i].fd,buffer,sizeof(buffer))", "if(i==3)return -1", "(size_t)got>BPS05_MAX_RESULT-out->stdout_length",
    "out->stdout_bytes[out->stdout_length-1]!='\\n'", "memchr(out->stdout_bytes,'\\0'", "memchr(out->stdout_bytes,'\\r'",
    "waitid(P_PIDFD,(id_t)pidfd,&out->info,WEXITED)", "out->info.si_code!=CLD_EXITED", "out->info.si_status!=0", "out->info.si_pid<=0",
    "fstat(pidfd,&pidfd_before)", "fstat(pidfd,&pidfd_after)", "pidfd_before.st_dev!=pidfd_after.st_dev", "pidfd_before.st_ino!=pidfd_after.st_ino",
    "sha256_final(&stdout_hash,out->stdout_sha256)", "sha256_final(&stderr_hash,out->stderr_sha256)",
  ], "bounded timer-first clean-exit terminal drain");
  assert.equal((drain.match(/\bread\s*\(/gu) ?? []).length, 1, "one bounded read site per ready stream and poll turn");
  assertContains(graph, [
    "expected_projection_sha", "strlen(expected_projection_sha)!=64", "json_parse_schema(terminal->stdout_bytes,terminal->stdout_length,&doc)",
    'keys[]={"schema","runId","requestSha256","bundleSha256","graphSha256","projectionSha256","toolchainAccepted","k44Accepted","receiptPresent","decision","authority","resultBodySha256"}',
    "json_object_exact_keys(&doc,0,keys", 'strcmp(schema,"iat-b3-post-checkpoint-prelaunch-supervisor-package-graph-result/v1")',
    "strcmp(run,anchor->run_id)", "strcmp(request,prebinding_sha)", "strcmp(bundle_sha,bundle->sha256)",
    'strcmp(graph,"78e901dd5ef6700530a592fef599facffb6628688d444f6c780d5f76610beec1")', "strcmp(projection,expected_projection_sha)",
    'json_is_false(&doc,json_object_get(&doc,0,"toolchainAccepted"))', 'json_is_false(&doc,json_object_get(&doc,0,"k44Accepted"))',
    'json_is_false(&doc,json_object_get(&doc,0,"receiptPresent"))', 'strcmp(decision,"HOLD")', 'strcmp(authority,"NONE")',
    'body_domain[]="IAT_B3_BPS04_PACKAGE_GRAPH_RESULT_BODY_V1\\0"',
    "packet.length!=terminal->stdout_length", "memcmp(packet.bytes,terminal->stdout_bytes,terminal->stdout_length)",
    'domain[]="IAT_B3_BPS05_TERMINAL_GRAPH_RESULT_PACKET_V1\\0"',
  ], "canonical terminal graph result reconstruction and nonauthority");
  assertContains(transcript, [
    'domain[]="IAT_B3_BPS05_NATIVE_CHILD_TERMINAL_TRANSCRIPT_V2\\0"', 'holder_marker[]="PRE_DROP_HOLDER\\0"', 'workload_marker[]="POST_DROP_WORKLOAD\\0"',
    "unsigned char encoded[96]", "holder->pid", "holder->pidfd",
    "holder->start_ticks", "terminal->pidfd_dev", "terminal->pidfd_ino", "terminal->info.si_pid", "terminal->info.si_code",
    "terminal->info.si_status", "terminal->stdout_length", "wire_put_u64(encoded+72,0)", "bundle->length", "bootstrap->launcher_identity.length",
    "holder_marker", "holder->peer_sha256", "workload_marker", "anchor->workload_peer_identity", "anchor->principal_namespace_sha[4]", "anchor->principal_cgroup_sha[4]",
    "terminal->stdout_sha256", "terminal->stderr_sha256", "bootstrap->launcher_identity.sha256", "bundle->sha256",
    '"383960b7b04fd4c3afe66b27fa1ce8de74a870ce18f15d37a8069a5a0414b9d5"',
    "sha256_update(&hash,pregraph_digest,32)", "sha256_update(&hash,graph_result_digest,32)",
  ], "terminal transcript binds the child, executable closure, both outputs, and both result domains");
  assertOrdered(observation, [
    "hex_encode(pregraph_result_digest,32,result_sha)", "hex_encode(terminal_transcript_digest,32,terminal_sha)",
    'handoff_domain[]="IAT_B3_BPS05_OBSERVER_HANDOFF_V2\\0"',
    "anchor->anchor_sha,result_sha,terminal_sha,final_sha", '\\"terminalTranscriptSha256\\":\\"%s\\"',
    "validate_observation_receipt_bytes(observation,length,anchor_doc,anchor,result_sha,terminal_sha,handoff_sha,observation_sha)",
  ], "observer request and V2 handoff carry the terminal transcript independently of fd3");
  assertContains(receipt, [
    '"fd3ResultSha256"', '"terminalTranscriptSha256"',
    'json_copy_string(&doc,json_object_get(&doc,0,"fd3ResultSha256"),value,sizeof(value))&&strcmp(value,fd3_result_sha)==0',
    'json_copy_string(&doc,json_object_get(&doc,0,"terminalTranscriptSha256"),value,sizeof(value))&&strcmp(value,terminal_transcript_sha)==0',
    'strcmp(value,"HOLD")', 'strcmp(value,"NONE")',
  ], "observer receipt separately echoes fd3 and the terminal transcript");
}

function validateEndpoints(source) {
  const parse = extractFunction(source, "parse_bootstrap");
  const plane = extractFunction(source, "verify_bootstrap_control_plane");
  const endpoint = extractFunction(source, "verify_external_endpoint");
  const cmsg = extractFunction(source, "validate_endpoint_sender_control");
  const basic = extractFunction(source, "verify_seqpacket_endpoint_basic");
  const receipt = extractFunction(source, "validate_peer_no_exec_receipt");
  const taskScan = extractFunction(source, "scan_peer_no_exec_task_set");
  assertContains(parse, [
    'endpoint_keys[4]={"invokerAnchorEndpoint","watchdogEndpoint","observerEndpoint","custodianEndpoint"}',
    "endpoint_fds[4]={BPS05_FD_ANCHOR,BPS05_FD_WATCHDOG_RPC,BPS05_FD_OBSERVER_RECEIPT,BPS05_FD_CUSTODIAN_RPC}",
    "pidfd_fds[4]={BPS05_FD_INVOKER_PEER_PIDFD,BPS05_FD_WATCHDOG_PEER_PIDFD,BPS05_FD_OBSERVER_PEER_PIDFD,BPS05_FD_CUSTODIAN_PEER_PIDFD}",
    "receipt_fds[4]={BPS05_FD_INVOKER_NOEXEC_RECEIPT,BPS05_FD_WATCHDOG_NOEXEC_RECEIPT,BPS05_FD_OBSERVER_NOEXEC_RECEIPT,BPS05_FD_CUSTODIAN_NOEXEC_RECEIPT}",
  ], "fixed endpoint table");
  assertContains(plane, [
    "order[4]={1,0,2,3}",
    "verify_external_endpoint(&bootstrap->endpoints[i],&observed[i])",
    "validate_peer_no_exec_receipt(&bootstrap->endpoints[i],bootstrap)",
    "observed[i].peer.pid==observed[j].peer.pid",
    "strcmp(observed[i].ofd_sha256,observed[j].ofd_sha256)==0",
    "strcmp(observed[i].peer_security_label_sha256,observed[j].peer_security_label_sha256)==0",
  ], "four endpoints double-observed");
  assert.equal((plane.match(/verify_external_endpoint\(&bootstrap->endpoints\[i\],&observed\[i\]\)/gu) ?? []).length, 2, "endpoint is live before and after no-exec receipt");
  assertContains(endpoint, [
    "verify_peer_pidfd_identity(expected,true)",
    "peer_executable_dev",
    "peer_executable_ino",
    "peer_executable_mount_id",
    "peer_executable_sha256",
    "proc_start_ticks(observed->peer.pid,&after)",
    "verify_peer_pidfd_identity(expected,false)",
  ], "pidfd/executable endpoint identity");
  assertContains(basic, ["SO_PEERCRED", "SO_PEERSEC", "SO_PASSCRED", "SO_PASSSEC"], "live socket peer identity");
  assertContains(cmsg, ["SCM_CREDENTIALS", "credentials_seen", "SCM_SECURITY", "security_seen", "credentials_seen&&security_seen"], "SCM control exactness");
  assertContains(receipt, [
    "scan_peer_no_exec_task_set(expected,task_first,&count_first)",
    "scan_peer_no_exec_task_set(expected,task_second,&count_second)",
    "start_before!=start_after",
    "count_first!=count_second",
    "strcmp(task_first,task_second)!=0",
    '"attestationNonce"',
    '"runId"',
    '"sessionId"',
    '"bootId"',
    '"peerPidfdIdentitySha256"',
    '"tsyncFlag"',
    '"SECCOMP_FILTER_FLAG_TSYNC"',
    '"tsyncSucceeded"',
    'json_is_true(&doc,json_object_get(&doc,body,"tsyncSucceeded"))',
    '"allExistingTasksCovered"',
    '"postLatchCloneInheritsFilter"',
  ], "no-exec receipt cross-binding");
  assertContains(taskScan, ["/task", "getdents64", '"NoNewPrivs:\\t1\\n"', '"Seccomp:\\t2\\n"'], "live task-set coverage");
}

function validatePrincipalBindings(source) {
  const principals = extractFunction(source, "validate_anchor_principal_bindings");
  const observeKernel = extractFunction(source, "observe_process_kernel_binding");
  const validateKernel = extractFunction(source, "validate_principal_kernel_binding");
  const postDrop = extractFunction(source, "verify_post_drop_workload");
  assertContains(principals, [
    'principal_index[4]={0,2,3,5}',
    "bootstrap->endpoints[endpoint_index]",
    "proc_process_tuple((pid_t)expected->peer_pid",
    "expected->peer_pidfd",
    "expected->peer_start_ticks",
    "expected->peer_security_label_sha256",
    "expected->peer_executable_sha256",
    "expected->peer_executable_dev",
    "expected->peer_executable_ino",
    "expected->peer_executable_mount_id",
    "verify_peer_pidfd_identity(expected,false)",
    "json_array_at(doc,principals,1)",
    "bootstrap->supervisor_pidfd.fd",
    "verify_supervisor_pidfd_identity",
    "observe_process_security_label(getpid()",
    "observe_process_executable(getpid()",
    '"IAT_B3_BPS05_SUPERVISOR_PRINCIPAL_IDENTITY_V1\\0"',
    "validate_principal_kernel_binding(doc,principal,(pid_t)pid,anchor->principal_namespace_sha[principal_index[endpoint_index]],anchor->principal_cgroup_sha[principal_index[endpoint_index]])",
    "validate_principal_kernel_binding(doc,supervisor,getpid(),anchor->principal_namespace_sha[1],anchor->principal_cgroup_sha[1])",
    'int pre_drop=nested_object(doc,0,"preDropHolder")',
    "validate_principal_kernel_binding(doc,pre_drop,holder->pid,anchor->holder_namespace_sha,anchor->holder_cgroup_sha)",
  ], "six live principals and supervisor FD50");
  assertContains(observeKernel, [
    'proc_names[7]={"cgroup","ipc","mnt","net","pid","user","uts"}',
    'schema_names[7]={"cgroup","ipc","mount","network","pid","user","uts"}',
    'namespace_domain[]="IAT_B3_BPS05_LIVE_NAMESPACE_SET_V1\\0"',
    'cgroup_domain[]="IAT_B3_BPS05_LIVE_CGROUP_PATH_V1\\0"',
    "openat(BPS05_FD_PROC_ROOT,path,O_RDONLY|O_CLOEXEC)",
    "fstat(fd,&st)==0&&st.st_ino>0", "fstatfs(fd,&fs)==0&&fs.f_type==NSFS_MAGIC",
    'read_proc_child_file(pid,"cgroup",4096', 'memcmp(cgroup,"0::",3)==0',
    "ascii_canonical_path(cgroup+3,length-4,true)",
    "sha256_update(&namespace_hash,schema_names[i],strlen(schema_names[i]))",
    "sha256_update(&cgroup_hash,out->cgroup_path,strlen(out->cgroup_path))",
  ], "direct proc-root namespace and cgroup observation");
  assertContains(validateKernel, [
    "observe_process_kernel_binding(pid,&before)", "observe_process_kernel_binding(pid,&after)",
    "before.namespace_dev[i]!=after.namespace_dev[i]", "before.namespace_ino[i]!=after.namespace_ino[i]",
    "before.namespace_type[i]!=after.namespace_type[i]", "claimed!=before.namespace_ino[i]",
    "strcmp(before.cgroup_path,after.cgroup_path)!=0", "memcmp(before.namespace_digest,after.namespace_digest,32)!=0",
    "memcmp(before.cgroup_digest,after.cgroup_digest,32)!=0", "strcmp(path,before.cgroup_path)!=0",
  ], "double-sampled kernel identity and claimed-anchor parity");
  assertContains(postDrop, [
    "dropped.uid!=anchor->workload_uid", "dropped.gid!=anchor->workload_gid",
    "strcmp(dropped.peer_sha256,anchor->workload_peer_identity)!=0",
    "strcmp(dropped.peer_sha256,anchor->holder_peer_identity)==0",
    "validate_principal_kernel_binding(anchor_doc,workload,pid,anchor->principal_namespace_sha[4],anchor->principal_cgroup_sha[4])",
    "strcmp(anchor->holder_namespace_sha,anchor->principal_namespace_sha[4])!=0",
    "strcmp(anchor->holder_cgroup_sha,anchor->principal_cgroup_sha[4])!=0",
  ], "post-drop workload epoch and direct holder namespace/cgroup equality");
  assert.equal((source.match(/\bvalidate_principal_kernel_binding\s*\(/gu) ?? []).length, 5, "kernel binding definition plus external, supervisor, holder, and workload call sites");
  assert.equal((source.match(/\bobserve_process_kernel_binding\s*\(/gu) ?? []).length, 9, "kernel observation definition plus principal, asserted cleanup-plane, and admitted-child before/after samples");
  assert.deepEqual(SCHEMA.anchor.$defs.principals.prefixItems.map((entry) => entry.allOf[1].properties.role.const), [
    "TRUSTED_INVOKER", "SUPERVISOR", "WATCHDOG", "OBSERVER", "WORKLOAD", "EVIDENCE_CUSTODIAN",
  ]);
}

function validateNativeChildLedger(source) {
  const main = extractFunction(source, "main");
  assertContains(source, [
    "BPS05_MAX_CHUNK = 65536", "BPS05_MAX_REQUEST = 65536", "BPS05_MAX_RESULT = 16384",
    "BPS05_GLOBAL_BYTE_LIMIT = UINT64_C(2147483648)", "BPS05_GLOBAL_ENTRY_LIMIT = UINT64_C(100000)",
    "BPS05_PACKAGE_COUNT = 7",
  ], "native child reservation constants");
  assertContains(main, [
    "bps05_child_reserved_bytes=bundle.length+BPS05_MAX_REQUEST+BPS05_MAX_RESULT+bootstrap.launcher_identity.length",
    "bps05_child_reserved_entries=3+((uint64_t)BPS05_PACKAGE_COUNT*6)+1+2+1",
    "bps05_child_reserved_entries!=49",
    "bps05_child_reserved_bytes>BPS05_GLOBAL_BYTE_LIMIT-watchdog_cumulative_bytes",
    "watchdog_rpc(WD_CHARGE_READ,bps05_child_reserved_bytes,bps05_child_reserved_entries,NULL,&watchdog_reply)",
  ], "exact 49-entry native child reservation");
  assert.equal(3 + 7 * 6 + 1 + 2 + 1, 49, "reviewed native reservation arithmetic");
}

function validateLauncherChildLedger(source) {
  const readExact = extractFunction(source, "readExact");
  const readBundle = extractFunction(source, "readPackageBundle");
  const packageRows = [...source.matchAll(/Object\.freeze\(\{ roleCode: ([1-7]), role: "[A-Z0-9_]+", executable: (?:true|false), path: "([^"]+)", sha256: "[0-9a-f]{64}", byteLength: "([1-9][0-9]*)" \}\)/gu)];
  assertContains(source, [
    "const MAX_REQUEST_BYTES = 65_536;", "const MAX_RESULT_BYTES = 16_384;", "const MAX_CHUNK_BYTES = 65_536;",
    "const GLOBAL_READ_LIMIT = 2_147_483_648n;", "const GLOBAL_ENTRY_LIMIT = 100_000n;",
  ], "launcher child ledger constants");
  assert.equal(packageRows.length, 7, "all seven pinned package rows are locally decoded");
  assert.deepEqual(packageRows.map((match) => Number(match[1])), [1, 2, 3, 4, 5, 6, 7], "package roles are exact and unique");
  for (const [, role, path, byteLength] of packageRows) {
    assert.ok(Buffer.byteLength(path, "utf8") <= 4_096, `role ${role}: pinned path fits one read chunk`);
    assert.ok(BigInt(byteLength) <= 65_536n, `role ${role}: pinned payload fits one read chunk`);
  }
  assertOrdered(readExact, [
    "while (remaining > 0)", "Math.min(MAX_CHUNK_BYTES, remaining)",
    "readSync(fd, chunk, 0, chunk.length, null)", "count !== chunk.length",
    "const actual = chunk.subarray(0, count);", "state.bytes += BigInt(count);", "state.entries += 1n;",
    "state.bytes > GLOBAL_READ_LIMIT || state.entries > GLOBAL_ENTRY_LIMIT", "remaining -= count;",
  ], "bounded exact reads and checked per-chunk ledger");
  assertOrdered(readBundle, [
    "const state = { bytes: 0n, entries: 0n };",
    "readExact(BUNDLE_FD, BUNDLE_MAGIC.length", "readU16(BUNDLE_FD", "readU32(BUNDLE_FD",
    "for (let index = 0; index < PACKAGE_IN_BUNDLE_ORDER.length; index += 1)",
    "const pathLength = readU16", "pathLength > 4096", "readExact(BUNDLE_FD, pathLength", "readExact(BUNDLE_FD, 1",
    "readU64(BUNDLE_FD", "readExact(BUNDLE_FD, 32", "String(payloadLength) !== expected.byteLength", "readExact(BUNDLE_FD, payloadLength",
    "readExact(BUNDLE_FD, 32, state, null, whole", "readSync(BUNDLE_FD, eof, 0, 1, null)",
    "const actualChildBytes = BigInt(requestPacketByteLength) + 1n + state.bytes + 1n;",
    "const actualChildEntries = 2n + state.entries + 1n;",
    "actualChildBytes > canonicalU64(requestBody.ledgerSnapshot.reservedChildBytes",
    "actualChildEntries > canonicalU64(requestBody.ledgerSnapshot.reservedChildEntries",
  ], "46 fd4 entries plus fd3 packet/EOF and stdout reservation replay");
  assert.equal((readBundle.match(/\breadExact\s*\(/gu) ?? []).length, 6, "exact magic/path/role/hash/payload/trailer read sites");
  assert.equal((readBundle.match(/\breadU16\s*\(/gu) ?? []).length, 2, "exact version and per-row path-length read sites");
  assert.equal((readBundle.match(/\breadU32\s*\(/gu) ?? []).length, 1, "exact package-count read site");
  assert.equal((readBundle.match(/\breadU64\s*\(/gu) ?? []).length, 1, "exact per-row payload-length read site");
  assert.equal(3 + 7 * 6 + 1, 46, "reviewed fd4 state.entries arithmetic");
  assert.equal(2 + 46 + 1, 49, "reviewed complete child entry arithmetic");
}

function validateObservationBindings(source) {
  const canonical = extractFunction(source, "canonical_token_sha_equals");
  const observedFile = extractFunction(source, "compare_observed_file_to_anchor");
  const target = extractFunction(source, "validate_observed_target_closure");
  const k44 = extractFunction(source, "validate_k44_observation_assessment");
  const aggregate = extractFunction(source, "validate_observation_anchor_bindings");
  const receipt = extractFunction(source, "validate_observation_receipt_bytes");
  assertContains(canonical, [
    "strlen(expected)!=64", "hash_canonical_token(domain,doc,token,digest,&length)", "length>0&&strcmp(actual,expected)==0",
  ], "canonical observer preimage equality");
  assertContains(observedFile, [
    'fields[]={"path","sha256","byteLength","dev","ino","mountId","handleSha256","mode"}',
    'json_is_true(receipt,json_object_get(receipt,observed,"sameHandleReopened"))',
    "compare_string_property(receipt,observed,anchor_doc,expected,fields[i])",
  ], "same-object observed executable identity");
  assertContains(target, [
    'json_object_get(receipt,observed,"anchorTargetBindingSha256")', "strcmp(value,anchor_binding)!=0",
    'json_object_get(receipt,observed_executable,"role")', 'json_object_get(anchor_doc,expected,"executableRole")',
    "strcmp(observed_role,expected_role)!=0", "compare_observed_file_to_anchor(receipt,observed_executable,anchor_doc,expected_executable)",
    'json_is_null(anchor_doc,json_object_get(anchor_doc,expected,"observation"))',
    'json_is_false(anchor_doc,json_object_get(anchor_doc,expected,"accepted"))',
    'json_is_false(receipt,json_object_get(receipt,observed,"accepted"))',
    'array_keys[]={"compilerClosure","sysrootClosure","linkerClosure"}',
    'anchor_hash_keys[]={"compilerClosureSha256","sysrootClosureSha256","linkerClosureSha256"}',
    'domains[]={"IAT_B3_BPS05_TARGET_COMPILER_CLOSURE_V1","IAT_B3_BPS05_TARGET_SYSROOT_CLOSURE_V1","IAT_B3_BPS05_TARGET_LINKER_CLOSURE_V1"}',
    "canonical_token_sha_equals(domains[i],receipt,json_object_get(receipt,observed,array_keys[i]),expected_value)",
    'equal_hashes[]={"sharingMapSha256","versionArgvSha256","versionInvocationReceiptSha256"}',
    "compare_string_property(receipt,observed,anchor_doc,expected,equal_hashes[i])",
  ], "complete observed target closure");
  assertContains(k44, [
    'observed_flag_keys[]={"checkpoint","inputs","priorInventory","productionInventory","wallClock"}',
    'anchor_flag_keys[]={"checkpointDirectlyObservedByThisModule","inputFilesDirectlyObservedByThisModule","priorLaneIdentityInventoryDirectlyObservedByThisModule","productionIdentityInventoryDirectlyObservedByThisModule","wallClockDirectlyObservedByThisModule"}',
    "json_is_true(receipt,json_object_get(receipt,observed_flags,observed_flag_keys[i]))",
    "json_is_false(anchor_doc,json_object_get(anchor_doc,anchor_flags,anchor_flag_keys[i]))",
    'same_keys[]={"checkpointHeadSha","checkpointTreeSha","b26RunnerSha256","b26RunnerByteLength","laneId","productionInventoryDigest","priorLaneInventoryDigest"}',
    "json_array_count(receipt,observed_inputs)!=2", "json_array_count(anchor_doc,anchor_inputs)!=2",
    'json_copy_string(receipt,json_object_get(receipt,observed_k44,"assessmentSha256"),claimed_assessment,sizeof(claimed_assessment))',
    'hash_domain_json("IAT_B3_BPS05_K44_OBSERVATION_ASSESSMENT_V1"',
    "strcmp(calculated,claimed_assessment)==0",
  ], "direct K44 observation and independently reconstructed assessment");
  assertOrdered(aggregate, [
    "json_array_count(receipt,observed_principals)!=6", "json_array_count(receipt,observed_targets)!=3",
    "validate_observed_target_closure(receipt,json_array_at(receipt,observed_targets,i),anchor_doc,json_array_at(anchor_doc,anchor_targets,i),anchor->target_binding_sha[i])",
    "return validate_k44_observation_assessment(receipt,observed_k44,anchor_doc,anchor_k44)",
  ], "target and K44 helpers are live on the receipt path");
  assertContains(receipt, [
    "validate_observation_anchor_bindings(&doc,anchor_doc,anchor)==0",
  ], "observation receipt invokes complete anchor binding validation");
  assert.equal((source.match(/\bvalidate_observed_target_closure\s*\(/gu) ?? []).length, 2, "target validator definition and live loop call");
  assert.equal((source.match(/\bvalidate_k44_observation_assessment\s*\(/gu) ?? []).length, 2, "K44 validator definition and live return call");
  assert.equal((source.match(/\bvalidate_observation_anchor_bindings\s*\(/gu) ?? []).length, 2, "aggregate validator definition and live receipt call");
}

function validateDirectZeroEvidence(source) {
  const { main, cleanup, cleanupOffset } = extractMainCleanup(source);
  const success = main.slice(0, cleanupOffset);
  const cgroupControl = extractFunction(source, "read_cgroup_control_snapshot");
  const cgroupSnapshot = extractFunction(source, "read_cgroup_events_snapshot");
  const cgroupZero = extractFunction(source, "verify_workload_cgroup_zero");
  const fdCollect = extractFunction(source, "collect_open_fd_numbers");
  const fixedFd = extractFunction(source, "fixed_terminal_fd_expected");
  const fdInventory = extractFunction(source, "finalize_and_inventory_terminal_fds");
  const observerClose = extractFunction(source, "require_observer_terminal_after_observation");
  const directoryEmpty = extractFunction(source, "directory_is_empty_snapshot");
  const entryAbsence = extractFunction(source, "verify_terminal_entry_absence");
  const mountScan = extractFunction(source, "mountinfo_has_run_mount");
  const mountAbsence = extractFunction(source, "verify_terminal_mount_absence");
  const directDigest = extractFunction(source, "build_direct_zero_confirmation_digest");
  const derive = extractFunction(source, "derive_zero_proof_expectations");
  const derivePreAnchor = extractFunction(source, "derive_pre_anchor_zero_proof_expectations");
  const validateFinal = extractFunction(source, "validate_final_evidence_instance");
  const validateNull = extractFunction(source, "validate_null_observation_final_evidence");
  assertContains(cgroupControl, [
    "openat2_beneath(BPS05_FD_WORKLOAD_CGROUP_ROOT,name,O_RDONLY|O_CLOEXEC|O_NOFOLLOW)",
    "fstat(fd,&st)==0&&S_ISREG(st.st_mode)", 'SYS_statx,fd,"",AT_EMPTY_PATH|AT_STATX_DONT_SYNC',
    "STATX_INO|STATX_MNT_ID", "fstatfs(fd,&fs)", "fs.f_type==CGROUP2_SUPER_MAGIC",
    "read_procfs_bounded(fd,4096,bytes,length)", "*identity=st", "*mount_id=(uint64_t)sx.stx_mnt_id",
  ], "same-root generic cgroup control object observation");
  assertContains(cgroupSnapshot, ['read_cgroup_control_snapshot("cgroup.events",bytes,length,identity,mount_id)'], "cgroup.events selects the strict generic reader");
  assertContains(cgroupZero, [
    "read_cgroup_events_snapshot(&first,&first_length,&first_stat,&first_mount)",
    "read_cgroup_events_snapshot(&second,&second_length,&second_stat,&second_mount)",
    "first_length==second_length", "first_stat.st_dev==second_stat.st_dev", "first_stat.st_ino==second_stat.st_ino",
    "first_mount==second_mount", "memcmp(first,second,first_length)==0",
    'strstr((char*)first,"populated 0\\n")!=NULL', 'strstr((char*)first,"populated 1\\n")==NULL',
    'domain[]="IAT_B3_BPS05_DIRECT_CGROUP_ZERO_LEDGER_V1\\0"', "sha256_update(&hash,first,first_length)",
  ], "double-observed cgroup zero ledger");
  assertContains(fdCollect, [
    'snprintf(path,sizeof(path),"%ld/fd",(long)getpid())', "SYS_openat2,BPS05_FD_PROC_ROOT,path",
    "RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS", "SYS_getdents64",
    "count>=BPS05_GLOBAL_ENTRY_LIMIT", "qsort(numbers,count", "numbers[i]==numbers[i-1]",
  ], "direct proc-root descriptor inventory");
  assertContains(fixedFd, [
    "fd!=BPS05_FD_OBSERVER_RECEIPT", "fd>=0&&fd<=2", "fd>=BPS05_FD_BOOTSTRAP&&fd<=BPS05_FD_CGROUP_KILL",
    "fd>=BPS05_FD_PROC_ROOT&&fd<=BPS05_FD_ABSOLUTE_TEARDOWN_TIMER",
  ], "exact post-observer fixed descriptor set");
  assertContains(fdInventory, [
    "observer_identity_closed", "if(!observer_identity_closed||!observer_close_identity_initialized||collect_open_fd_numbers", 'domain[]="IAT_B3_BPS05_DIRECT_TERMINAL_FD_INVENTORY_V2\\0"',
    'closed_marker[]="CLOSED_HIGH_FD\\0"', 'closed_role_marker[]="IDENTITY_CLOSED_FIXED_ROLE_FD\\0"',
    "wire_put_u64(closed_role,BPS05_FD_OBSERVER_RECEIPT)", "sha256_update(&hash,closed_role,sizeof(closed_role))",
    "sha256_update(&hash,observer_close_identity,sizeof(observer_close_identity))",
    'open_marker[]="OPEN_FIXED_FD\\0"', "if(fd==directory||fd<BPS05_FD_GIT_OBJECT_BASE)continue",
    "if(!found)goto fail", "if(close(fd)!=0)goto fail", "collect_open_fd_numbers(&directory,&numbers,&count)",
    "if(!fixed_terminal_fd_expected(fd)||fd<0||fd>=52||seen[fd])goto fail", "expected_count!=48",
    "for(int fd=0;fd<52;++fd)if(fixed_terminal_fd_expected(fd)!=seen[fd])goto fail",
  ], "close-then-reinventory exact 48-descriptor terminal phase");
  assertOrdered(observerClose, [
    "fstat(observer->peer_pidfd,&pidfd_stat)", "observer->peer_pidfd_dev", "observer->peer_pidfd_ino",
    "derive_socket_ofd_identity(BPS05_FD_OBSERVER_RECEIPT,endpoint_ofd,&endpoint_stat)", "strcmp(endpoint_ofd,observer->ofd_sha256)!=0",
    'domain[]="IAT_B3_BPS05_IDENTITY_CLOSED_OBSERVER_ENDPOINT_V1\\0"', "endpoint_stat.st_dev", "endpoint_stat.st_ino",
    "endpoint_stat.st_mode&S_IFMT", "endpoint_stat.st_nlink", "sha256_update(&hash,endpoint_ofd,64)", "sha256_final(&hash,digest)",
    "close(BPS05_FD_OBSERVER_RECEIPT)", "memcpy(observer_close_identity,digest", "observer_close_identity_initialized=true",
  ], "FD19 same-object identity is frozen immediately before its verified close");
  assertContains(directoryEmpty, [
    "for(unsigned pass=0;pass<2;++pass)", 'openat(expected->fd,".",O_RDONLY|O_DIRECTORY|O_CLOEXEC|O_NOFOLLOW)',
    "(uint64_t)st.st_dev!=expected->dev", "(uint64_t)st.st_ino!=expected->ino", "SYS_getdents64",
    'strcmp(name,".")&&strcmp(name,"..")', "entries!=0", "expected->mount_id",
  ], "double-observed empty directory identity");
  assertContains(entryAbsence, [
    'domain[]="IAT_B3_BPS05_DIRECT_TEMPORARY_ENTRY_ABSENCE_V1\\0"', "for(size_t i=5;i<=9;++i)",
    "verify_fixed_directory_identity(&bootstrap->roots[i])", "directory_is_empty_snapshot(&bootstrap->roots[i],&hash,i)",
    "verify_fixed_directory_identity(&bootstrap->roots[10])", "bootstrap->roots[10].mount_id", "bootstrap->roots[10].nlink",
  ], "direct temporary-entry absence ledger");
  assertContains(mountScan, [
    "field==4", "memcmp(bytes+field_start,run_root,root_length)==0", "bytes[field_start+root_length]=='/'",
  ], "mountinfo mount-point field parser");
  assertContains(mountAbsence, [
    'read_proc_child_file(getpid(),"mountinfo",BPS05_MAX_SCHEMA,&first,&first_length)',
    'read_proc_child_file(getpid(),"mountinfo",BPS05_MAX_SCHEMA,&second,&second_length)',
    "first_length==second_length", "memcmp(first,second,first_length)==0",
    "!mountinfo_has_run_mount(first,first_length,bootstrap->roots[0].path)",
    'domain[]="IAT_B3_BPS05_DIRECT_TEMPORARY_MOUNT_ABSENCE_V1\\0"',
    "bootstrap->proc_root_identity.dev", "bootstrap->proc_root_identity.ino", "bootstrap->proc_root_identity.mount_id",
  ], "double-observed direct mount absence ledger");
  for (const fragment of [directDigest, derive, derivePreAnchor]) assertContains(fragment, [
    "fd_ledger", "mount_ledger", "entry_ledger", "cgroup_ledger", "phase_digest", "watchdog_prior_receipt",
  ], "all four direct ledgers enter the zero transcript");
  assertContains(directDigest, [
    'domain[]="IAT_B3_BPS05_DIRECT_ZERO_CONFIRMATION_V1\\0"', "sha256_update(&hash,fd_ledger,32)",
    "sha256_update(&hash,mount_ledger,32)", "sha256_update(&hash,entry_ledger,32)", "sha256_update(&hash,cgroup_ledger,32)",
  ], "watchdog zero confirmation domain and exact ledger inputs");
  assertContains(derive, [
    'zero_domain[]="IAT_B3_BPS05_ZERO_PROOF_TRANSCRIPT_V3\\0"', "memcpy(out->fd_ledger,fd_ledger,32)",
    "memcpy(out->mount_ledger,mount_ledger,32)", "memcpy(out->entry_ledger,entry_ledger,32)",
    "memcpy(out->cgroup_ledger,cgroup_ledger,32)", "sha256_update(&hash,out->entry_ledger,32)",
    "anchor->anchor_sha", "observation_sha",
  ], "post-anchor V3 zero proof");
  assertContains(derivePreAnchor, [
    'zero_domain[]="IAT_B3_BPS05_PRE_ANCHOR_ZERO_TRANSCRIPT_V2\\0"', "memcpy(out->fd_ledger,fd_ledger,32)",
    "memcpy(out->mount_ledger,mount_ledger,32)", "memcpy(out->entry_ledger,entry_ledger,32)",
    "memcpy(out->cgroup_ledger,cgroup_ledger,32)", "sha256_update(&hash,bootstrap_digest,32)",
    "sha256_update(&hash,out->entry_ledger,32)",
  ], "pre-anchor V2 zero proof");
  assertContains(validateFinal, [
    'json_object_get(&doc,zero_proof,"entryIdentityLedgerSha256")', "strcmp(value,entry_sha)!=0",
  ], "durable observation evidence binds the direct entry ledger");
  assertContains(validateNull, [
    'json_object_get(&doc,zero,"entryIdentityLedgerSha256")', "strcmp(value,entry_sha)!=0",
  ], "null-observation evidence binds the direct entry ledger");
  assertOrdered(success, [
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&watchdog_reply)",
    "derive_zero_proof_expectations(&anchor,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,observation_sha,&zero_expected)",
  ], "success proves direct zero before watchdog confirmation and durable evidence");
  assertOrdered(cleanup, [
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&cleanup_reply)",
  ], "abort proves the same direct zero before watchdog confirmation");
  for (const [name, expected] of [
    ["verify_workload_cgroup_zero", 3], ["finalize_and_inventory_terminal_fds", 3],
    ["verify_terminal_mount_absence", 3], ["verify_terminal_entry_absence", 3],
    ["build_direct_zero_confirmation_digest", 3],
  ]) assert.equal((source.match(new RegExp(`\\b${name}\\s*\\(`, "gu")) ?? []).length, expected, `${name}: definition plus success and abort calls`);
}

function validateChildPath(source) {
  const main = extractFunction(source, "main");
  const child = extractFunction(source, "child_exec_path");
  assertContains(main, [
    "CLONE_CLEAR_SIGHAND|CLONE_INTO_CGROUP|CLONE_NEWIPC|CLONE_NEWNET|CLONE_NEWNS|CLONE_NEWPID|CLONE_NEWUSER|CLONE_NEWUTS|CLONE_PIDFD",
    "clone_args.pidfd=(uint64_t)(uintptr_t)&pidfd",
    "clone_args.cgroup=BPS05_FD_WORKLOAD_CGROUP_ROOT",
    "SYS_clone3",
    "close(control[1])",
    "close(handshake[1])",
    "close(stdout_pipe[1])",
    "close(stderr_pipe[1])",
    "close(bundle_parent)",
    "control[1]=handshake[1]=stdout_pipe[1]=stderr_pipe[1]=bundle_parent=-1",
  ], "clone3 and parent ownership");
  assertOrdered(child, [
    "fcntl(BPS05_FD_NODE_EXEC_FOR_CHILD,F_GETFD)",
    "close(control_parent)",
    "close(handshake_parent)",
    '"BPS05MAP"',
    "MS_REC|MS_PRIVATE",
    '"BPS05RDY"',
    '"BPS05ACK"',
    "child_verify_execution_projection",
    "child_peek_request",
    '"BPS05PEK"',
    '"BPS05LCH"',
    "dup3(BPS05_FD_NODE_EXECUTABLE,BPS05_FD_NODE_EXEC_FOR_CHILD,O_CLOEXEC)",
    "KCMP_FILE",
    "close(BPS05_FD_NODE_EXECUTABLE)",
    "verify_static_node_elf(BPS05_FD_NODE_EXEC_FOR_CHILD",
    "establish_child_namespace_and_authority",
    '"BPS05DRP"',
    '"BPS05GO!"',
    "move_fd_exact(BPS05_FD_LAUNCHER_SOURCE,0)",
    "move_fd_exact(control_child,3)",
    "move_fd_exact(bundle_fd,4)",
    "SYS_close_range,5,14,CLOSE_RANGE_UNSHARE",
    "child_fd_map_exact()",
    "install_child_seccomp",
    "SYS_execveat,BPS05_FD_NODE_EXEC_FOR_CHILD,\"\"",
    "AT_EMPTY_PATH",
  ], "child MAP/READY/PEEK/LATCH/DROP/GO/exec flow");
  assertContains(extractFunction(source, "establish_child_namespace_and_authority"), [
    "install_empty_landlock_ruleset()", "setresgid", "setresuid", "SYS_capset", "PR_SET_DUMPABLE,0",
  ], "irreversible child authority drop");
}

function validateCustodySource(source) {
  validateDirectZeroEvidence(source);
  const main = extractFunction(source, "main");
  const exchangeGate = extractFunction(source, "verify_endpoint_for_control_exchange");
  const exchange = extractFunction(source, "authenticated_control_exchange");
  const observation = extractFunction(source, "persist_observation_before_teardown");
  const artifact = extractFunction(source, "parse_durable_artifact");
  const observerTerminal = extractFunction(source, "require_observer_terminal_after_observation");
  const closeTemporaries = extractFunction(source, "close_execution_temporaries_before_zero");
  const deriveZero = extractFunction(source, "derive_zero_proof_expectations");
  const finalEvidence = extractFunction(source, "validate_final_evidence_instance");
  const teardown = extractFunction(source, "persist_teardown_after_zero");
  assertOrdered(main, [
    "wait_child_terminal_and_drain(pidfd,stdout_pipe[0],stderr_pipe[0],&terminal)",
    "watchdog_rpc(WD_CONSUME_CAS,0,0,final_digest,&watchdog_reply)",
    "watchdog_rpc(WD_TERMINAL_HOLD,0,0,phase_digest,&watchdog_reply)",
    "persist_observation_before_teardown(&bootstrap,&anchor_doc,&anchor,pregraph_digest,phase_digest,final_digest,&observation_bytes,&observation_length,observation_sha,&observation_artifact)",
    "observation_durable=true",
    "require_observer_terminal_after_observation(&bootstrap)",
    "close_execution_temporaries_before_zero(&control[0],&stdout_pipe[0],&stderr_pipe[0],&pidfd,temporary_fd_ledger)",
    "watchdog_rpc(WD_BEGIN_TEARDOWN,0,0,phase_digest,&watchdog_reply)",
    "timer_first_wait(BPS05_FD_CGROUP_KILL,POLLOUT)",
    "write(BPS05_FD_CGROUP_KILL,kill_value",
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&watchdog_reply)",
    "zero_confirmed=true",
    "derive_zero_proof_expectations(&anchor,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,observation_sha,&zero_expected)",
    'persist_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,observation_bytes,observation_length,observation_sha,&observation_artifact,&zero_expected,"OBSERVATION_DURABLE_THEN_ZERO_HOLD","NONE")',
    "final_evidence_durable=true",
  ], "authoritative A then zero then B main flow");
  for (const [name, expected] of [
    ["persist_observation_before_teardown", 2],
    ["require_observer_terminal_after_observation", 4],
    ["close_execution_temporaries_before_zero", 2],
    ["close_failure_temporaries_identity_led", 2],
    ["finish_failure_pidfd_identity_ledger", 2],
    ["validate_final_evidence_instance", 2],
    ["validate_null_observation_final_evidence", 2],
    ["persist_teardown_after_zero", 3],
    ["persist_null_observation_teardown_after_zero", 2],
    ["terminate_observer_without_observation", 2],
    ["derive_zero_proof_expectations", 3],
    ["authenticated_control_exchange", 7],
  ]) {
    assert.equal((source.match(new RegExp(`\\b${name}\\s*\\(`, "gu")) ?? []).length, expected, `${name}: exact definition/call count`);
  }
  assertContains(exchangeGate, [
    "bps05_full_control_plane_verified", "verify_external_endpoint(&bootstrap->endpoints[endpoint_index],observed)",
    "validate_peer_no_exec_receipt(&bootstrap->endpoints[endpoint_index],bootstrap)",
    "bps05_cleanup_plane_verified", "endpoint_index==2||endpoint_index==3",
    "verify_control_endpoint_preauth(&bootstrap->endpoints[endpoint_index],observed)",
  ], "full-plane replay or asserted observer/custodian cleanup endpoint gate");
  assertContains(exchange, [
    "endpoint_index>=4", "bootstrap->endpoints[endpoint_index]", "verify_endpoint_for_control_exchange(bootstrap,endpoint_index,&before)",
    "ledger_charge_io(request_length)",
    "timer_first_wait(endpoint->fd,POLLOUT)", "MSG_DONTWAIT|MSG_NOSIGNAL", "ledger_charge_io(BPS05_MAX_EVIDENCE_PACKET+1)",
    "timer_first_wait(endpoint->fd,POLLIN)", "MSG_DONTWAIT|MSG_TRUNC", "validate_endpoint_sender_control(endpoint,&incoming_message)",
    "verify_endpoint_for_control_exchange(bootstrap,endpoint_index,&after)", "before.peer.pid!=after.peer.pid", "before.identity.st_dev!=after.identity.st_dev",
    "before.identity.st_ino!=after.identity.st_ino", "strcmp(before.ofd_sha256,after.ofd_sha256)!=0",
    "strcmp(before.peer_security_label_sha256,after.peer_security_label_sha256)!=0",
  ], "authenticated external control exchange");
  assertOrdered(observation, [
    'handoff_domain[]="IAT_B3_BPS05_OBSERVER_HANDOFF_V2\\0"',
    "anchor->anchor_sha,result_sha,terminal_sha,final_sha",
    '\\"authority\\":\\"NONE\\"',
    '\\"decision\\":\\"HOLD\\"',
    '\\"terminalTranscriptSha256\\":\\"%s\\"',
    "authenticated_control_exchange(bootstrap,2",
    "validate_observation_receipt_bytes",
    '\\"phase\\":\\"PERSIST_OBSERVATION_BEFORE_TEARDOWN\\"',
    "authenticated_control_exchange(bootstrap,3",
    '"OBSERVATION_DURABLE_REOPENED"',
    'parse_durable_artifact(&ack_doc,nested_object(&ack_doc,0,"artifact"),"OBSERVATION"',
  ], "observer A then custodian durable ACK");
  assertContains(artifact, [
    '"destinationParentIdentitySha256"', '"destinationPath"', '"dev"', '"ino"', '"mountId"', '"handleSha256"', '"generation"',
    '"oExcl"', '"singleWrite"', '"fsyncFile"', '"fsyncParent"', '"renameNoReplace"', '"reopenedSameObject"', '"writeOnce"',
    'json_is_true(doc,json_object_get(doc,token,"oExcl"))', 'json_is_true(doc,json_object_get(doc,token,"singleWrite"))',
    'json_is_true(doc,json_object_get(doc,token,"fsyncFile"))', 'json_is_true(doc,json_object_get(doc,token,"fsyncParent"))',
    'json_is_true(doc,json_object_get(doc,token,"renameNoReplace"))', 'json_is_true(doc,json_object_get(doc,token,"reopenedSameObject"))',
    'json_is_true(doc,json_object_get(doc,token,"writeOnce"))',
    'strcmp(mode,"0440")', 'strcmp(writer,"EVIDENCE_CUSTODIAN")', "custodian->peer_uid", "custodian->peer_gid",
    "anchor->custodian_sink_identity", "out->ino==0", "out->mount_id==0", "out->generation==0",
    'strcmp(expected_artifact,"OBSERVATION")==0?"observation":"teardown"',
  ], "durable artifact exact identity and persistence flags");
  assertOrdered(observerTerminal, [
    "BPS05_FD_ABSOLUTE_TIMER", "observer->peer_pidfd", "poll(watched,2,-1)", "watched[0].revents", "watched[1].revents",
    "fstat(observer->peer_pidfd", "observer->peer_pidfd_dev", "observer->peer_pidfd_ino",
    "derive_socket_ofd_identity(BPS05_FD_OBSERVER_RECEIPT,endpoint_ofd,&endpoint_stat)", "strcmp(endpoint_ofd,observer->ofd_sha256)!=0",
    'domain[]="IAT_B3_BPS05_IDENTITY_CLOSED_OBSERVER_ENDPOINT_V1\\0"', "endpoint_stat.st_dev", "endpoint_stat.st_ino",
    "endpoint_stat.st_mode&S_IFMT", "endpoint_stat.st_nlink", "sha256_update(&hash,endpoint_ofd,64)",
    "close(BPS05_FD_OBSERVER_RECEIPT)", "memcpy(observer_close_identity,digest", "observer_close_identity_initialized=true",
  ], "observer terminal by pidfd before teardown");
  assertContains(closeTemporaries, [
    "control_parent", "stdout_read", "stderr_read", "child_pidfd", "fd_ledger[32]",
    'domain[]="IAT_B3_BPS05_TEMPORARY_FD_IDENTITY_LEDGER_V1\\0"', "fstat(*items[i],&st)",
    "fcntl(*items[i],F_GETFL)", "fcntl(*items[i],F_GETFD)", "close(*items[i])", "*items[i]=-1", "sha256_final(&hash,fd_ledger)",
  ], "execution endpoint identity ledger and cleanup before zero");
  assertContains(deriveZero, [
    'zero_domain[]="IAT_B3_BPS05_ZERO_PROOF_TRANSCRIPT_V3\\0"', "out->fd_ledger", "out->mount_ledger",
    "out->entry_ledger", "out->cgroup_ledger", "watchdog_prior_receipt", "phase_digest", "anchor->anchor_sha", "observation_sha",
  ], "direct-observation-grounded zero proof transcript");
  assertContains(finalEvidence, [
    "validate_instance_against_schema(schema_bytes,schema_length,evidence,evidence_length,&doc)",
    "observationReceipt", "teardownReceipt", "custodianEnvelope", "finalComposite",
    "entryIdentityLedgerSha256", "strcmp(value,entry_sha)!=0",
    "observation_length!=token_length+1", "memcmp(doc.bytes+doc.tokens[observation_token].start,observation,token_length)!=0",
    '"IAT_B3_BPS05_OBSERVATION_RECEIPT_V1"', '"IAT_B3_BPS05_TEARDOWN_RECEIPT_V1"', "strcmp(observed_observation_sha,observation_sha)!=0",
    "expected_terminal_cas", 'strcmp(value,expected_terminal_cas)', 'strcmp(value,"HOLD")', 'strcmp(value,"NONE")',
    'strcmp(value,"OBSERVATION_THEN_TEARDOWN")', "allCopyAndReopenReadsCharged", "teardownReceiptSha256", "strcmp(value,teardown_sha)!=0",
    'parse_durable_artifact(&doc,nested_object(&doc,envelope,"observationArtifact"),"OBSERVATION"',
    'parse_durable_artifact(&doc,nested_object(&doc,envelope,"teardownArtifact"),"TEARDOWN"',
    "teardown_artifact.dev==observed_artifact.dev&&teardown_artifact.ino==observed_artifact.ino",
    "teardown_artifact.generation<=observed_artifact.generation",
  ], "final A/B composite anti-alias and generation binding");
  assertOrdered(teardown, [
    "if(!zero_expected||!terminal_cas||!failure_point)", '\\"failurePoint\\"', 'strcmp(failure_point,"NONE")==0?tb_puts(&request,"null")',
    '\\"observationArtifactGeneration\\"', '\\"observationReceiptSha256\\"', '\\"phase\\":\\"PERSIST_TEARDOWN_AFTER_ZERO\\"',
    '\\"entryIdentityLedgerSha256\\":\\"%s\\"', '\\"terminalCas\\":\\"%s\\"', '\\"state\\":\\"ZERO\\"', '\\"zeroProofSha256\\"',
    "authenticated_control_exchange(bootstrap,3", "validate_final_evidence_instance",
  ], "durable teardown B request and schema validation");
}

function validateFailureCleanup(source) {
  validateDirectZeroEvidence(source);
  const { cleanup } = extractMainCleanup(source);
  const killReap = extractFunction(source, "kill_reap_identity");
  const terminateObserver = extractFunction(source, "terminate_observer_without_observation");
  const closeFailure = extractFunction(source, "close_failure_temporaries_identity_led");
  const finishPidfdLedger = extractFunction(source, "finish_failure_pidfd_identity_ledger");
  const verifyZero = extractFunction(source, "verify_workload_cgroup_zero");
  const validateNull = extractFunction(source, "validate_null_observation_final_evidence");
  const persistNull = extractFunction(source, "persist_null_observation_teardown_after_zero");
  assertContains(source, [
    "WD_ABORT_TO_TERMINAL_HOLD = 10",
    "case WD_ABORT_TO_TERMINAL_HOLD: return 5",
    "BPS05_CLEANUP_EVIDENCE_FAILURE_EXIT=79",
  ], "atomic cleanup state and distinct evidence-failure exit");
  assertOrdered(cleanup, [
    "bps05_teardown_timer_selected=true",
    "watchdog_rpc(WD_ABORT_TO_TERMINAL_HOLD,0,0,phase_digest,&cleanup_reply)",
    "require_observer_terminal_after_observation(&bootstrap)",
    "terminate_observer_without_observation(&bootstrap,phase_digest)",
    "close_failure_temporaries_identity_led(failure_dynamic,sizeof(failure_dynamic)/sizeof(failure_dynamic[0]),&pidfd,&preserved_pidfd,preliminary_fd_ledger)",
    "watchdog_rpc(WD_BEGIN_TEARDOWN,0,0,phase_digest,&cleanup_reply)",
    "ledger_charge_io(sizeof(failure_kill)-1)",
    "timer_first_wait(BPS05_FD_CGROUP_KILL,POLLOUT)",
    "write(BPS05_FD_CGROUP_KILL,failure_kill",
    "if(child>0&&!child_reaped)",
    "kill_reap_identity(pidfd)",
    "finish_failure_pidfd_identity_ledger(&pidfd,&preserved_pidfd,preliminary_fd_ledger,temporary_fd_ledger)",
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&cleanup_reply)",
    "zero_confirmed=true",
    'derive_zero_proof_expectations(&anchor,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,observation_durable?observation_sha:"",&zero_expected)',
    'persist_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,observation_bytes,observation_length,observation_sha,&observation_artifact,&zero_expected,"FAILURE_AFTER_OBSERVATION_ZERO_HOLD","NATIVE_FAILURE_AFTER_OBSERVATION")',
    'persist_null_observation_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,&zero_expected,"NATIVE_FAILURE_BEFORE_OBSERVATION")',
    "if(persistence_rc!=0)cleanup_ok=false;else final_evidence_durable=true",
    "if(close(*residual_dynamic[i])!=0)cleanup_ok=false",
    "return cleanup_ok&&final_evidence_durable?BPS05_SOURCE_HOLD_EXIT:BPS05_CLEANUP_EVIDENCE_FAILURE_EXIT",
  ], "atomic failure-to-zero-to-durable-B cleanup flow");
  assertContains(cleanup, [
    "watchdog_armed&&!final_evidence_durable&&!bps05_cleanup_plane_verified", "watchdog_armed&&!final_evidence_durable&&bps05_cleanup_plane_verified",
    "watchdog_current_state<5", "watchdog_current_state!=5",
    "watchdog_current_state>7",
    "if(bps05_cleanup_plane_verified)",
    "if(observation_durable&&!observer_terminal){if(require_observer_terminal_after_observation(&bootstrap)",
    "else if(!observation_durable&&!observer_terminal){if(terminate_observer_without_observation(&bootstrap,phase_digest)",
    "watchdog_current_state==5", "watchdog_current_state!=6", "watchdog_current_state==6",
    "watchdog_current_state!=7", "watchdog_current_state==7", "zero_confirmed&&bootstrap_ready&&bps05_cleanup_plane_verified&&observer_terminal", "if(anchor_ready)",
  ], "checked cleanup state arbitration and evidence prerequisites");
  assert.doesNotMatch(cleanup, /(?:if\s*\(|&&)\s*control_plane_ready\b/u, "post-assert full-plane failure cannot disable asserted cleanup");
  assert.doesNotMatch(cleanup, /\bbps05_full_control_plane_verified\b/u, "cleanup does not depend on the later full-plane commit");
  assert.doesNotMatch(cleanup, /\(void\)\s*(?:watchdog_rpc|kill_reap_identity|write|close)\s*\(/u, "cleanup never suppresses an operation failure");
  assert.doesNotMatch(cleanup, /if\s*\(verify_workload_cgroup_zero\(\)==0\)/u, "zero is a mandatory result, not a best-effort side effect");
  assertContains(killReap, [
    "fstat(pidfd,&before)", "signal_rc", "SYS_pidfd_send_signal", "SIGKILL", "signal_error!=ESRCH",
    "bps05_teardown_timer_selected?BPS05_FD_ABSOLUTE_TEARDOWN_TIMER:BPS05_FD_ABSOLUTE_TIMER",
    "poll(watched,2,-1)", "watched[0].revents", "watched[1].revents", "P_PIDFD", "WEXITED|WNOWAIT", "si_code",
    "CLD_EXITED", "CLD_KILLED", "CLD_DUMPED", "reaped.si_pid!=observed.si_pid", "reaped.si_code!=observed.si_code",
    "reaped.si_status!=observed.si_status", "fstat(pidfd,&after)", "before.st_dev!=after.st_dev", "before.st_ino!=after.st_ino",
  ], "pidfd-bound terminal reap");
  assert.doesNotMatch(killReap, /\(void\)\s*syscall\s*\(SYS_pidfd_send_signal/u, "pidfd signal delivery is never ignored");
  assertContains(terminateObserver, [
    '\\"observationReceipt\\":null', '\\"phase\\":\\"ABORT_WITHOUT_OBSERVATION\\"', "authenticated_control_exchange(bootstrap,2",
    'strcmp(value,"ABORTED_WITHOUT_OBSERVATION")', "json_is_null", 'strcmp(value,"HOLD")', 'strcmp(value,"NONE")',
    "require_observer_terminal_after_observation(bootstrap)",
  ], "authenticated null-observation termination");
  assertContains(closeFailure, [
    'domain[]="IAT_B3_BPS05_FAILURE_TEMPORARY_FD_IDENTITY_LEDGER_V2\\0"', "preserved_pidfd", "preserved->present=true",
    "items[i]==preserved_pidfd", "fstat(*items[i],&st)",
    "fcntl(*items[i],F_GETFL)", "fcntl(*items[i],F_GETFD)", "close(*items[i])", "*items[i]=-1",
    "wire_put_u64(encoded+8,UINT64_MAX)", "sha256_final(&hash,preliminary_ledger)",
  ], "identity-led failure descriptor closure preserves the child pidfd");
  assertContains(finishPidfdLedger, [
    "preserved->present", "*pidfd!=preserved->fd", "fstat(*pidfd,&st)", "st.st_dev!=preserved->dev",
    "st.st_ino!=preserved->ino", "flags!=preserved->flags", "fdflags!=preserved->fdflags", "close(*pidfd)", "*pidfd=-1",
    'domain[]="IAT_B3_BPS05_FAILURE_TEMPORARY_FD_IDENTITY_LEDGER_FINAL_V1\\0"',
    "sha256_update(&hash,preliminary,32)", "sha256_final(&hash,final_ledger)",
  ], "post-terminal same-pidfd ledger finalization");
  assertContains(verifyZero, [
    "read_cgroup_events_snapshot(&first", "read_cgroup_events_snapshot(&second",
    'strstr((char*)first,"populated 0\\n")', 'strstr((char*)first,"populated 1\\n")==NULL',
    'domain[]="IAT_B3_BPS05_DIRECT_CGROUP_ZERO_LEDGER_V1\\0"',
  ], "true same-object cgroup-zero proof");
  assertContains(validateNull, [
    "validate_instance_against_schema", "json_is_null(&doc,observation)", "watchdogZeroTranscriptSha256",
    "fdIdentityLedgerSha256", "mountIdentityLedgerSha256", "entryIdentityLedgerSha256", "cgroupIdentityLedgerSha256", "outerWatchdogObservedZero",
    'strcmp(value,expected_terminal_cas)', 'strcmp(value,"HOLD")', 'strcmp(value,"NONE")', "observationAbsenceVerified",
    "availableArtifactsReplayed", "json_is_null(&doc,json_object_get(&doc,envelope,\"observationArtifact\"))",
    'strcmp(value,"NO_OBSERVATION_THEN_TEARDOWN")',
    'parse_durable_artifact(&doc,nested_object(&doc,envelope,"teardownArtifact"),"TEARDOWN"',
  ], "strict null-A durable-B final evidence validation");
  assertOrdered(persistNull, [
    "if(!expected_zero||!failure_point||!*failure_point)", '\\"decision\\":\\"HOLD\\"', '\\"observationReceiptSha256\\":null',
    '\\"phase\\":\\"PERSIST_FAILURE_TEARDOWN_AFTER_ZERO\\"', '\\"entryIdentityLedgerSha256\\":\\"%s\\"', '\\"terminalCas\\":\\"FAILURE_BEFORE_OBSERVATION_ZERO_HOLD\\"',
    "authenticated_control_exchange(bootstrap,3", "validate_null_observation_final_evidence",
  ], "custodian role 3 persists schema-validated null-A B");
}

function validatePreAnchorFailure(source) {
  const { cleanup } = extractMainCleanup(source);
  const derive = extractFunction(source, "derive_pre_anchor_zero_proof_expectations");
  const persist = extractFunction(source, "persist_pre_anchor_failure_teardown_after_zero");
  assertContains(derive, [
    'zero_domain[]="IAT_B3_BPS05_PRE_ANCHOR_ZERO_TRANSCRIPT_V2\\0"', "sha256_update(&hash,bootstrap_digest,32)", "fd_ledger", "mount_ledger",
    "entry_ledger", "cgroup_ledger", "memcpy(out->entry_ledger,entry_ledger,32)",
    "sha256_update(&hash,out->entry_ledger,32)", "watchdog_prior_receipt", "phase_digest",
  ], "pre-anchor zero transcript direct observed preimages");
  assertOrdered(persist, [
    "hex_encode(bootstrap_digest,32,bootstrap_sha)", "hex_encode(expected_zero->zero_transcript,32,zero_sha)",
    "hex_encode(expected_zero->fd_ledger,32,fd_sha)", "hex_encode(expected_zero->mount_ledger,32,mount_sha)", "hex_encode(expected_zero->entry_ledger,32,entry_sha)",
    "hex_encode(expected_zero->cgroup_ledger,32,cgroup_sha)", "hex_encode(watchdog_prior_receipt,32,watchdog_receipt)",
    '\\"bootstrapIdentity\\":{\\"byteLength\\":\\"%llu\\",\\"sha256\\":\\"%s\\"}',
    '\\"decision\\":\\"HOLD\\"', '\\"observationReceipt\\":null', '\\"phase\\":\\"PERSIST_PRE_ANCHOR_FAILURE_AFTER_ZERO\\"',
    '\\"prearmSessionId\\":\\"%s\\"', '\\"runId\\":\\"%s\\"',
    '\\"schema\\":\\"iat-b3-post-checkpoint-prelaunch-supervisor-pre-anchor-failure-custodian-request/v1\\"',
    '\\"terminalCas\\":\\"PRE_ANCHOR_FAILURE_ZERO_HOLD\\"', '\\"state\\":\\"ZERO\\"',
    "authenticated_control_exchange(bootstrap,3", "validate_instance_against_schema(schema_bytes,schema_length,evidence,evidence_length,&doc)",
    "json_object_exact_keys(&doc,0,root_keys", "json_object_exact_keys(&doc,bootstrap_identity,bootstrap_keys",
    "json_object_exact_keys(&doc,teardown,teardown_keys", "json_object_exact_keys(&doc,resource,resource_keys",
    'strcmp(value,"iat-b3-post-checkpoint-prelaunch-supervisor-pre-anchor-failure-evidence/v1")',
    "strcmp(value,bootstrap->run_id)", "strcmp(value,bootstrap->prearm_session_id)", 'strcmp(value,"HOLD")', 'strcmp(value,"NONE")',
    "json_is_null(&doc,json_object_get(&doc,0,\"observationReceipt\"))", "strcmp(value,bootstrap_sha)",
    "claimed_length==bootstrap_length", 'strcmp(value,"PRE_ANCHOR_FAILURE_ZERO_HOLD")', "strcmp(value,zero_sha)",
    "json_is_null(&doc,json_object_get(&doc,teardown,\"observationReceiptSha256\"))",
    "strcmp(value,fd_sha)", "strcmp(value,mount_sha)", "strcmp(value,entry_sha)", "strcmp(value,cgroup_sha)",
    'hash_canonical_receipt_token("IAT_B3_BPS05_PRE_ANCHOR_TEARDOWN_RECEIPT_V1"',
    "memcpy(synthetic_anchor.run_id,bootstrap->run_id", "memcpy(synthetic_anchor.custodian_sink_identity,bootstrap->roots[9].ofd_sha256,65)",
    'parse_durable_artifact(&doc,nested_object(&doc,0,"artifact"),"TEARDOWN"',
  ], "strict pre-anchor custodian request and durable receipt validation");
  assertContains(persist, [
    'json_copy_string(&doc,json_object_get(&doc,bootstrap_identity,"sha256"),value,sizeof(value))&&strcmp(value,bootstrap_sha)==0&&json_copy_u64',
    'json_copy_string(&doc,json_object_get(&doc,teardown,"bootstrapSha256"),value,sizeof(value))&&strcmp(value,bootstrap_sha)==0&&json_copy_string',
    'json_copy_string(&doc,json_object_get(&doc,0,"prearmSessionId"),value,sizeof(value))&&strcmp(value,bootstrap->prearm_session_id)==0&&json_copy_string',
    'json_copy_string(&doc,json_object_get(&doc,teardown,"prearmSessionId"),value,sizeof(value))&&strcmp(value,bootstrap->prearm_session_id)==0&&json_copy_string',
    'json_copy_string(&doc,json_object_get(&doc,0,"failurePoint"),value,sizeof(value))&&strcmp(value,failure_point)==0',
    'json_copy_string(&doc,json_object_get(&doc,teardown,"failurePoint"),value,sizeof(value))&&strcmp(value,failure_point)==0',
    'json_copy_string(&doc,json_object_get(&doc,resource,"entryIdentityLedgerSha256"),value,sizeof(value))&&strcmp(value,entry_sha)==0',
  ], "root and teardown receipt repeat the exact external bootstrap/failure bindings");
  assertOrdered(cleanup, [
    "zero_confirmed&&bootstrap_ready&&bps05_cleanup_plane_verified&&observer_terminal", "if(anchor_ready)",
    "else if(!observation_durable)",
    "derive_pre_anchor_zero_proof_expectations(bootstrap_digest,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,&zero_expected)",
    'persist_pre_anchor_failure_teardown_after_zero(&bootstrap,evidence_schema_bytes,evidence_schema_length,bootstrap_digest,bootstrap_length,&zero_expected,"NATIVE_FAILURE_BEFORE_RUNTIME_ANCHOR")',
    "if(persistence_rc!=0)cleanup_ok=false;else final_evidence_durable=true",
  ], "pre-anchor failure is reachable only after authenticated zero and before anchor readiness");
  assert.equal((source.match(/\bderive_pre_anchor_zero_proof_expectations\s*\(/gu) ?? []).length, 2, "pre-anchor derivation definition and live call");
  assert.equal((source.match(/\bpersist_pre_anchor_failure_teardown_after_zero\s*\(/gu) ?? []).length, 2, "pre-anchor persistence definition and live call");
}

test("the exact six BPS05 source paths are regular LF-only source, schema, launcher, and hostile-test bytes", () => {
  assert.deepEqual(Object.keys(PATHS), ["bootstrap", "anchor", "evidence", "native", "launcher", "test"]);
  for (const [name, path] of Object.entries(PATHS)) assertLfRegular(path, BYTES[name], name);
  assert.match(sha256(BYTES.native), /^[0-9a-f]{64}$/u);
  assert.match(sha256(BYTES.launcher), /^[0-9a-f]{64}$/u);
});

test("all three runtime schemas are recursively closed and the native validator implements their strict vocabulary", () => {
  for (const [name, schema] of Object.entries(SCHEMA)) assertRecursivelyClosedSchema(schema, `$${name}`);
  assert.deepEqual(Object.keys(SCHEMA.bootstrap.properties), SCHEMA.bootstrap.required);
  assert.deepEqual(Object.keys(SCHEMA.anchor.properties), SCHEMA.anchor.required);
  assert.deepEqual(SCHEMA.evidence.required, ["schema", "runId"]);
  assert.equal(SCHEMA.evidence.additionalProperties, false);
  assert.equal(SCHEMA.evidence.oneOf.length, 3);
  assert.deepEqual(SCHEMA.evidence.oneOf[0].required, ["schema", "runId", "supervisorReleaseId", "bootId", "sessionId", "anchorIdentity", "nodeStartupClosureIdentity", "observationReceipt", "teardownReceipt", "custodianEnvelope", "finalComposite", "sourceDesignTruth"]);
  assert.deepEqual(SCHEMA.evidence.oneOf[1].required, SCHEMA.evidence.oneOf[0].required);
  assert.deepEqual(SCHEMA.evidence.oneOf[2].required, ["schema", "runId", "prearmSessionId", "bootstrapIdentity", "observationReceipt", "teardownReceipt", "artifact", "failurePoint", "decision", "authority"]);
  assert.equal(SCHEMA.evidence.oneOf[2].properties.schema.const, "iat-b3-post-checkpoint-prelaunch-supervisor-pre-anchor-failure-evidence/v1");
  assert.equal(SCHEMA.evidence.oneOf[2].properties.observationReceipt.const, null);
  const validator = extractFunction(SOURCE.native, "schema_validate_node");
  assertContains(validator, ["$ref", "allOf", "oneOf", "not", "type", "const", "minimum", "maximum", "enum", "schema_validate_object", "schema_validate_array", "minLength", "maxLength", "pattern"], "schema validator vocabulary");
  const main = extractFunction(SOURCE.native, "main");
  assertContains(main, [
    "validate_instance_against_schema(bootstrap_schema_bytes,bootstrap_schema_length,bootstrap_bytes,bootstrap_length,&bootstrap_doc)",
    "parse_bootstrap(&bootstrap_doc,&bootstrap)",
    "validate_instance_against_schema(anchor_schema_bytes,anchor_schema_length,anchor_bytes,anchor_length,&anchor_doc)",
    "parse_anchor_view(&anchor_doc,anchor_digest,anchor_length,&anchor)",
    "validate_anchor_cross_bindings",
    "validate_anchor_runtime_response",
    "validate_anchor_principal_bindings",
  ], "schema/manual parity on live control flow");
});

test("source truth is permanently source-only HOLD and never substitutes for runtime evidence", () => {
  const truthRows = [SCHEMA.bootstrap.$defs.sourceTruth, SCHEMA.anchor.$defs.sourceTruth, SCHEMA.evidence.$defs.sourceDesignTruth];
  for (const truth of truthRows) {
    assert.equal(truth.additionalProperties, false);
    assert.equal(truth.properties.sourcePresent.const, true);
    assert.equal(truth.properties.decision.const, "HOLD");
    assert.equal(truth.properties.authority.const, "NONE");
    for (const [key, rule] of Object.entries(truth.properties)) {
      if (!["sourcePresent", "decision", "authority"].includes(key)) assert.equal(rule.const, false, key);
    }
  }
  assertContains(SOURCE.native, [
    "BPS05_SOURCE_HOLD_EXIT=78", "BPS05_CLEANUP_EVIDENCE_FAILURE_EXIT=79",
    "return cleanup_ok&&final_evidence_durable?BPS05_SOURCE_HOLD_EXIT:BPS05_CLEANUP_EVIDENCE_FAILURE_EXIT",
  ], "native HOLD exit requires durable cleanup evidence");
  assert.doesNotMatch(SOURCE.native, /\breturn\s+0\s*;\s*\}\s*$/u);
  assertContains(SOURCE.launcher, [
    'decision: "HOLD"', 'authority: "NONE"', "toolchainAccepted: false", "k44Accepted: false", "receiptPresent: false", "packageGraphPending: true",
  ], "launcher pre-graph HOLD result");
  assert.doesNotMatch(SOURCE.launcher, /(?:toolchainAccepted|k44Accepted|receiptPresent|devnetAuthorized|gate8Go|releaseAuthorized|mainnetAuthorized)\s*:\s*true/u);
});

test("preauthorization isolates FDs, semantically replays cleanup inputs, then commits the exact watchdog receipt", () => {
  validatePreauthorization(SOURCE.native);
  assertMutationRejected(validatePreauthorization, SOURCE.native, "watchdog_rpc(WD_ASSERT_PREARMED,preauth.bytes", "watchdog_rpc(WD_CHARGE_READ,preauth.bytes", "prearm cannot be downgraded to a read charge");
  assertMutationRejected(validatePreauthorization, SOURCE.native, "unshare(CLONE_FILES)", "unshare(CLONE_FS)", "CLONE_FILES isolation is mandatory");
  assertMainSuccessSwapRejected(validatePreauthorization, SOURCE.native, "isolate_fd_table_and_signals()", "preauth_verify_and_commit_cleanup_semantics(&preauth,&bootstrap,initial_cgroup_empty)", "cleanup semantics cannot precede irreversible FD isolation");
  assertMainSuccessSwapRejected(validatePreauthorization, SOURCE.native, "preauth_final(&preauth,preauth_digest)", "watchdog_rpc(WD_ASSERT_PREARMED,preauth.bytes,preauth.entries,preauth_digest,&watchdog_reply)", "WD_ASSERT cannot precede the final asserted transcript");
  assertMainSuccessMutationRejected(validatePreauthorization, SOURCE.native, "bps05_cleanup_plane_verified=true", "bps05_cleanup_plane_verified=false", "cleanup latch requires the accepted exact WD_ASSERT receipt");
  assertMainSuccessMutationRejected(validatePreauthorization, SOURCE.native, "bps05_full_control_plane_verified=true", "bps05_full_control_plane_verified=false", "full control cannot commit before all eight checks pass");
  for (const [needle, replacement, label] of [
    ["for(size_t index=0;index<4&&rc==0;++index)if(strcmp", "for(size_t index=1;index<4&&rc==0;++index)if(strcmp", "semantic replay cannot omit the trusted invoker endpoint"],
    ['required_roles[4]={"TRUSTED_INVOKER","WATCHDOG","OBSERVER","EVIDENCE_CUSTODIAN"}', 'required_roles[4]={"WATCHDOG","TRUSTED_INVOKER","OBSERVER","EVIDENCE_CUSTODIAN"}', "endpoint roles cannot be swapped"],
    ["strcmp(bootstrap->endpoints[index].role,required_roles[index])!=0", "false", "endpoint role strings are mandatory"],
    ["observe_process_kernel_binding((pid_t)bootstrap->endpoints[index].peer_pid,&endpoint_kernel_after[index])", "observe_process_kernel_binding((pid_t)bootstrap->endpoints[index].peer_pid,&endpoint_kernel_before[index])", "each endpoint needs a distinct post-noexec kernel sample"],
    ["!process_kernel_binding_equal(&endpoint_kernel_before[index],&endpoint_kernel_after[index])", "false", "endpoint namespace and cgroup drift is rejected"],
    ["validate_peer_no_exec_receipt(&bootstrap->endpoints[index],bootstrap)", "verify_control_endpoint_preauth(&bootstrap->endpoints[index],&observed[index])", "semantic replay cannot replace TSYNC/no-exec evidence"],
    ["verify_supervisor_pidfd_identity(&bootstrap->supervisor_pidfd,self_start_before)", "true", "semantic replay cannot omit supervisor pidfd identity"],
    ["observe_process_executable(getpid(),self_exe_after", "observe_process_executable(getpid(),self_exe_before", "supervisor executable requires a distinct second sample"],
    ["observe_process_kernel_binding(getpid(),&self_kernel_after)", "observe_process_kernel_binding(getpid(),&self_kernel_before)", "supervisor namespaces and cgroup require a distinct second sample"],
    ["getuid()!=0||geteuid()!=0||getgid()!=0||getegid()!=0", "false", "supervisor real and effective UID/GID must all remain root"],
    ["process_in_workload_cgroup(&endpoint_kernel_before[index],bootstrap)", "false", "every external authority must remain outside the workload cgroup"],
    ["process_in_workload_cgroup(&self_kernel_before,bootstrap)", "false", "supervisor must remain outside the workload cgroup"],
    ["bootstrap->endpoints[1].peer_uid!=0||bootstrap->endpoints[1].peer_gid!=0", "false", "watchdog authority must be root"],
    ["bootstrap->endpoints[2].peer_uid==0||bootstrap->endpoints[2].peer_gid==0", "false", "observer authority cannot be root"],
    ["bootstrap->endpoints[3].peer_uid==0||bootstrap->endpoints[3].peer_gid==0", "false", "custodian authority cannot be root"],
    ["bootstrap->endpoints[2].peer_uid==bootstrap->endpoints[3].peer_uid&&bootstrap->endpoints[2].peer_gid==bootstrap->endpoints[3].peer_gid", "false", "observer and custodian cannot share authority"],
    ["outside_self_namespaces[]={0,2,4,5}", "outside_self_namespaces[]={0,2,4}", "custodian must differ in cgroup, mount, pid, and user namespaces"],
    ["strcmp(endpoint_kernel_before[3].cgroup_path,self_kernel_before.cgroup_path)==0", "false", "custodian cgroup must differ from supervisor"],
    ["expected->peer_pid==(uint64_t)getpid()", "false", "external endpoint PID cannot alias the supervisor"],
    ["expected->peer_pidfd_dev==bootstrap->supervisor_pidfd.dev", "false", "external pidfd object cannot alias the supervisor pidfd"],
    ["sha256_update(&proof_hash,expected->peer_executable_sha256,64)", "sha256_update(&proof_hash,expected->ofd_sha256,64)", "asserted proof cannot omit live executable identity"],
    ["sha256_update(&proof_hash,expected->peer_no_exec_task_set_sha256,64)", "sha256_update(&proof_hash,expected->peer_no_exec_receipt_sha256,64)", "asserted proof cannot omit the double-sampled task set"],
    ["sha256_update(&proof_hash,expected->peer_no_exec_filter_sha256,64)", "sha256_update(&proof_hash,expected->peer_no_exec_receipt_sha256,64)", "asserted proof cannot omit the TSYNC filter"],
    ["sha256_update(&proof_hash,expected->role,strlen(expected->role))", "sha256_update(&proof_hash,expected->ofd_sha256,64)", "asserted proof cannot omit exact endpoint roles"],
    ["sha256_update(&proof_hash,endpoint_kernel_before[index].namespace_digest,32)", "sha256_update(&proof_hash,endpoint_kernel_before[index].cgroup_digest,32)", "asserted proof cannot omit endpoint namespace identity"],
    ["wire_put_u64(self_row+56,(uint64_t)geteuid())", "wire_put_u64(self_row+56,(uint64_t)getuid())", "asserted proof cannot collapse effective UID into real UID"],
  ]) assertFunctionMutationRejected(validatePreauthorization, SOURCE.native, "preauth_verify_and_commit_cleanup_semantics", needle, replacement, label);
  const fullControlChecks = [
    "verify_absolute_timer_prearmed()", "verify_bootstrap_control_plane(&bootstrap,endpoints)",
    "validate_bootstrap_cross_bindings(&bootstrap_doc,&bootstrap)", "verify_runtime_source_manifest(&bootstrap)",
    "verify_all_fixed_roots(&bootstrap)", "verify_static_node_elf(BPS05_FD_NODE_EXECUTABLE,&bootstrap.node_identity)",
    "verify_root_protected_file_identity(&bootstrap.launcher_identity,false)", "validate_node_startup_receipt(&bootstrap_doc,&bootstrap)",
  ];
  fullControlChecks.forEach((step, index) => assertMainSuccessMutationRejected(
    validatePreauthorization,
    SOURCE.native,
    step,
    `BPS05_INJECTED_POST_ASSERT_FAILURE_${index}`,
    `post-assert control-plane failure ${index} must retain the common cleanup edge`,
  ));
});

test("WD_ASSERT commits complete fixed-width timer, endpoint, no-exec, and cleanup-root preimages", () => {
  validateAssertedCleanupTranscript(SOURCE.native);
  for (const [needle, replacement, label] of [
    ["unsigned char timer_row[192]", "unsigned char timer_row[191]", "timer transcript cannot lose its last byte"],
    ["memcpy(timer_row+128,teardown_ofd,64)", "memcpy(timer_row+128,teardown_ofd,63)", "teardown timer OFD cannot be truncated"],
    ["unsigned char row[328]", "unsigned char row[327]", "endpoint transcript cannot lose its last byte"],
    ["memcpy(row+264,expected->peer_no_exec_receipt_sha256,64)", "memcpy(row+264,expected->peer_no_exec_receipt_sha256,63)", "endpoint no-exec digest cannot be truncated"],
    ["preauth_record_fixed_file(transcript,&expected->peer_no_exec_receipt_file)!=0", "false", "raw no-exec receipt identity cannot be omitted"],
    ["unsigned char cgroup_row[312]", "unsigned char cgroup_row[311]", "cleanup-root transcript cannot lose its last byte"],
    ["memcpy(cgroup_row+88,bootstrap->proc_root_identity.identity_sha256,64)", "memcpy(cgroup_row+88,bootstrap->proc_root_identity.identity_sha256,63)", "proc-root identity cannot be truncated"],
    ["memcpy(cgroup_row+152,bootstrap->workload_cgroup_root_identity.identity_sha256,64)", "memcpy(cgroup_row+152,bootstrap->workload_cgroup_root_identity.identity_sha256,63)", "cgroup-root identity cannot be truncated"],
    ["memcpy(cgroup_row+216,bootstrap->cgroup_kill_identity.identity_sha256,64)", "memcpy(cgroup_row+216,bootstrap->cgroup_kill_identity.identity_sha256,63)", "cgroup-kill identity cannot be truncated"],
    ["memcpy(cgroup_row+280,cleanup_roots_digest,32)", "memcpy(cgroup_row+280,cleanup_roots_digest,31)", "cleanup-roots digest cannot be truncated"],
  ]) assertFunctionMutationRejected(validateAssertedCleanupTranscript, SOURCE.native, "preauth_record_kernel_control", needle, replacement, label);
});

test("WD_ASSERT binds an exact empty workload cgroup and the same state is replayed immediately before clone3", () => {
  validateInitialCgroupBarrier(SOURCE.native);
  for (const [functionName, needle, replacement, label] of [
    ["read_cgroup_control_snapshot", "BPS05_FD_WORKLOAD_CGROUP_ROOT", "AT_FDCWD", "cgroup controls cannot be path-recaptured outside the fixed root"],
    ["read_cgroup_control_snapshot", "fs.f_type==CGROUP2_SUPER_MAGIC", "true", "cgroup controls must prove cgroup2 object identity"],
    ["verify_workload_cgroup_initial_empty", 'read_cgroup_control_snapshot("cgroup.events",&events_first', 'read_cgroup_control_snapshot("cgroup.procs",&events_first', "initial events cannot be substituted with procs"],
    ["verify_workload_cgroup_initial_empty", 'read_cgroup_control_snapshot("cgroup.procs",&procs_first', 'read_cgroup_control_snapshot("cgroup.events",&procs_first', "initial procs cannot be substituted with events"],
    ["verify_workload_cgroup_initial_empty", "events_first_mount==bootstrap->workload_cgroup_root_identity.mount_id", "true", "events must stay on the bootstrap cgroup mount"],
    ["verify_workload_cgroup_initial_empty", "procs_first_mount==bootstrap->workload_cgroup_root_identity.mount_id", "true", "procs must stay on the bootstrap cgroup mount"],
    ["verify_workload_cgroup_initial_empty", "events_first_stat.st_ino==events_second_stat.st_ino", "true", "events object substitution between samples is rejected"],
    ["verify_workload_cgroup_initial_empty", "procs_first_stat.st_ino==procs_second_stat.st_ino", "true", "procs object substitution between samples is rejected"],
    ["verify_workload_cgroup_initial_empty", "memcmp(events_first,events_second,events_first_length)==0", "true", "events population drift between samples is rejected"],
    ["verify_workload_cgroup_initial_empty", "memcmp(procs_first,procs_second,procs_first_length)==0", "true", "procs population drift between samples is rejected"],
    ["verify_workload_cgroup_initial_empty", "procs_first_length==0", "procs_first_length>=0", "nonempty cgroup.procs is rejected before WD_ASSERT"],
    ["verify_workload_cgroup_initial_empty", 'strstr((char*)events_first,"populated 0\\n")!=NULL', "true", "populated-zero evidence is mandatory"],
    ["verify_workload_cgroup_initial_empty", 'strstr((char*)events_first,"populated 1\\n")==NULL', "true", "populated-one evidence is forbidden"],
    ["verify_workload_cgroup_initial_empty", "bootstrap->workload_cgroup_root_identity.ino", "bootstrap->proc_root_identity.ino", "empty transcript cannot substitute the proc root"],
    ["verify_workload_cgroup_initial_empty", "sha256_update(&hash,events_first,events_first_length)", "sha256_update(&hash,procs_first,procs_first_length)", "asserted transcript cannot omit exact events bytes"],
    ["verify_workload_cgroup_initial_empty", "sha256_update(&hash,procs_first,procs_first_length)", "sha256_update(&hash,events_first,events_first_length)", "asserted transcript cannot omit exact procs bytes"],
    ["preauth_verify_and_commit_cleanup_semantics", "sha256_update(&proof_hash,initial_cgroup_empty,32)", "sha256_update(&proof_hash,timer_bounds,32)", "WD_ASSERT proof must include the initial-empty digest"],
  ]) assertFunctionMutationRejected(validateInitialCgroupBarrier, SOURCE.native, functionName, needle, replacement, label);
  assertMainSuccessMutationRejected(validateInitialCgroupBarrier, SOURCE.native, "verify_workload_cgroup_initial_empty(&bootstrap,preclone_cgroup_empty)", "BPS05_SKIP_PRECLONE_EMPTY_REPLAY", "pre-clone empty replay cannot be skipped");
  assertMainSuccessMutationRejected(validateInitialCgroupBarrier, SOURCE.native, "memcmp(preclone_cgroup_empty,initial_cgroup_empty,32)!=0", "false", "population introduced after WD_ASSERT cannot be accepted");
  assertMainSuccessSwapRejected(validateInitialCgroupBarrier, SOURCE.native, "verify_workload_cgroup_initial_empty(&bootstrap,preclone_cgroup_empty)", "SYS_clone3", "clone3 cannot precede the same-cgroup empty replay");
});

test("authority projections and the authenticated cgroup admission lock close every writer and lineage race", () => {
  validateAuthorityAndAdmissionLock(SOURCE.native);
  for (const [functionName, needle, replacement, label] of [
    ["observe_peer_authority_projection", '"Groups:\\t"', '"Name:\\t"', "supplementary groups cannot be omitted"],
    ["observe_peer_authority_projection", '"CapBnd:\\t"', '"CapEff:\\t"', "capability bounding set cannot be aliased"],
    ["observe_peer_authority_projection", '"NoNewPrivs:\\t"', '"Seccomp:\\t"', "NNP cannot be omitted"],
    ["observe_peer_authority_projection", '"CoreDumping:\\t"', '"Seccomp_filters:\\t"', "dumpability cannot be omitted"],
    ["observe_peer_authority_projection", "sha256_update(&hash,expected->role,strlen(expected->role))", "sha256_update(&hash,lines[0],line_lengths[0])", "authority projection must be role-specific"],
    ["validate_peer_no_exec_receipt", "observe_peer_authority_projection(expected,authority_after)", "memcpy(authority_after,authority_before,sizeof(authority_after))", "authority projection requires a second live sample"],
    ["validate_peer_no_exec_receipt", "strcmp(authority_before,authority_after)!=0", "false", "authority drift cannot be accepted"],
    ["validate_peer_no_exec_receipt", 'json_is_true(&doc,json_object_get(&doc,body,"securebitsLocked"))', "true", "securebits lock must be receipt-bound"],
    ["validate_peer_no_exec_receipt", 'json_is_false(&doc,json_object_get(&doc,body,"dumpable"))', "true", "nondumpable state must be receipt-bound"],
    ["build_cgroup_admission_acquire_digest", "sha256_update(&hash,empty_digest,32)", "sha256_update(&hash,policy,32)", "acquire must bind the final empty observation"],
    ["build_cgroup_admission_acquire_digest", "sha256_update(&hash,bootstrap->prearm_session_id,strlen(bootstrap->prearm_session_id))", "sha256_update(&hash,bootstrap->run_id,strlen(bootstrap->run_id))", "acquire must bind the external prearm session nonce"],
    ["build_cgroup_admission_release_digest", "acquisition_receipt,32", "policy,32", "release must bind the authenticated acquisition receipt"],
    ["build_cgroup_admission_release_digest", "holder->start_ticks", "holder->pid", "release must bind PID plus start tuple"],
    ["build_cgroup_admission_release_digest", "binding->namespace_digest,32", "binding->cgroup_digest,32", "release must bind direct child namespaces"],
    ["build_cgroup_admission_final_release_digest", "zero_digest,32", "acquisition_receipt,32", "final release must bind directly observed zero"],
  ]) assertFunctionMutationRejected(validateAuthorityAndAdmissionLock, SOURCE.native, functionName, needle, replacement, label);
  for (const [needle, replacement, label] of [
    ["watchdog_rpc(WD_ACQUIRE_CGROUP_ADMISSION", "watchdog_rpc(WD_CHARGE_READ", "admission must use authenticated acquire"],
    ["bps05_workload_cgroup_admission_lock_held=true", "bps05_workload_cgroup_admission_lock_held=false", "lock cannot disappear before empty replay and clone"],
    ["if(!bps05_workload_cgroup_admission_lock_held||watchdog_rpc(WD_LATCH_CHILD_PEEK", "if(bps05_workload_cgroup_admission_lock_held||watchdog_rpc(WD_LATCH_CHILD_PEEK", "old lock polarity cannot reject the sealed execution path"],
    ["process_in_exact_workload_cgroup(&admitted_before,&bootstrap)", "true", "release requires direct child cgroup identity"],
    ["watchdog_rpc(WD_BIND_CGROUP_ADMISSION_CHILD", "watchdog_rpc(WD_CHARGE_READ", "admitted child identity must be authenticated before release"],
    ["watchdog_rpc(WD_RELEASE_CGROUP_ADMISSION", "watchdog_rpc(WD_CHARGE_READ", "admission must use authenticated release"],
  ]) assertMainSuccessMutationRejected(validateAuthorityAndAdmissionLock, SOURCE.native, needle, replacement, label);
  assertCleanupMutationRejected(validateAuthorityAndAdmissionLock, SOURCE.native, "else if(watchdog_current_state==7){if(bps05_workload_cgroup_admission_lock_held)", "else if(watchdog_current_state==7){if(false)", "state-7 recovery cannot strand or silently clear the admission lock");
});

test("FD11 bounds operation while independent same-object FD51 exclusively bounds success and failure teardown", () => {
  validateTimerStages(SOURCE.native);
  const controlPlane = SCHEMA.bootstrap.$defs.controlPlane;
  assert.deepEqual(controlPlane.required, Object.keys(controlPlane.properties));
  assert.deepEqual(controlPlane.required.slice(4, 8), ["absoluteTimer", "absoluteTeardownTimer", "workloadCgroupAdmissionLockPolicySha256", "supervisorPidfd"]);
  assert.deepEqual(controlPlane.properties.absoluteTimer.required, ["fd", "clockId", "absolute", "oneShot", "maximumOperationNanoseconds", "openFileDescriptionSha256"]);
  assert.equal(controlPlane.properties.absoluteTimer.properties.fd.const, 11);
  assert.equal(controlPlane.properties.absoluteTimer.properties.clockId.const, "CLOCK_MONOTONIC");
  assert.equal(controlPlane.properties.absoluteTimer.properties.maximumOperationNanoseconds.const, "150000000000");
  assert.deepEqual(controlPlane.properties.absoluteTeardownTimer.required, ["fd", "clockId", "absolute", "oneShot", "maximumTeardownNanoseconds", "startsAfterOperationDeadline", "openFileDescriptionSha256"]);
  assert.equal(controlPlane.properties.absoluteTeardownTimer.properties.fd.const, 51);
  assert.equal(controlPlane.properties.absoluteTeardownTimer.properties.clockId.const, "CLOCK_MONOTONIC");
  assert.equal(controlPlane.properties.absoluteTeardownTimer.properties.maximumTeardownNanoseconds.const, "30000000000");
  assert.equal(controlPlane.properties.absoluteTeardownTimer.properties.startsAfterOperationDeadline.const, true);
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "parse_bootstrap", 'nested_object(doc,plane,"absoluteTeardownTimer")', 'nested_object(doc,plane,"absoluteTimer")', "teardown timer cannot alias the operation descriptor field");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "derive_timer_ofd_identity", "CLOCK_MONOTONIC", "CLOCK_REALTIME", "timer identities are monotonic-clock bound");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "verify_bootstrap_control_plane", 'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER,"TEARDOWN",teardown_timer,true)', 'derive_timer_ofd_identity(BPS05_FD_ABSOLUTE_TIMER,"TEARDOWN",teardown_timer,true)', "FD51 cannot be recaptured from FD11");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "verify_bootstrap_control_plane", "operation_stat.st_dev==teardown_stat.st_dev&&operation_stat.st_ino==teardown_stat.st_ino", "false", "operation and teardown timer objects must be disjoint");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "sample_absolute_timer", "clock_gettime(CLOCK_MONOTONIC,&before)", "clock_gettime(CLOCK_REALTIME,&before)", "timer sampling cannot mix clock domains");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "sample_absolute_timer", 'strstr((char*)bytes,"clockid: 1\\n")', 'strstr((char*)bytes,"clockid: 0\\n")', "fdinfo must prove CLOCK_MONOTONIC");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "sample_absolute_timer", 'strstr((char*)bytes,"settime flags: 01\\n")', 'strstr((char*)bytes,"settime flags: 00\\n")', "fdinfo must prove absolute timer mode");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "verify_absolute_timer_prearmed", "sample_absolute_timer(BPS05_FD_ABSOLUTE_TEARDOWN_TIMER", "sample_absolute_timer(BPS05_FD_ABSOLUTE_TIMER", "teardown deadline must be sampled from FD51");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "validate_anchor_runtime_response", "teardown<bps05_teardown_deadline_lower", "false", "anchor teardown floor cannot drift from FD51");
  assertFunctionMutationRejected(validateTimerStages, SOURCE.native, "timer_first_wait", "bps05_teardown_timer_selected?BPS05_FD_ABSOLUTE_TEARDOWN_TIMER:BPS05_FD_ABSOLUTE_TIMER", "BPS05_FD_ABSOLUTE_TIMER", "bounded I/O cannot keep using FD11 after teardown selection");
  assertMainSuccessMutationRejected(validateTimerStages, SOURCE.native, "teardown_timer_verified=true", "teardown_timer_verified=false", "FD51 cannot be selected before direct verification commits");
  assertMainSuccessMutationRejected(validateTimerStages, SOURCE.native, "bps05_teardown_timer_selected=true", "bps05_teardown_timer_selected=false", "success cannot begin teardown on FD11");
  assertCleanupMutationRejected(validateTimerStages, SOURCE.native, "bps05_teardown_timer_selected=true", "bps05_teardown_timer_selected=false", "failure cannot begin atomic abort on FD11");
  assertCleanupMutationRejected(validateTimerStages, SOURCE.native, "watchdog_armed&&!final_evidence_durable&&bps05_cleanup_plane_verified", "watchdog_armed&&!final_evidence_durable", "cleanup cannot select FD51 without the asserted cleanup plane");
});

test("timer-first watchdog RPC, checked global ledger, one-use CAS, and immutable deadlines are live in main", () => {
  const rpc = extractFunction(SOURCE.native, "watchdog_rpc");
  const wait = extractFunction(SOURCE.native, "timer_first_wait");
  const main = extractFunction(SOURCE.native, "main");
  assertContains(rpc, ["timer_first_wait(BPS05_FD_WATCHDOG_RPC,POLLOUT)", "MSG_NOSIGNAL|MSG_DONTWAIT", "timer_first_wait(BPS05_FD_WATCHDOG_RPC,POLLIN)", "reply->timer_expired!=0", "BPS05_GLOBAL_BYTE_LIMIT", "BPS05_GLOBAL_ENTRY_LIMIT"], "watchdog RPC");
  assertOrdered(wait, ["BPS05_FD_ABSOLUTE_TIMER", ".fd=fd", "poll(pfd,2,-1)", "pfd[0].revents", "pfd[1].revents"], "timer priority");
  assertContains(SOURCE.native, [
    "BPS05_GLOBAL_BYTE_LIMIT = UINT64_C(2147483648)", "BPS05_GLOBAL_ENTRY_LIMIT = UINT64_C(100000)",
    "BPS05_OPERATION_NS = UINT64_C(150000000000)", "BPS05_TEARDOWN_NS = UINT64_C(30000000000)",
  ], "immutable limits");
  assertOrdered(main, ["watchdog_rpc(WD_RESERVE_CAS", "watchdog_rpc(WD_CHARGE_READ,bps05_child_reserved_bytes", "watchdog_rpc(WD_BIND_FINAL", "watchdog_rpc(WD_LATCH_CHILD_PEEK", "watchdog_rpc(WD_CONSUME_CAS", "watchdog_rpc(WD_TERMINAL_HOLD"], "one-use watchdog states");
});

test("native and launcher replay one exact 49-entry child reservation with bounded all-or-nothing reads", () => {
  validateNativeChildLedger(SOURCE.native);
  validateLauncherChildLedger(SOURCE.launcher);
  assertMutationRejected(
    validateNativeChildLedger,
    SOURCE.native,
    "bps05_child_reserved_entries=3+((uint64_t)BPS05_PACKAGE_COUNT*6)+1+2+1",
    "bps05_child_reserved_entries=3+((uint64_t)BPS05_PACKAGE_COUNT*6)+1+2",
    "48-entry native reservation cannot omit stdout",
  );
  assertMutationRejected(
    validateNativeChildLedger,
    SOURCE.native,
    "bps05_child_reserved_entries=3+((uint64_t)BPS05_PACKAGE_COUNT*6)+1+2+1",
    "bps05_child_reserved_entries=3+((uint64_t)BPS05_PACKAGE_COUNT*6)+1+2+2",
    "50-entry native reservation cannot invent a read",
  );
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readExact", "count !== chunk.length", "count < 0", "short fd4 reads cannot be accepted");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readExact", "Math.min(MAX_CHUNK_BYTES, remaining)", "remaining", "fd4 reads cannot exceed the reviewed chunk cap");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readExact", "state.entries += 1n;", "state.entries += 0n;", "every fd4 read must charge one entry");
  assertMutationRejected(validateLauncherChildLedger, SOURCE.launcher, 'byteLength: "40289"', 'byteLength: "65537"', "a pinned payload cannot require a second chunk");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readPackageBundle", "pathLength > 4096", "pathLength > MAX_CHUNK_BYTES + 1", "a path length cannot exceed the single-chunk cap");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readPackageBundle", "String(payloadLength) !== expected.byteLength", "false", "wire payload length must equal the pinned one-chunk length before reading");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readPackageBundle", "const actualChildBytes = BigInt(requestPacketByteLength) + 1n + state.bytes + 1n;", "const actualChildBytes = state.bytes;", "child byte replay cannot omit fd3 packet and EOF reads");
  assertFunctionMutationRejected(validateLauncherChildLedger, SOURCE.launcher, "readPackageBundle", "const actualChildEntries = 2n + state.entries + 1n;", "const actualChildEntries = state.entries;", "child entry replay cannot omit fd3 packet, EOF, or stdout");
});

test("four external endpoints bind pidfd, SCM credentials/security, executable identity, and complete TSYNC task sets", () => {
  validateEndpoints(SOURCE.native);
  assertFunctionMutationRejected(validateEndpoints, SOURCE.native, "validate_peer_no_exec_receipt", 'json_is_true(&doc,json_object_get(&doc,body,"tsyncSucceeded"))', 'json_is_false(&doc,json_object_get(&doc,body,"tsyncSucceeded"))', "TSYNC success is mandatory");
  assertFunctionMutationRejected(validateEndpoints, SOURCE.native, "validate_endpoint_sender_control", "if(header->cmsg_type==SCM_SECURITY)", "if(header->cmsg_type==SCM_RIGHTS)", "security cmsg cannot be replaced");
  assertFunctionMutationRejected(validateEndpoints, SOURCE.native, "validate_peer_no_exec_receipt", "count_first!=count_second", "false", "task-set sibling drift cannot disappear");
});

test("the exact six principal roles are live-bound and role swaps cannot alias the supervisor or external peers", () => {
  validatePrincipalBindings(SOURCE.native);
  const mutated = clone(SCHEMA.anchor);
  mutated.$defs.principals.prefixItems[0].allOf[1].properties.role.const = "WATCHDOG";
  assert.notDeepEqual(mutated.$defs.principals.prefixItems.map((entry) => entry.allOf[1].properties.role.const), ["TRUSTED_INVOKER", "SUPERVISOR", "WATCHDOG", "OBSERVER", "WORKLOAD", "EVIDENCE_CUSTODIAN"]);
  assertMutationRejected(validatePrincipalBindings, SOURCE.native, "principal_index[4]={0,2,3,5}", "principal_index[4]={2,0,3,5}", "external role swap");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "observe_process_kernel_binding", "openat(BPS05_FD_PROC_ROOT,path,O_RDONLY|O_CLOEXEC)", "openat(AT_FDCWD,path,O_RDONLY|O_CLOEXEC)", "principal namespaces cannot be path-recaptured outside the pinned proc root");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "observe_process_kernel_binding", "fs.f_type==NSFS_MAGIC", "true", "principal namespace descriptors must prove NSFS type");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "validate_principal_kernel_binding", "observe_process_kernel_binding(pid,&after)", "observe_process_kernel_binding(pid,&before)", "second kernel identity sample cannot alias the first buffer");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "validate_principal_kernel_binding", "before.namespace_type[i]!=after.namespace_type[i]", "false", "namespace type drift cannot disappear");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "validate_principal_kernel_binding", "strcmp(before.cgroup_path,after.cgroup_path)!=0", "false", "cgroup path drift cannot disappear");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "validate_anchor_principal_bindings", "validate_principal_kernel_binding(doc,pre_drop,holder->pid", "validate_principal_kernel_binding(doc,pre_drop,getpid()", "pre-drop holder kernel identity cannot be recaptured from the supervisor");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "verify_post_drop_workload", "dropped.uid!=anchor->workload_uid", "dropped.uid!=holder->uid", "post-drop uid must bind the workload epoch");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "verify_post_drop_workload", "strcmp(dropped.peer_sha256,anchor->holder_peer_identity)==0", "false", "post-drop peer must differ from the pre-drop holder");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "verify_post_drop_workload", "strcmp(anchor->holder_namespace_sha,anchor->principal_namespace_sha[4])!=0", "false", "post-drop namespace set must equal the directly observed holder set");
  assertFunctionMutationRejected(validatePrincipalBindings, SOURCE.native, "verify_post_drop_workload", "strcmp(anchor->holder_cgroup_sha,anchor->principal_cgroup_sha[4])!=0", "false", "post-drop cgroup must equal the directly observed holder cgroup");
});

test("observer receipts bind executable roles, complete target closures, and direct K44 assessment preimages", () => {
  validateObservationBindings(SOURCE.native);
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "compare_observed_file_to_anchor", 'json_is_true(receipt,json_object_get(receipt,observed,"sameHandleReopened"))', 'json_is_false(receipt,json_object_get(receipt,observed,"sameHandleReopened"))', "observer executable must be reopened as the same object");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observed_target_closure", 'json_object_get(receipt,observed_executable,"role")', 'json_object_get(receipt,observed_executable,"sha256")', "observed executable role cannot be substituted by another field");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observed_target_closure", "strcmp(observed_role,expected_role)!=0", "false", "observed executable role must equal the anchor role");
  for (const [needle, replacement, label] of [
    ["IAT_B3_BPS05_TARGET_COMPILER_CLOSURE_V1", "IAT_B3_BPS05_TARGET_SYSROOT_CLOSURE_V1", "compiler closure cannot alias the sysroot domain"],
    ["IAT_B3_BPS05_TARGET_SYSROOT_CLOSURE_V1", "IAT_B3_BPS05_TARGET_LINKER_CLOSURE_V1", "sysroot closure cannot alias the linker domain"],
    ["IAT_B3_BPS05_TARGET_LINKER_CLOSURE_V1", "IAT_B3_BPS05_TARGET_COMPILER_CLOSURE_V1", "linker closure cannot alias the compiler domain"],
    ["sharingMapSha256", "versionArgvSha256", "sharing-map identity cannot alias version argv"],
    ["versionArgvSha256", "versionInvocationReceiptSha256", "version argv cannot alias its invocation receipt"],
    ["versionInvocationReceiptSha256", "sharingMapSha256", "version invocation receipt cannot alias the sharing map"],
  ]) assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observed_target_closure", needle, replacement, label);
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observation_anchor_bindings", "validate_observed_target_closure(receipt,json_array_at(receipt,observed_targets,i),anchor_doc,json_array_at(anchor_doc,anchor_targets,i),anchor->target_binding_sha[i])", "0", "complete target closure helper cannot be bypassed");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observation_anchor_bindings", "return validate_k44_observation_assessment(receipt,observed_k44,anchor_doc,anchor_k44);", "return 0;", "K44 helper cannot be bypassed");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_k44_observation_assessment", "json_is_true(receipt,json_object_get(receipt,observed_flags,observed_flag_keys[i]))", "json_is_false(receipt,json_object_get(receipt,observed_flags,observed_flag_keys[i]))", "K44 direct observation flags must be true in the receipt");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_k44_observation_assessment", "json_is_false(anchor_doc,json_object_get(anchor_doc,anchor_flags,anchor_flag_keys[i]))", "json_is_true(anchor_doc,json_object_get(anchor_doc,anchor_flags,anchor_flag_keys[i]))", "source-design K44 flags cannot masquerade as direct observation");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_k44_observation_assessment", 'hash_domain_json("IAT_B3_BPS05_K44_OBSERVATION_ASSESSMENT_V1"', 'hash_domain_json("IAT_B3_BPS05_RUNTIME_ANCHOR_K44_BINDING_V1"', "K44 assessment cannot reuse the anchor binding domain");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_k44_observation_assessment", "strcmp(calculated,claimed_assessment)==0", "true", "K44 assessment digest must match the independently reconstructed preimage");
  assertFunctionMutationRejected(validateObservationBindings, SOURCE.native, "validate_observation_receipt_bytes", "validate_observation_anchor_bindings(&doc,anchor_doc,anchor)==0", "true", "observation receipt cannot bypass full anchor equality");
});

test("success and abort directly observe cgroup, FD, mount, and entry zero before one bound watchdog confirmation", () => {
  validateDirectZeroEvidence(SOURCE.native);
  assert.ok(SCHEMA.evidence.$defs.zeroProof.required.includes("entryIdentityLedgerSha256"));
  assert.equal(SCHEMA.evidence.$defs.zeroProof.properties.entryIdentityLedgerSha256.$ref, "#/$defs/sha256");
  const expectedFixed = [...Array(52).keys()].filter((fd) => fd !== 19 && ((fd >= 0 && fd <= 2) || (fd >= 5 && fd <= 14) || (fd >= 16 && fd <= 51)));
  assert.equal(expectedFixed.length, 48, "exact post-observer fixed descriptor count");
  assert.equal(expectedFixed.includes(19), false, "observer receipt FD19 is terminally absent");
  assert.deepEqual(expectedFixed.filter((fd) => fd !== 19), [0, 1, 2, ...Array.from({ length: 10 }, (_, index) => index + 5), ...Array.from({ length: 36 }, (_, index) => index + 16).filter((fd) => fd !== 19)]);
  for (const [functionName, needle, replacement, label] of [
    ["read_cgroup_control_snapshot", "openat2_beneath(BPS05_FD_WORKLOAD_CGROUP_ROOT", "openat2_beneath(AT_FDCWD", "cgroup controls cannot be path-recaptured"],
    ["read_cgroup_events_snapshot", 'read_cgroup_control_snapshot("cgroup.events"', 'read_cgroup_control_snapshot("cgroup.procs"', "zero proof cannot substitute cgroup.procs for cgroup.events"],
    ["read_cgroup_control_snapshot", "*identity=st", "memset(identity,0,sizeof(*identity))", "cgroup control identity must be returned to the caller"],
    ["read_cgroup_control_snapshot", "*mount_id=(uint64_t)sx.stx_mnt_id", "*mount_id=0", "cgroup control mount identity must be returned to the caller"],
    ["verify_workload_cgroup_zero", "read_cgroup_events_snapshot(&second,&second_length,&second_stat,&second_mount)", "read_cgroup_events_snapshot(&first,&first_length,&first_stat,&first_mount)", "second cgroup snapshot cannot alias the first"],
    ["verify_workload_cgroup_zero", "first_stat.st_ino==second_stat.st_ino", "true", "cgroup.events inode drift cannot disappear"],
    ["verify_workload_cgroup_zero", 'strstr((char*)first,"populated 1\\n")==NULL', "true", "populated-one ambiguity cannot pass"],
    ["fixed_terminal_fd_expected", "fd!=BPS05_FD_OBSERVER_RECEIPT", "true", "terminal FD inventory cannot retain observer receipt FD19"],
    ["fixed_terminal_fd_expected", "fd>=0&&fd<=2", "fd>=0&&fd<2", "terminal FD inventory cannot omit stderr"],
    ["fixed_terminal_fd_expected", "fd>=BPS05_FD_BOOTSTRAP&&fd<=BPS05_FD_CGROUP_KILL", "fd>BPS05_FD_BOOTSTRAP&&fd<=BPS05_FD_CGROUP_KILL", "terminal FD inventory cannot omit bootstrap FD5"],
    ["fixed_terminal_fd_expected", "fd>=BPS05_FD_PROC_ROOT&&fd<=BPS05_FD_ABSOLUTE_TEARDOWN_TIMER", "fd>BPS05_FD_PROC_ROOT&&fd<BPS05_FD_ABSOLUTE_TEARDOWN_TIMER", "terminal FD inventory cannot omit proc root or FD51"],
    ["finalize_and_inventory_terminal_fds", "expected_count!=48", "expected_count!=49", "terminal FD count cannot re-admit FD19"],
    ["finalize_and_inventory_terminal_fds", "expected_count!=48", "expected_count!=47", "terminal FD count cannot omit another fixed descriptor"],
    ["finalize_and_inventory_terminal_fds", "!observer_identity_closed", "false", "terminal inventory must require identity-led observer closure"],
    ["finalize_and_inventory_terminal_fds", "!observer_close_identity_initialized", "false", "terminal inventory must require the frozen FD19 close identity"],
    ["finalize_and_inventory_terminal_fds", "wire_put_u64(closed_role,BPS05_FD_OBSERVER_RECEIPT)", "wire_put_u64(closed_role,BPS05_FD_CUSTODIAN_RPC)", "closed-role ledger must identify FD19"],
    ["finalize_and_inventory_terminal_fds", "sha256_update(&hash,observer_close_identity,sizeof(observer_close_identity))", "sha256_update(&hash,preliminary,32)", "terminal inventory must include the pre-close FD19 identity"],
    ["require_observer_terminal_after_observation", "derive_socket_ofd_identity(BPS05_FD_OBSERVER_RECEIPT,endpoint_ofd,&endpoint_stat)", "derive_socket_ofd_identity(BPS05_FD_CUSTODIAN_RPC,endpoint_ofd,&endpoint_stat)", "FD19 close identity cannot be substituted from FD18"],
    ["require_observer_terminal_after_observation", "strcmp(endpoint_ofd,observer->ofd_sha256)!=0", "false", "FD19 OFD must equal the accepted observer endpoint"],
    ["require_observer_terminal_after_observation", "wire_put_u64(encoded+8,(uint64_t)endpoint_stat.st_ino)", "wire_put_u64(encoded+8,(uint64_t)endpoint_stat.st_dev)", "FD19 close identity cannot omit its inode"],
    ["require_observer_terminal_after_observation", "close(BPS05_FD_OBSERVER_RECEIPT)", "close(BPS05_FD_CUSTODIAN_RPC)", "identity-led terminal close cannot target FD18"],
    ["finalize_and_inventory_terminal_fds", "fixed_terminal_fd_expected(fd)!=seen[fd]", "false", "every expected fixed FD must be observed"],
    ["directory_is_empty_snapshot", "pass<2", "pass<1", "temporary entry absence requires two samples"],
    ["directory_is_empty_snapshot", "entries!=0", "false", "temporary entries cannot be ignored"],
    ["verify_terminal_entry_absence", "for(size_t i=5;i<=9;++i)", "for(size_t i=6;i<=9;++i)", "temporary root 5 cannot be omitted"],
    ["verify_terminal_mount_absence", 'read_proc_child_file(getpid(),"mountinfo",BPS05_MAX_SCHEMA,&second,&second_length)', 'read_proc_child_file(getpid(),"mountinfo",BPS05_MAX_SCHEMA,&first,&first_length)', "second mountinfo snapshot cannot alias the first"],
    ["verify_terminal_mount_absence", "!mountinfo_has_run_mount(first,first_length,bootstrap->roots[0].path)", "true", "run-root mount residue cannot be ignored"],
    ["build_direct_zero_confirmation_digest", "sha256_update(&hash,entry_ledger,32)", "sha256_update(&hash,mount_ledger,32)", "entry ledger cannot alias mount ledger in watchdog confirmation"],
    ["derive_zero_proof_expectations", "memcpy(out->entry_ledger,entry_ledger,32)", "memcpy(out->entry_ledger,mount_ledger,32)", "durable zero proof cannot substitute the entry ledger"],
    ["derive_pre_anchor_zero_proof_expectations", "memcpy(out->entry_ledger,entry_ledger,32)", "memcpy(out->entry_ledger,mount_ledger,32)", "pre-anchor zero proof cannot substitute the entry ledger"],
    ["validate_final_evidence_instance", 'json_object_get(&doc,zero_proof,"entryIdentityLedgerSha256")', 'json_object_get(&doc,zero_proof,"mountIdentityLedgerSha256")', "durable evidence must echo the entry ledger"],
    ["validate_null_observation_final_evidence", 'json_object_get(&doc,zero,"entryIdentityLedgerSha256")', 'json_object_get(&doc,zero,"mountIdentityLedgerSha256")', "null-observation evidence must echo the entry ledger"],
  ]) assertFunctionMutationRejected(validateDirectZeroEvidence, SOURCE.native, functionName, needle, replacement, label);
  const successSteps = [
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&watchdog_reply)",
  ];
  const abortSteps = [...successSteps.slice(0, -1), "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&cleanup_reply)"];
  successSteps.forEach((step, index) => assertMainSuccessMutationRejected(validateDirectZeroEvidence, SOURCE.native, step, `BPS05_REMOVED_DIRECT_SUCCESS_${index}`, `direct success step ${index} cannot be removed`));
  abortSteps.forEach((step, index) => assertCleanupMutationRejected(validateDirectZeroEvidence, SOURCE.native, step, `BPS05_REMOVED_DIRECT_ABORT_${index}`, `direct abort step ${index} cannot be removed`));
  for (let index = 0; index < successSteps.length - 1; index += 1) assertMainSuccessSwapRejected(validateDirectZeroEvidence, SOURCE.native, successSteps[index], successSteps[index + 1], `direct success steps ${index}/${index + 1} cannot be swapped`);
  for (let index = 0; index < abortSteps.length - 1; index += 1) assertCleanupSwapRejected(validateDirectZeroEvidence, SOURCE.native, abortSteps[index], abortSteps[index + 1], `direct abort steps ${index}/${index + 1} cannot be swapped`);
});

test("Git checkpoint, raw objects, seven exact package rows, and fd4 bundle are direct same-object inputs", () => {
  assertContains(SOURCE.native, [
    'BPS05_PACKAGE_COMMIT[] = "11572110330c4b22aa89d629065574e567e9fea8"',
    'BPS05_PACKAGE_PARENT[] = "b1c65482aebb31395a763707b02224c38aa2da96"',
    'BPS05_PACKAGE_TREE[] = "22741ccba22f8f16663c745c0496d5c0be97d534"',
    'BPS05_PACKAGE_DELTA[] = "1be0fac74e365d480a2b83ac7452d9a399374b0ff5e0ec68b7c9ac37064ea235/1411/7"',
    'BPS05_PACKAGE_MANIFEST[] = "383960b7b04fd4c3afe66b27fa1ce8de74a870ce18f15d37a8069a5a0414b9d5/1334/7/123908"',
    'BPS05_GRAPH_SHA256[] = "78e901dd5ef6700530a592fef599facffb6628688d444f6c780d5f76610beec1"',
    "BPS05_PACKAGE_COUNT = 7", "BPS05_FD_GIT_OBJECT_BASE = 64",
  ], "accepted checkpoint/package identities");
  const git = extractFunction(SOURCE.native, "load_verify_git_objects");
  assertContains(git, ["read_bounded_file", "sha1_init", "sha1_final", "parse_git_canonical_header", "expected_table_digest"], "raw Git object closure");
  assertContains(extractFunction(SOURCE.native, "parse_anchor_git_table"), ["BPS05_FD_GIT_OBJECT_BASE", '"objectCount"', '"objectTableDigest"', '"objects"', '"openFileDescriptionSha256"'], "fixed Git object FD table");
  assertContains(extractFunction(SOURCE.native, "verify_package_tree_projection"), ["BPS05_PACKAGE_COUNT", "verify_one_package_path", "table->objects[i].reached"], "seven-row tree projection");
  assertContains(extractFunction(SOURCE.native, "verify_one_package_path"), ["row->path", "row->blob_oid", "row->size", "row->sha256", "blob->reached=true"], "exact package blob identity");
  assertOrdered(extractFunction(SOURCE.native, "main"), ["parse_anchor_git_table", "load_verify_git_objects", "verify_package_tree_projection", "cross_package_payloads_with_git", "configure_child_user_namespace"], "Git proof before namespace release");
  assert.doesNotMatch(SOURCE.native, /\bsystem\s*\(|\bpopen\s*\(|\bexec(?:l|v|vp)\s*\([^;]*git/u);
});

test("clone3 namespaces, FD15 same-handle exec, exact fd3/fd4 map, and irreversible drop are ordered", () => {
  validateChildPath(SOURCE.native);
  assertMutationRejected(validateChildPath, SOURCE.native, "SYS_execveat,BPS05_FD_NODE_EXEC_FOR_CHILD", "SYS_execveat,BPS05_FD_NODE_EXECUTABLE", "exec cannot drift from FD15");
  assertMutationRejected(validateChildPath, SOURCE.native, 'static const unsigned char dropped[]="BPS05DRP"', 'static const unsigned char dropped[]="BPS05GO!"', "drop acknowledgement cannot be replayed as GO");
});

test("main reaches the exact MAP/READY/CAS/PEEK/LATCH/DROP/GO protocol and validates one HOLD result plus EOF", () => {
  const main = extractFunction(SOURCE.native, "main");
  assertOrdered(main, [
    'receive_magic_packet(handshake[0],"BPS05MAP")',
    "request_runtime_anchor",
    "validate_anchor_principal_bindings",
    "configure_child_user_namespace",
    'send_exact_packet(handshake[0],mapped',
    'receive_magic_packet(handshake[0],"BPS05RDY")',
    "watchdog_rpc(WD_RESERVE_CAS",
    "watchdog_rpc(WD_BIND_FINAL",
    'memcmp(peek,"BPS05PEK",8)',
    "watchdog_rpc(WD_LATCH_CHILD_PEEK",
    "send_watchdog_latch_packet",
    'receive_magic_packet(handshake[0],"BPS05DRP")',
    "verify_post_drop_workload",
    "send_exact_packet(handshake[0],go",
    "receive_fd3_hold_result",
    "validate_pregraph_result",
    "wait_child_terminal_and_drain",
  ], "main protocol");
  assertContains(extractFunction(SOURCE.native, "receive_fd3_hold_result"), ["BPS05_MAX_RESULT+1", "MSG_DONTWAIT|MSG_TRUNC", "MSG_TRUNC|MSG_CTRUNC", "recv_exact_packet", "eof_length!=0"], "single packet plus EOF");
  assertContains(extractFunction(SOURCE.native, "validate_pregraph_result"), ['strcmp(text,"NONE")', 'strcmp(text,"HOLD")', "json_is_false", "packageGraphPending"], "HOLD result validation");
});

test("the launcher is the actual mandatory fd3/fd4 entry, has no path fallback, and emits HOLD before graph evaluation", () => {
  validateLauncherInvocation(SOURCE.launcher);
  assertOrdered(SOURCE.launcher, [
    'import { closeSync, readSync, writeSync } from "node:fs";',
    'import { createHash, timingSafeEqual } from "node:crypto";',
    'import { Buffer } from "node:buffer";',
    'import { SourceTextModule, SyntheticModule, createContext, runInContext } from "node:vm";',
    "const REQUEST_FD = 3;", "const BUNDLE_FD = 4;",
  ], "launcher imports and fixed FDs");
  assert.doesNotMatch(SOURCE.launcher, /\b(?:open|openSync|createReadStream|readFile|readFileSync|spawn|execFile|fork|connect|fetch|require)\s*\(/u);
  assert.doesNotMatch(SOURCE.launcher, /\bimport\s*\(|from\s+["']node:(?:path|module|worker_threads|child_process|net|http|https|tls|dgram)/u);
  const main = extractFunction(SOURCE.launcher, "main");
  assertOrdered(main, [
    "readOneRequestPacket()", "parseCanonicalPacket", "validateRequestBody", "readPackageBundle", "closeOnce(BUNDLE_FD", "makePreGraphResult", "writeSync(REQUEST_FD", "closeOnce(REQUEST_FD", "await evaluatePackageGraph",
  ], "launcher mandatory flow");
  assert.match(SOURCE.launcher, /await main\(\);\s*$/u);
  assertContains(extractFunction(SOURCE.launcher, "readOneRequestPacket"), ["MAX_REQUEST_BYTES + 1", "readSync(REQUEST_FD", "second packet or trailing byte"], "fd3 framing");
  assertContains(extractFunction(SOURCE.launcher, "readPackageBundle"), ["BUNDLE_MAGIC", "GLOBAL_READ_LIMIT", "payload hash mismatch", "trailing byte", "native transcript/bundle mismatch"], "fd4 framing");
  assertContains(extractFunction(SOURCE.launcher, "readExact"), ["GLOBAL_READ_LIMIT", "GLOBAL_ENTRY_LIMIT", "aggregate checked-u64 budget exceeded"], "fd4 global ledger");
  for (const [needle, replacement, label] of [
    ['import { snapshotContextNativeFacadeCallCounts } from "iat-b3:role5";', 'import { Buffer } from "iat-b3:role5";', "role5 count binding cannot disappear"],
    ['if (typeof entry !== "function" || entry.length !== 1 || entry !== namedEntry) throw new TypeError("entry");', 'if (typeof entry !== "function") throw new TypeError("entry");', "entry identity and arity cannot drift"],
    ["const result = entry(projection);", "const result = Reflect.apply(entry, undefined, [projection]);", "host-style Reflect.apply cannot enter the wrapper"],
    ['if (typeof result !== "string") throw new TypeError("result");', 'if (result && typeof result.then === "function") throw new TypeError("result");', "thenable/non-string result cannot cross"],
    ["counts.isProxy < 1 || counts.structuredClone < 1", "counts.isProxy < 0 || counts.structuredClone < 0", "facade count minimum cannot be bypassed"],
    ["export default result;", "export default entry;", "function export cannot replace the primitive result"],
    ['exactNamespace(invocation, ["default"]', "exactNamespace(invocation, ROLE6_EXPORTS", "wrapper namespace cannot expose functions"],
    ["const result = invocation.namespace.default;", "const result = role6.namespace.default;", "host cannot recapture the role6 function"],
    ['if (typeof result !== "string") fail("$graph.entry", "only a primitive result string may cross the context boundary")', "if (result === undefined) fail(\"$graph.entry\", \"missing\")", "host primitive guard cannot be weakened"],
  ]) assertFunctionMutationRejected(validateLauncherInvocation, SOURCE.launcher, "evaluatePackageGraph", needle, replacement, label);
  assertFunctionMutationRejected(validateLauncherInvocation, SOURCE.launcher, "canonicalU64", "return parsed;", "return value;", "canonical u64 cannot return the unchecked string");
  assertFunctionMutationRejected(validateLauncherInvocation, SOURCE.launcher, "evaluatePackageGraph", "return result;", "return parsed;", "validated primitive result cannot be replaced by a host object");
  assertFunctionMutationRejected(validateLauncherInvocation, SOURCE.launcher, "main", 'const terminalBytes = Buffer.from(terminalGraphResult, "utf8");', 'const terminalBytes = Buffer.from(JSON.stringify(terminalGraphResult), "utf8");', "terminal bytes cannot be reserialized");
  assertFunctionMutationRejected(validateLauncherInvocation, SOURCE.launcher, "main", "writeSync(1, terminalBytes", "writeSync(2, terminalBytes", "terminal result must use captured stdout");
});

test("the clean child terminal transcript binds exact stdout, empty stderr, same pidfd, and both result domains before observation", () => {
  validateTerminalTranscript(SOURCE.native);
  const orderedTerminalSteps = [
    "receive_fd3_hold_result(control[0],&result_bytes,&result_length)",
    "validate_pregraph_result(result_bytes,result_length,&anchor,&bundle,prebinding_sha)",
    "sha256_final(&result_hash,pregraph_digest)",
    "wait_child_terminal_and_drain(pidfd,stdout_pipe[0],stderr_pipe[0],&terminal)",
    "child_reaped=true;child=-1",
    "validate_terminal_graph_result(&terminal,&anchor,&bundle,prebinding_sha,projection_sha,graph_result_digest)",
    "build_terminal_transcript_digest(&holder,&anchor,&terminal,&bootstrap,&bundle,pregraph_digest,graph_result_digest,phase_digest)",
    "watchdog_rpc(WD_TERMINAL_HOLD,0,0,phase_digest,&watchdog_reply)",
    "persist_observation_before_teardown(&bootstrap,&anchor_doc,&anchor,pregraph_digest,phase_digest,final_digest,&observation_bytes,&observation_length,observation_sha,&observation_artifact)",
  ];
  orderedTerminalSteps.forEach((step, index) => {
    assertMainSuccessMutationRejected(validateTerminalTranscript, SOURCE.native, step, `BPS05_REMOVED_TERMINAL_STEP_${index}`, `terminal step ${index} cannot be removed`);
  });
  for (let index = 0; index < orderedTerminalSteps.length - 1; index += 1) {
    assertMainSuccessSwapRejected(validateTerminalTranscript, SOURCE.native, orderedTerminalSteps[index], orderedTerminalSteps[index + 1], `terminal steps ${index}/${index + 1} cannot be swapped`);
  }
  assertMainSuccessMutationRejected(validateTerminalTranscript, SOURCE.native, "sha256_update(&projection_hash,projection.bytes,projection.length)", "sha256_update(&projection_hash,prebinding.bytes,prebinding.length)", "terminal projection digest cannot hash a substituted native buffer");
  for (const [functionName, needle, replacement, label] of [
    ["wait_child_terminal_and_drain", "if(i==3)return -1", "if(false)return -1", "stderr output cannot be accepted"],
    ["wait_child_terminal_and_drain", "(size_t)got>BPS05_MAX_RESULT-out->stdout_length", "false", "stdout cannot exceed the exact cap"],
    ["wait_child_terminal_and_drain", "out->info.si_status!=0", "out->info.si_status<0", "nonzero child exit cannot be accepted"],
    ["wait_child_terminal_and_drain", "pidfd_before.st_ino!=pidfd_after.st_ino", "false", "terminal pidfd object cannot drift"],
    ["validate_terminal_graph_result", "json_object_exact_keys(&doc,0,keys", "accept_unknown_keys(&doc,0,keys", "terminal graph result cannot admit extra fields"],
    ["validate_terminal_graph_result", "json_parse_schema(terminal->stdout_bytes,terminal->stdout_length,&doc)", "json_parse_canonical(terminal->stdout_bytes,terminal->stdout_length,&doc)", "reviewed insertion-order terminal packet cannot be replaced by sorted canonical parsing"],
    ["validate_terminal_graph_result", 'strcmp(decision,"HOLD")==0', "true", "terminal graph result cannot promote"],
    ["validate_terminal_graph_result", "strcmp(projection,expected_projection_sha)==0", "true", "terminal projection digest must match the exact native projection bytes"],
    ["validate_terminal_graph_result", "packet.length!=terminal->stdout_length", "false", "terminal graph result must match exact reconstructed bytes"],
    ["build_terminal_transcript_digest", 'domain[]="IAT_B3_BPS05_NATIVE_CHILD_TERMINAL_TRANSCRIPT_V2\\0"', 'domain[]="IAT_B3_BPS05_FD3_PRE_GRAPH_HOLD_RESULT_BODY_V1\\0"', "terminal and pregraph digest domains cannot alias"],
    ["build_terminal_transcript_digest", "sha256_update(&hash,holder->peer_sha256,64)", "sha256_update(&hash,anchor->workload_peer_identity,64)", "pre-drop holder identity cannot be replaced by the post-drop workload"],
    ["build_terminal_transcript_digest", "sha256_update(&hash,anchor->workload_peer_identity,64)", "sha256_update(&hash,holder->peer_sha256,64)", "post-drop workload identity cannot be replaced by the pre-drop holder"],
    ["build_terminal_transcript_digest", "sha256_update(&hash,pregraph_digest,32)", "sha256_update(&hash,graph_result_digest,32)", "pregraph digest cannot disappear from terminal transcript"],
    ["build_terminal_transcript_digest", "sha256_update(&hash,terminal->stderr_sha256,32)", "sha256_update(&hash,terminal->stdout_sha256,32)", "empty stderr digest cannot disappear from terminal transcript"],
    ["persist_observation_before_teardown", "anchor->anchor_sha,result_sha,terminal_sha,final_sha", "anchor->anchor_sha,result_sha,result_sha,final_sha", "V2 handoff cannot replay fd3 as the terminal transcript"],
    ["validate_observation_receipt_bytes", 'json_copy_string(&doc,json_object_get(&doc,0,"terminalTranscriptSha256"),value,sizeof(value))&&strcmp(value,terminal_transcript_sha)==0', "true", "observer receipt must echo the exact terminal transcript"],
  ]) assertFunctionMutationRejected(validateTerminalTranscript, SOURCE.native, functionName, needle, replacement, label);
});

test("evidence schema freezes durable observation A then distinct teardown B, or null-A failure then B, always HOLD", () => {
  const defs = SCHEMA.evidence.$defs;
  assert.deepEqual(defs.survivingControlRoles.prefixItems.map((entry) => entry.const), ["TRUSTED_INVOKER", "SUPERVISOR", "WATCHDOG", "EVIDENCE_CUSTODIAN"]);
  assert.deepEqual(defs.custodianEnvelope.required, ["custodianIdentitySha256", "observationArtifact", "teardownArtifact", "writeOrder", "authenticatedEndpointSha256", "allCopyAndReopenReadsCharged"]);
  assert.deepEqual(defs.custodianEnvelope.properties.writeOrder.enum, ["OBSERVATION_THEN_TEARDOWN", "NO_OBSERVATION_THEN_TEARDOWN"]);
  assert.equal(defs.custodianEnvelope.properties.allCopyAndReopenReadsCharged.const, true);
  assert.deepEqual(defs.teardownReceipt.properties.terminalCas.enum, [
    "OBSERVATION_DURABLE_THEN_ZERO_HOLD", "FAILURE_BEFORE_OBSERVATION_ZERO_HOLD", "FAILURE_AFTER_OBSERVATION_ZERO_HOLD", "TIMEOUT_BEFORE_OBSERVATION_ZERO_HOLD", "TIMEOUT_AFTER_OBSERVATION_ZERO_HOLD",
  ]);
  assert.equal(defs.observationReceipt.properties.persistenceState.const, "SEALED_PRE_TEARDOWN_HOLD");
  assert.ok(defs.observationReceipt.required.includes("terminalTranscriptSha256"));
  assert.equal(defs.observationReceipt.properties.terminalTranscriptSha256.$ref, "#/$defs/sha256");
  assert.equal(defs.observationReceipt.properties.decision.const, "HOLD");
  assert.equal(defs.teardownReceipt.properties.decision.const, "HOLD");
  assert.equal(defs.finalComposite.properties.domain.const, "IAT_B3_BPS05_FINAL_COMPOSITE_V1");
  assert.equal(defs.finalComposite.properties.availableArtifactsReplayed.const, true);
  assert.equal(defs.finalComposite.properties.identityAndWindowEqualityVerified.const, true);
  assert.equal(defs.zeroProof.properties.allCgroupEventsPopulatedZero.const, true);
  assert.equal(defs.zeroProof.properties.allTemporaryMountsGone.const, true);
  assert.equal(defs.zeroProof.properties.allTemporaryFdsClosed.const, true);
  assert.equal(defs.zeroProof.properties.allTemporaryEntriesGone.const, true);
  assert.equal(defs.zeroProof.properties.cleanupByIdentityNotNumericPath.const, true);
  assert.equal(defs.zeroProof.properties.outerWatchdogObservedZero.const, true);
});

test("actual main persists authenticated observation A before teardown and a distinct newer teardown B only after zero", () => {
  validateCustodySource(SOURCE.native);
  const orderedMainSteps = [
    "watchdog_rpc(WD_CONSUME_CAS,0,0,final_digest,&watchdog_reply)",
    "watchdog_rpc(WD_TERMINAL_HOLD,0,0,phase_digest,&watchdog_reply)",
    "persist_observation_before_teardown(&bootstrap,&anchor_doc,&anchor,pregraph_digest,phase_digest,final_digest,&observation_bytes,&observation_length,observation_sha,&observation_artifact)",
    "require_observer_terminal_after_observation(&bootstrap)",
    "close_execution_temporaries_before_zero(&control[0],&stdout_pipe[0],&stderr_pipe[0],&pidfd,temporary_fd_ledger)",
    "watchdog_rpc(WD_BEGIN_TEARDOWN,0,0,phase_digest,&watchdog_reply)",
    "timer_first_wait(BPS05_FD_CGROUP_KILL,POLLOUT)",
    "write(BPS05_FD_CGROUP_KILL,kill_value",
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&watchdog_reply)",
    "derive_zero_proof_expectations(&anchor,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,observation_sha,&zero_expected)",
    'persist_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,observation_bytes,observation_length,observation_sha,&observation_artifact,&zero_expected,"OBSERVATION_DURABLE_THEN_ZERO_HOLD","NONE")',
  ];
  orderedMainSteps.forEach((step, index) => {
    assertMainSuccessMutationRejected(validateCustodySource, SOURCE.native, step, `BPS05_REMOVED_STEP_${index}`, `custody step ${index} cannot be removed`);
  });
  for (let index = 0; index < orderedMainSteps.length - 1; index += 1) {
    assertMainSuccessSwapRejected(validateCustodySource, SOURCE.native, orderedMainSteps[index], orderedMainSteps[index + 1], `custody steps ${index}/${index + 1} cannot be swapped`);
  }
  assertFunctionMutationRejected(
    validateCustodySource,
    SOURCE.native,
    "persist_observation_before_teardown",
    "authenticated_control_exchange(bootstrap,2",
    "authenticated_control_exchange(bootstrap,3",
    "observer/custodian role swap",
  );
  for (const [needle, replacement, label] of [
    ['json_is_true(doc,json_object_get(doc,token,"fsyncFile"))', 'json_is_false(doc,json_object_get(doc,token,"fsyncFile"))', "ACK before durable file fsync"],
    ['json_is_true(doc,json_object_get(doc,token,"renameNoReplace"))', 'json_is_false(doc,json_object_get(doc,token,"renameNoReplace"))', "replace-capable artifact"],
    ['json_is_true(doc,json_object_get(doc,token,"reopenedSameObject"))', 'json_is_false(doc,json_object_get(doc,token,"reopenedSameObject"))', "unreopened artifact"],
    ["teardown_artifact.dev==observed_artifact.dev&&teardown_artifact.ino==observed_artifact.ino", "false", "A/B object alias"],
    ["teardown_artifact.generation<=observed_artifact.generation", "false", "non-increasing B generation"],
    ["strcmp(value,teardown_sha)!=0", "false", "teardown digest unlink"],
  ]) assertMutationRejected(validateCustodySource, SOURCE.native, needle, replacement, label);
});

test("every failure atomically reaches terminal HOLD, authenticated observer terminal, true zero, and durable teardown B", () => {
  validateFailureCleanup(SOURCE.native);
  const orderedCleanupSteps = [
    "bps05_teardown_timer_selected=true",
    "watchdog_rpc(WD_ABORT_TO_TERMINAL_HOLD,0,0,phase_digest,&cleanup_reply)",
    "require_observer_terminal_after_observation(&bootstrap)",
    "terminate_observer_without_observation(&bootstrap,phase_digest)",
    "close_failure_temporaries_identity_led(failure_dynamic,sizeof(failure_dynamic)/sizeof(failure_dynamic[0]),&pidfd,&preserved_pidfd,preliminary_fd_ledger)",
    "watchdog_rpc(WD_BEGIN_TEARDOWN,0,0,phase_digest,&cleanup_reply)",
    "timer_first_wait(BPS05_FD_CGROUP_KILL,POLLOUT)",
    "write(BPS05_FD_CGROUP_KILL,failure_kill",
    "kill_reap_identity(pidfd)",
    "finish_failure_pidfd_identity_ledger(&pidfd,&preserved_pidfd,preliminary_fd_ledger,temporary_fd_ledger)",
    "verify_workload_cgroup_zero(direct_cgroup_ledger)",
    "finalize_and_inventory_terminal_fds(&git,temporary_fd_ledger,observer_terminal,temporary_fd_ledger)",
    "verify_terminal_mount_absence(&bootstrap,direct_mount_ledger)",
    "verify_terminal_entry_absence(&bootstrap,direct_entry_ledger)",
    "build_direct_zero_confirmation_digest(temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,zero_confirmation_digest)",
    "watchdog_rpc(WD_CONFIRM_ZERO,0,0,zero_confirmation_digest,&cleanup_reply)",
    'derive_zero_proof_expectations(&anchor,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,observation_durable?observation_sha:"",&zero_expected)',
    'persist_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,observation_bytes,observation_length,observation_sha,&observation_artifact,&zero_expected,"FAILURE_AFTER_OBSERVATION_ZERO_HOLD","NATIVE_FAILURE_AFTER_OBSERVATION")',
    'persist_null_observation_teardown_after_zero(&bootstrap,&anchor,evidence_schema_bytes,evidence_schema_length,&zero_expected,"NATIVE_FAILURE_BEFORE_OBSERVATION")',
  ];
  orderedCleanupSteps.forEach((step, index) => {
    assertCleanupMutationRejected(validateFailureCleanup, SOURCE.native, step, `BPS05_REMOVED_CLEANUP_STEP_${index}`, `cleanup step ${index} cannot be removed`);
  });
  for (let index = 0; index < orderedCleanupSteps.length - 1; index += 1) {
    assertCleanupSwapRejected(validateFailureCleanup, SOURCE.native, orderedCleanupSteps[index], orderedCleanupSteps[index + 1], `cleanup steps ${index}/${index + 1} cannot be swapped`);
  }
  for (const [needle, replacement, label] of [
    ["watchdog_armed&&!final_evidence_durable&&bps05_cleanup_plane_verified", "watchdog_armed&&!final_evidence_durable&&control_plane_ready", "early cleanup cannot require the later full control plane"],
    ["if(bps05_cleanup_plane_verified)", "if(control_plane_ready)", "observer termination cannot require the later full control plane"],
    ["zero_confirmed&&bootstrap_ready&&bps05_cleanup_plane_verified&&observer_terminal", "zero_confirmed&&bootstrap_ready&&control_plane_ready&&observer_terminal", "durable B cannot require the later full control plane"],
    ["watchdog_current_state<5", "watchdog_current_state<4", "abort omits a preterminal watchdog state"],
    ["watchdog_current_state!=5", "watchdog_current_state!=4", "abort terminal state is not proven"],
    ["watchdog_current_state>7", "watchdog_current_state>8", "invalid post-zero state is accepted"],
    ["if(observation_durable&&!observer_terminal){if(require_observer_terminal_after_observation(&bootstrap)", "if(false&&!observer_terminal){if(require_observer_terminal_after_observation(&bootstrap)", "durable-A observer terminal branch is unreachable"],
    ["else if(!observation_durable&&!observer_terminal){if(terminate_observer_without_observation(&bootstrap,phase_digest)", "else if(false&&!observer_terminal){if(terminate_observer_without_observation(&bootstrap,phase_digest)", "null-A observer termination branch is unreachable"],
    ["watchdog_current_state==5", "watchdog_current_state==4", "teardown begins outside terminal HOLD"],
    ["watchdog_current_state!=6", "watchdog_current_state!=5", "BEGIN_TEARDOWN state is not proven"],
    ["watchdog_current_state==6", "watchdog_current_state==5", "kill runs outside teardown state"],
    ["watchdog_current_state!=7", "watchdog_current_state!=6", "CONFIRM_ZERO state is not proven"],
    ["watchdog_current_state==7", "watchdog_current_state==6", "preconfirmed zero is misclassified"],
    ["cleanup_ok&&final_evidence_durable", "cleanup_ok||final_evidence_durable", "cleanup failure can return the HOLD exit"],
  ]) assertCleanupMutationRejected(validateFailureCleanup, SOURCE.native, needle, replacement, label);
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "kill_reap_identity", "SYS_pidfd_send_signal", "SYS_kill", "numeric PID cleanup cannot replace pidfd signaling");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "terminate_observer_without_observation", "authenticated_control_exchange(bootstrap,2", "authenticated_control_exchange(bootstrap,3", "null-observation abort must use observer role 2");
  assertFunctionMutationRejected(validateCustodySource, SOURCE.native, "verify_endpoint_for_control_exchange", "endpoint_index==2||endpoint_index==3", "endpoint_index==1", "asserted early cleanup must retain observer and custodian endpoints");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "close_failure_temporaries_identity_led", "items[i]==preserved_pidfd", "false", "the child pidfd must survive until terminal proof");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "finish_failure_pidfd_identity_ledger", "st.st_ino!=preserved->ino", "false", "the final pidfd close must recheck same-object identity");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "read_cgroup_control_snapshot", "BPS05_FD_WORKLOAD_CGROUP_ROOT", "AT_FDCWD", "zero proof cannot drift to a path lookup");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "validate_null_observation_final_evidence", "json_is_null(&doc,observation)", "json_is_true(&doc,observation)", "null-A evidence cannot replay an observation");
  assertFunctionMutationRejected(validateFailureCleanup, SOURCE.native, "persist_null_observation_teardown_after_zero", "authenticated_control_exchange(bootstrap,3", "authenticated_control_exchange(bootstrap,2", "durable failure B must use custodian role 3");
});

test("failure before the runtime anchor persists a strict bootstrap-bound null-observation teardown artifact", () => {
  validatePreAnchorFailure(SOURCE.native);
  const derive = "derive_pre_anchor_zero_proof_expectations(bootstrap_digest,temporary_fd_ledger,direct_mount_ledger,direct_entry_ledger,direct_cgroup_ledger,phase_digest,&zero_expected)";
  const persist = 'persist_pre_anchor_failure_teardown_after_zero(&bootstrap,evidence_schema_bytes,evidence_schema_length,bootstrap_digest,bootstrap_length,&zero_expected,"NATIVE_FAILURE_BEFORE_RUNTIME_ANCHOR")';
  assertCleanupMutationRejected(validatePreAnchorFailure, SOURCE.native, derive, "BPS05_REMOVED_PRE_ANCHOR_DERIVATION", "pre-anchor zero derivation cannot be removed");
  assertCleanupMutationRejected(validatePreAnchorFailure, SOURCE.native, persist, "BPS05_REMOVED_PRE_ANCHOR_PERSISTENCE", "pre-anchor durable B cannot be removed");
  assertCleanupSwapRejected(validatePreAnchorFailure, SOURCE.native, derive, persist, "pre-anchor evidence cannot precede its zero transcript");
  assertCleanupMutationRejected(validatePreAnchorFailure, SOURCE.native, "else if(!observation_durable)", "else if(observation_durable)", "pre-anchor branch cannot replay a durable observation");
  for (const [functionName, needle, replacement, label] of [
    ["derive_pre_anchor_zero_proof_expectations", 'zero_domain[]="IAT_B3_BPS05_PRE_ANCHOR_ZERO_TRANSCRIPT_V2\\0"', 'zero_domain[]="IAT_B3_BPS05_ZERO_PROOF_TRANSCRIPT_V3\\0"', "pre-anchor transcript domain cannot alias post-anchor evidence"],
    ["derive_pre_anchor_zero_proof_expectations", "sha256_update(&hash,bootstrap_digest,32)", "sha256_update(&hash,phase_digest,32)", "bootstrap identity cannot disappear from the pre-anchor transcript"],
    ["derive_pre_anchor_zero_proof_expectations", "sha256_update(&hash,out->entry_ledger,32)", "sha256_update(&hash,out->mount_ledger,32)", "pre-anchor entry absence cannot alias mount absence"],
    ["persist_pre_anchor_failure_teardown_after_zero", "authenticated_control_exchange(bootstrap,3", "authenticated_control_exchange(bootstrap,2", "pre-anchor artifact must use custodian role 3"],
    ["persist_pre_anchor_failure_teardown_after_zero", "validate_instance_against_schema(schema_bytes,schema_length,evidence,evidence_length,&doc)", "json_parse_schema(evidence,evidence_length,&doc)", "pre-anchor evidence must pass the pinned external schema"],
    ["persist_pre_anchor_failure_teardown_after_zero", '\\"decision\\":\\"HOLD\\"', '\\"decision\\":\\"PASS\\"', "pre-anchor artifact cannot promote"],
    ["persist_pre_anchor_failure_teardown_after_zero", '\\"observationReceipt\\":null', '\\"observationReceipt\\":{}', "pre-anchor artifact cannot invent observation A"],
    ["persist_pre_anchor_failure_teardown_after_zero", '\\"terminalCas\\":\\"PRE_ANCHOR_FAILURE_ZERO_HOLD\\"', '\\"terminalCas\\":\\"OBSERVATION_DURABLE_THEN_ZERO_HOLD\\"', "pre-anchor terminal CAS cannot drift"],
    ["persist_pre_anchor_failure_teardown_after_zero", "claimed_length==bootstrap_length", "true", "bootstrap byte length must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'json_copy_string(&doc,json_object_get(&doc,bootstrap_identity,"sha256"),value,sizeof(value))&&strcmp(value,bootstrap_sha)==0&&json_copy_u64', 'json_copy_string(&doc,json_object_get(&doc,bootstrap_identity,"sha256"),value,sizeof(value))&&true&&json_copy_u64', "bootstrap identity digest must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'json_copy_string(&doc,json_object_get(&doc,teardown,"bootstrapSha256"),value,sizeof(value))&&strcmp(value,bootstrap_sha)==0&&json_copy_string', 'json_copy_string(&doc,json_object_get(&doc,teardown,"bootstrapSha256"),value,sizeof(value))&&true&&json_copy_string', "teardown receipt bootstrap digest must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'json_copy_string(&doc,json_object_get(&doc,0,"prearmSessionId"),value,sizeof(value))&&strcmp(value,bootstrap->prearm_session_id)==0&&json_copy_string', 'json_copy_string(&doc,json_object_get(&doc,0,"prearmSessionId"),value,sizeof(value))&&true&&json_copy_string', "root prearm session must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'json_copy_string(&doc,json_object_get(&doc,teardown,"prearmSessionId"),value,sizeof(value))&&strcmp(value,bootstrap->prearm_session_id)==0&&json_copy_string', 'json_copy_string(&doc,json_object_get(&doc,teardown,"prearmSessionId"),value,sizeof(value))&&true&&json_copy_string', "teardown receipt prearm session must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", "strcmp(value,zero_sha)==0", "true", "watchdog zero transcript must match"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'json_object_get(&doc,resource,"entryIdentityLedgerSha256")', 'json_object_get(&doc,resource,"mountIdentityLedgerSha256")', "pre-anchor durable B must bind direct entry absence"],
    ["persist_pre_anchor_failure_teardown_after_zero", "memcpy(synthetic_anchor.custodian_sink_identity,bootstrap->roots[9].ofd_sha256,65)", "memcpy(synthetic_anchor.custodian_sink_identity,bootstrap->roots[8].ofd_sha256,65)", "durable artifact cannot drift from teardown root identity"],
    ["persist_pre_anchor_failure_teardown_after_zero", 'parse_durable_artifact(&doc,nested_object(&doc,0,"artifact"),"TEARDOWN"', 'parse_durable_artifact(&doc,nested_object(&doc,0,"artifact"),"OBSERVATION"', "pre-anchor artifact cannot masquerade as observation A"],
  ]) assertFunctionMutationRejected(validatePreAnchorFailure, SOURCE.native, functionName, needle, replacement, label);
});

test("hostile schema mutations cannot promote authority, alias artifacts, reorder custody, or weaken zero residue", () => {
  const hostiles = [
    (schema) => { schema.$defs.sourceDesignTruth.properties.runtimeObserved.const = true; },
    (schema) => { schema.$defs.observationReceipt.properties.decision.const = "PASS"; },
    (schema) => { schema.$defs.teardownReceipt.properties.authority.const = "SELF"; },
    (schema) => { schema.$defs.custodianEnvelope.properties.writeOrder.enum.reverse(); },
    (schema) => { schema.$defs.zeroProof.properties.allTemporaryEntriesGone.const = false; },
    (schema) => { schema.$defs.finalComposite.required = schema.$defs.finalComposite.required.filter((key) => key !== "observationReceiptSha256"); },
  ];
  for (const mutate of hostiles) {
    const candidate = clone(SCHEMA.evidence);
    mutate(candidate);
    assert.notDeepEqual(candidate, SCHEMA.evidence);
    assert.throws(() => {
      assertRecursivelyClosedSchema(candidate);
      assert.deepEqual(candidate.$defs.sourceDesignTruth, SCHEMA.evidence.$defs.sourceDesignTruth);
      assert.deepEqual(candidate.$defs.observationReceipt, SCHEMA.evidence.$defs.observationReceipt);
      assert.deepEqual(candidate.$defs.teardownReceipt, SCHEMA.evidence.$defs.teardownReceipt);
      assert.deepEqual(candidate.$defs.custodianEnvelope, SCHEMA.evidence.$defs.custodianEnvelope);
      assert.deepEqual(candidate.$defs.finalComposite, SCHEMA.evidence.$defs.finalComposite);
      assert.deepEqual(candidate.$defs.zeroProof, SCHEMA.evidence.$defs.zeroProof);
    });
  }
});
