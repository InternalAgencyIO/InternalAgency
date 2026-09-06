#!/usr/bin/python3
"""Execute one hash-bound Linux executable from an immutable memfd image.

The caller must open the source executable itself and explicitly pass that
descriptor to this process. Target arguments begin only after an exact ``--``
delimiter. The target never inherits this launcher's ambient environment or
any descriptor that was not explicitly allowlisted.
"""

from __future__ import annotations

import sys


# This gate intentionally precedes every non-built-in import. Without both
# flags, Python can execute sitecustomize or import modules from caller-writable
# paths before this helper has a chance to bind or seal anything.
if not (
    sys.flags.isolated == 1
    and sys.flags.ignore_environment == 1
    and sys.flags.no_site == 1
    and sys.flags.no_user_site == 1
    and sys.flags.safe_path
):
    sys.stderr.write("HOLD: sealed executable launcher requires Python -I -S\n")
    raise SystemExit(126)

import errno
import fcntl
import hashlib
import os
import re
import stat
from dataclasses import dataclass


USAGE = """usage: python3 -I -S iat-v2-sealed-exec.py \\
  --source-fd FD --expected-sha256 HEX --expected-bytes BYTES \\
  [--env NAME=VALUE ...] [--inherit-fd FD ...] -- ARGV0 [ARG ...]

The source descriptor must already be open read-only as FD >= 3. The target
receives only the listed environment entries, standard descriptors 0, 1, and
2, and descriptors named by --inherit-fd. Only an ELF image is admitted, so
Linux never resolves a mutable shebang interpreter path. The original source
descriptor can never be inherited.
"""

_SHA256 = re.compile(r"[0-9a-f]{64}\Z", re.ASCII)
_POSITIVE_DECIMAL = re.compile(r"[1-9][0-9]*\Z", re.ASCII)
_ENVIRONMENT_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z", re.ASCII)
_MAX_EXPECTED_BYTES = (1 << 63) - 1
_MAX_DESCRIPTOR = (1 << 31) - 1
_CHUNK_BYTES = 1024 * 1024
_PROHIBITED_ENVIRONMENT_NAMES = frozenset(
    {
        "BASH_ENV",
        "ENV",
        "GCONV_PATH",
        "GLIBC_TUNABLES",
        "LD_AUDIT",
        "LD_LIBRARY_PATH",
        "LD_PRELOAD",
        "LOCPATH",
        "NODE_OPTIONS",
        "NODE_PATH",
        "PYTHONHOME",
        "PYTHONPATH",
        "PYTHONSTARTUP",
    }
)


class SealedExecHold(Exception):
    """A fail-closed launcher rejection safe to report to the operator."""


@dataclass(frozen=True)
class Invocation:
    source_fd: int
    expected_sha256: str
    expected_bytes: int
    argv: tuple[str, ...]
    environment: dict[str, str]
    inherit_fds: tuple[int, ...]


def _parse_positive_decimal(value: str, label: str) -> int:
    if _POSITIVE_DECIMAL.fullmatch(value) is None:
        raise SealedExecHold(f"{label} is not a canonical positive decimal")
    number = int(value, 10)
    if number > _MAX_EXPECTED_BYTES:
        raise SealedExecHold(f"{label} exceeds the supported range")
    return number


def _parse_descriptor(value: str, label: str) -> int:
    if _POSITIVE_DECIMAL.fullmatch(value) is None:
        raise SealedExecHold(f"{label} is not a canonical positive decimal")
    descriptor = int(value, 10)
    if descriptor > _MAX_DESCRIPTOR:
        raise SealedExecHold(f"{label} exceeds the supported range")
    return descriptor


