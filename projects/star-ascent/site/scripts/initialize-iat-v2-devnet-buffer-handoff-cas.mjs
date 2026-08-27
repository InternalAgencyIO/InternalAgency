#!/usr/bin/env node

import "./lib/iat-v2-attended-node-runtime.mjs";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = "/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1";
const PARENT = dirname(ROOT);
const ATTEMPTS = resolve(ROOT, "attempts");
const SENTINEL_PATH = resolve(ROOT, ".iat-v2-devnet-buffer-authority-cas-root.json");
const SENTINEL = Object.freeze({
  ceremonyId: "9e691e59-35c8-4861-86a0-7a219885b1c0",
  network: "devnet",
  schema: "iat-v2-devnet-buffer-authority-cas-root/v1",
});
const SENTINEL_TEXT = `${JSON.stringify(SENTINEL, null, 2)}\n`;
const EXPECTED_UID = 1000;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactDirectory(path) {
  const entry = lstatSync(path);
  check(entry.isDirectory() && !entry.isSymbolicLink(), `${path} is not an exact directory`);
  check((entry.mode & 0o7777) === 0o700, `${path} is not exact mode 0700`);
  check(entry.uid === EXPECTED_UID, `${path} is not owned by exact uid ${EXPECTED_UID}`);
  check(realpathSync(path) === path, `${path} resolves through a symlink`);
}

function verify() {
  check(typeof process.getuid === "function" && process.getuid() === EXPECTED_UID, `CAS verification requires exact uid ${EXPECTED_UID}`);
  exactDirectory(PARENT);
  exactDirectory(ROOT);
  exactDirectory(ATTEMPTS);
  const sentinel = lstatSync(SENTINEL_PATH);
  check(sentinel.isFile() && !sentinel.isSymbolicLink(), "CAS root sentinel is not a regular file");
  check((sentinel.mode & 0o7777) === 0o600, "CAS root sentinel is not exact mode 0600");
  check(sentinel.uid === EXPECTED_UID, `CAS root sentinel is not owned by exact uid ${EXPECTED_UID}`);
  check(sentinel.nlink === 1, "CAS root sentinel is not single-linked");
  check(readFileSync(SENTINEL_PATH, "utf8") === SENTINEL_TEXT, "CAS root sentinel bytes drifted");
  return Object.freeze({
    schema: "iat-v2-devnet-buffer-authority-cas-root-initialization/v1",
    status: "VERIFIED",
    root: ROOT,
    attempts: ATTEMPTS,
    sentinel: SENTINEL_PATH,
    ceremonyId: SENTINEL.ceremonyId,
    network: "devnet",
    transactionExecution: false,
    signing: false,
    broadcast: false,
  });
}

function initialize() {
  check(typeof process.getuid === "function" && process.getuid() === EXPECTED_UID, `CAS root initialization requires exact POSIX uid ${EXPECTED_UID}`);
  check(!existsSync(ROOT), "CAS root already exists; initialization is permanently one-use");
  check(existsSync(PARENT), "trusted CAS parent is missing and must be provisioned separately");
  exactDirectory(PARENT);
  const priorUmask = process.umask(0o077);
  try {
    mkdirSync(ROOT, { mode: 0o700 });
    mkdirSync(ATTEMPTS, { mode: 0o700 });
  } finally {
    process.umask(priorUmask);
  }
  let descriptor;
  try {
    descriptor = openSync(
      SENTINEL_PATH,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    const bytes = Buffer.from(SENTINEL_TEXT, "utf8");
    let offset = 0;
    while (offset < bytes.length) {
      offset += writeSync(descriptor, bytes, offset, bytes.length - offset);
    }
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  for (const path of [ATTEMPTS, ROOT, PARENT]) {
    const directory = openSync(path, constants.O_RDONLY);
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
  return verify();
}

const command = process.argv[2];
try {
  const result = command === "initialize"
    ? initialize()
    : command === "verify"
      ? verify()
      : (() => { throw new Error("usage: initialize-iat-v2-devnet-buffer-handoff-cas.mjs initialize|verify"); })();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schema: "iat-v2-devnet-buffer-authority-cas-root-error/v1",
    status: "HOLD",
    message: error instanceof Error ? error.message : String(error),
    transactionExecution: false,
    signing: false,
    broadcast: false,
  })}\n`);
  process.exitCode = 2;
}