def _parse_invocation(arguments: list[str]) -> Invocation:
    single: dict[str, str] = {}
    environment: dict[str, str] = {}
    inherit_fds: list[int] = []
    allowed_single = frozenset({"source-fd", "expected-sha256", "expected-bytes"})
    try:
        delimiter = arguments.index("--")
    except ValueError as error:
        raise SealedExecHold("the child-argv delimiter is missing") from error
    launcher_arguments = arguments[:delimiter]
    target_arguments = arguments[delimiter + 1:]
    if not target_arguments or not target_arguments[0]:
        raise SealedExecHold("target argv[0] must not be empty")

    index = 0
    while index < len(launcher_arguments):
        name = launcher_arguments[index]
        if name not in {
            "--source-fd",
            "--expected-sha256",
            "--expected-bytes",
            "--env",
            "--inherit-fd",
        }:
            raise SealedExecHold("an unknown launcher option was supplied")
        if index + 1 >= len(launcher_arguments):
            raise SealedExecHold("a launcher option value is missing")
        value = launcher_arguments[index + 1]
        index += 2
        option_name = name[2:]
        if option_name in allowed_single:
            if option_name in single:
                raise SealedExecHold(f"duplicate --{option_name} option")
            single[option_name] = value
            continue
        if option_name == "env":
            environment_name, separator, environment_value = value.partition("=")
            if not separator or _ENVIRONMENT_NAME.fullmatch(environment_name) is None:
                raise SealedExecHold("an environment entry is malformed")
            if environment_name in environment:
                raise SealedExecHold("an environment name was supplied more than once")
            if environment_name in _PROHIBITED_ENVIRONMENT_NAMES \
                    or environment_name.startswith(("DYLD_", "LD_")):
                raise SealedExecHold("an environment name can alter executable loading")
            environment[environment_name] = environment_value
            continue
        inherit_fd = _parse_descriptor(value, "inherited descriptor")
        if inherit_fd < 3:
            raise SealedExecHold("inherited descriptors must be FD 3 or greater")
        if inherit_fd in inherit_fds:
            raise SealedExecHold("an inherited descriptor was supplied more than once")
        inherit_fds.append(inherit_fd)

    if set(single) != allowed_single:
        raise SealedExecHold("the exact required launcher options were not supplied")
    if _SHA256.fullmatch(single["expected-sha256"]) is None:
        raise SealedExecHold("expected SHA-256 is not canonical lowercase hexadecimal")
    source_fd = _parse_descriptor(single["source-fd"], "source descriptor")
    if source_fd < 3:
        raise SealedExecHold("source descriptor must be FD 3 or greater")
    if source_fd in inherit_fds:
        raise SealedExecHold("source descriptor cannot be inherited by the target")
    expected_bytes = _parse_positive_decimal(
        single["expected-bytes"], "expected byte length"
    )

    return Invocation(
        source_fd=source_fd,
        expected_sha256=single["expected-sha256"],
        expected_bytes=expected_bytes,
        argv=tuple(target_arguments),
        environment=environment,
        inherit_fds=tuple(inherit_fds),
    )


def _stable_identity(file_status: os.stat_result) -> tuple[int, ...]:
    return (
        file_status.st_dev,
        file_status.st_ino,
        file_status.st_mode,
        file_status.st_nlink,
        file_status.st_uid,
        file_status.st_gid,
        file_status.st_size,
        file_status.st_mtime_ns,
        file_status.st_ctime_ns,
    )


def _write_all(descriptor: int, value: bytes) -> None:
    view = memoryview(value)
    while view:
        written = os.write(descriptor, view)
        if written <= 0:
            raise SealedExecHold("sealed image copy made no forward progress")
        view = view[written:]


def _copy_verified_source(invocation: Invocation, sealed_fd: int) -> None:
    try:
        source_flags = fcntl.fcntl(invocation.source_fd, fcntl.F_GETFL)
        before = os.fstat(invocation.source_fd)
    except OSError as error:
        raise SealedExecHold("source executable descriptor is unavailable") from error

    if source_flags & os.O_ACCMODE != os.O_RDONLY:
        raise SealedExecHold("source executable descriptor is not read-only")
    if not stat.S_ISREG(before.st_mode):
        raise SealedExecHold("source executable descriptor is not a regular file")
    if before.st_mode & 0o111 == 0:
        raise SealedExecHold("source executable descriptor is not executable")
    if before.st_size != invocation.expected_bytes:
        raise SealedExecHold("source executable byte length did not match")
    try:
        magic = os.pread(invocation.source_fd, 4, 0)
    except OSError as error:
        raise SealedExecHold("source executable header could not be read") from error
    if magic != b"\x7fELF":
        raise SealedExecHold("source executable is not an ELF image")

    digest = hashlib.sha256()
    offset = 0
    while offset < invocation.expected_bytes:
        try:
            chunk = os.pread(
                invocation.source_fd,
                min(_CHUNK_BYTES, invocation.expected_bytes - offset),
                offset,
            )
        except OSError as error:
            raise SealedExecHold("source executable could not be read") from error
        if not chunk:
            raise SealedExecHold("source executable ended before its bound byte length")
        digest.update(chunk)
        _write_all(sealed_fd, chunk)
        offset += len(chunk)

    try:
        trailing = os.pread(invocation.source_fd, 1, invocation.expected_bytes)
        after = os.fstat(invocation.source_fd)
    except OSError as error:
        raise SealedExecHold("source executable could not be revalidated") from error
    if trailing:
        raise SealedExecHold("source executable exceeds its bound byte length")
    if _stable_identity(after) != _stable_identity(before):
        raise SealedExecHold("source executable identity changed while copying")
    if digest.hexdigest() != invocation.expected_sha256:
        raise SealedExecHold("source executable SHA-256 did not match")


def _required_seals() -> int:
    names = (
        "F_ADD_SEALS",
        "F_GET_SEALS",
        "F_SEAL_SEAL",
        "F_SEAL_SHRINK",
        "F_SEAL_GROW",
        "F_SEAL_WRITE",
    )
    if any(not hasattr(fcntl, name) for name in names):
        raise SealedExecHold("Linux immutable memfd seals are unavailable")
    return (
        fcntl.F_SEAL_SEAL
        | fcntl.F_SEAL_SHRINK
        | fcntl.F_SEAL_GROW
        | fcntl.F_SEAL_WRITE
    )


def _seal_and_revalidate(
    sealed_fd: int, expected_sha256: str, expected_bytes: int
) -> None:
    required = _required_seals()
    try:
        os.fchmod(sealed_fd, 0o500)
        os.fsync(sealed_fd)
        fcntl.fcntl(sealed_fd, fcntl.F_ADD_SEALS, required)
        observed_seals = fcntl.fcntl(sealed_fd, fcntl.F_GET_SEALS)
    except OSError as error:
        raise SealedExecHold("sealed executable could not be made immutable") from error
    if observed_seals & required != required:
        raise SealedExecHold("sealed executable immutable seals were not all applied")

    try:
        first_byte = os.pread(sealed_fd, 1, 0)
        os.pwrite(sealed_fd, first_byte, 0)
    except OSError as error:
        if error.errno != errno.EPERM:
            raise SealedExecHold("sealed executable rejected an immutability probe unexpectedly") from error
    else:
        raise SealedExecHold("sealed executable remained writable after sealing")

    digest = hashlib.sha256()
    offset = 0
    while offset < expected_bytes:
        try:
            chunk = os.pread(
                sealed_fd, min(_CHUNK_BYTES, expected_bytes - offset), offset
            )
        except OSError as error:
            raise SealedExecHold("sealed executable could not be rehashed") from error
        if not chunk:
            raise SealedExecHold("sealed executable ended during rehash")
        digest.update(chunk)
        offset += len(chunk)
    try:
        final_status = os.fstat(sealed_fd)
        final_seals = fcntl.fcntl(sealed_fd, fcntl.F_GET_SEALS)
    except OSError as error:
        raise SealedExecHold("sealed executable could not be finally verified") from error
    if final_status.st_size != expected_bytes or not stat.S_ISREG(final_status.st_mode):
        raise SealedExecHold("sealed executable metadata drifted")
    if final_seals & required != required:
        raise SealedExecHold("sealed executable lost an immutable seal")
    if digest.hexdigest() != expected_sha256:
        raise SealedExecHold("sealed executable SHA-256 did not match after sealing")


def _observe_inherited_descriptors(
    inherited_fds: tuple[int, ...], sealed_fd: int | None = None
) -> dict[int, tuple[int, ...]]:
    identities: dict[int, tuple[int, ...]] = {}
    for descriptor in inherited_fds:
        if descriptor == sealed_fd:
            raise SealedExecHold("an inherited descriptor collided with the sealed image")
        try:
            status = os.fstat(descriptor)
            inheritable = os.get_inheritable(descriptor)
        except OSError as error:
            raise SealedExecHold("an allowlisted inherited descriptor is unavailable") from error
        if not inheritable:
            raise SealedExecHold("an allowlisted descriptor is close-on-exec")
        identities[descriptor] = _stable_identity(status)
    return identities


def _close_unrelated_descriptors(
    sealed_fd: int,
    inherited_identities: dict[int, tuple[int, ...]],
) -> None:
    try:
        descriptor_names = os.listdir("/proc/self/fd")
    except OSError as error:
        raise SealedExecHold("Linux descriptor inventory is unavailable") from error
    for name in descriptor_names:
        if not name.isdecimal():
            raise SealedExecHold("Linux descriptor inventory contained a noncanonical entry")
        descriptor = int(name, 10)
        if descriptor <= 2 or descriptor == sealed_fd \
                or descriptor in inherited_identities:
            continue
        try:
            os.close(descriptor)
        except OSError as error:
            if error.errno != errno.EBADF:
                raise SealedExecHold("an unrelated descriptor could not be closed") from error
    observed = _observe_inherited_descriptors(
        tuple(inherited_identities), sealed_fd=sealed_fd
    )
    if observed != inherited_identities:
        raise SealedExecHold("an allowlisted inherited descriptor identity changed")


def _prepare_exec_descriptor(sealed_fd: int) -> None:
    try:
        observed_inheritable = os.get_inheritable(sealed_fd)
        seals = fcntl.fcntl(sealed_fd, fcntl.F_GET_SEALS)
    except OSError as error:
        raise SealedExecHold("sealed executable descriptor could not be prepared") from error
    if observed_inheritable:
        raise SealedExecHold("sealed executable inheritance policy drifted")
    if seals & _required_seals() != _required_seals():
        raise SealedExecHold("sealed executable lost an immutable seal before exec")


def _build_sealed_image(invocation: Invocation) -> tuple[int, dict[int, tuple[int, ...]]]:
    if sys.platform != "linux" or not hasattr(os, "memfd_create") \
            or not hasattr(os, "MFD_ALLOW_SEALING"):
        raise SealedExecHold("Linux executable memfd support is unavailable")
    try:
        source_status = os.fstat(invocation.source_fd)
    except (OSError, OverflowError) as error:
        raise SealedExecHold("source executable descriptor is unavailable") from error
    inherited_identities = _observe_inherited_descriptors(invocation.inherit_fds)
    source_object = (source_status.st_dev, source_status.st_ino)
    if any(identity[:2] == source_object for identity in inherited_identities.values()):
        raise SealedExecHold("an inherited descriptor aliases the source executable")
    for standard_descriptor in range(3):
        try:
            standard_status = os.fstat(standard_descriptor)
        except OSError as error:
            if error.errno == errno.EBADF:
                continue
            raise SealedExecHold("a standard descriptor could not be verified") from error
        if (standard_status.st_dev, standard_status.st_ino) == source_object:
            raise SealedExecHold("a standard descriptor aliases the source executable")
    try:
        sealed_fd = os.memfd_create(
            "iat-v2-sealed-exec",
            flags=os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING,
        )
    except OSError as error:
        raise SealedExecHold("sealed executable memfd could not be created") from error
    try:
        _copy_verified_source(invocation, sealed_fd)
        os.close(invocation.source_fd)
        _seal_and_revalidate(
            sealed_fd, invocation.expected_sha256, invocation.expected_bytes
        )
        if os.get_inheritable(sealed_fd):
            raise SealedExecHold("sealed executable descriptor is unexpectedly inheritable")
        return sealed_fd, inherited_identities
    except BaseException:
        os.close(sealed_fd)
        raise


def main(arguments: list[str]) -> int:
    if arguments == ["--help"]:
        sys.stdout.write(USAGE)
        return 0
    invocation = _parse_invocation(arguments)
    sealed_fd, inherited_identities = _build_sealed_image(invocation)
    try:
        _close_unrelated_descriptors(sealed_fd, inherited_identities)
        _prepare_exec_descriptor(sealed_fd)
        if os.execve not in os.supports_fd:
            raise SealedExecHold("descriptor-based exec is unavailable")
        os.execve(
            sealed_fd,
            list(invocation.argv),
            dict(invocation.environment),
        )
    except BaseException:
        os.close(sealed_fd)
        raise
    raise AssertionError("descriptor exec returned unexpectedly")


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except SealedExecHold as error:
        sys.stderr.write(f"HOLD: {error}\n")
        raise SystemExit(126) from None
    except (OSError, OverflowError, ValueError):
        sys.stderr.write("HOLD: sealed executable launcher failed closed\n")
        raise SystemExit(126) from None
