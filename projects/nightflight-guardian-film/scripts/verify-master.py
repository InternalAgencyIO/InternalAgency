from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from decimal import Decimal
from fractions import Fraction
from pathlib import Path


EXPECTED_WIDTH = 3840
EXPECTED_HEIGHT = 2160
EXPECTED_FPS = Fraction(30, 1)
EXPECTED_FRAMES = 2700
EXPECTED_DURATION = Decimal("90.000")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the final NIGHTFLIGHT 4K master contract.")
    parser.add_argument("--ffprobe")
    parser.add_argument("--master")
    parser.add_argument("--metadata-output")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if not args.self_test:
        if not args.ffprobe:
            parser.error("--ffprobe is required")
        if not args.master:
            parser.error("--master is required")
    return args


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_rate(value: object) -> Fraction:
    if not isinstance(value, str) or value in {"", "0/0", "N/A"}:
        raise ValueError(f"Invalid frame rate: {value!r}")
    return Fraction(value)


def validate_probe(payload: dict[str, object]) -> dict[str, object]:
    streams = payload.get("streams")
    if not isinstance(streams, list) or len(streams) != 1:
        raise ValueError("Master must contain exactly one stream and no audio, subtitle, or data streams")
    stream = streams[0]
    if not isinstance(stream, dict) or stream.get("codec_type") != "video":
        raise ValueError("The only master stream must be video")
    if stream.get("codec_name") != "h264":
        raise ValueError(f"Expected H.264, got {stream.get('codec_name')}")
    if int(stream.get("width", 0)) != EXPECTED_WIDTH or int(stream.get("height", 0)) != EXPECTED_HEIGHT:
        raise ValueError(
            f"Expected {EXPECTED_WIDTH}x{EXPECTED_HEIGHT}, got "
            f"{stream.get('width')}x{stream.get('height')}"
        )
    if stream.get("pix_fmt") != "yuv420p":
        raise ValueError(f"Expected yuv420p, got {stream.get('pix_fmt')}")

    average_rate = parse_rate(stream.get("avg_frame_rate"))
    real_rate = parse_rate(stream.get("r_frame_rate"))
    if average_rate != EXPECTED_FPS or real_rate != EXPECTED_FPS:
        raise ValueError(f"Expected exact 30/1 fps, got avg={average_rate}, real={real_rate}")

    frame_value = stream.get("nb_read_frames")
    if frame_value in {None, "N/A"}:
        raise ValueError("ffprobe did not report nb_read_frames")
    frames = int(str(frame_value))
    if frames != EXPECTED_FRAMES:
        raise ValueError(f"Expected {EXPECTED_FRAMES} frames, got {frames}")

    format_payload = payload.get("format")
    if not isinstance(format_payload, dict):
        raise ValueError("ffprobe did not report format metadata")
    duration_value = format_payload.get("duration")
    if duration_value in {None, "N/A"}:
        raise ValueError("ffprobe did not report a format duration")
    duration = Decimal(str(duration_value))
    if abs(duration - EXPECTED_DURATION) > Decimal("0.001"):
        raise ValueError(f"Expected 90.000 seconds, got {duration}")

    return {
        "codec": "h264",
        "durationSeconds": float(duration),
        "fps": 30,
        "frameCount": frames,
        "height": EXPECTED_HEIGHT,
        "pixelFormat": "yuv420p",
        "streamCount": 1,
        "videoOnly": True,
        "width": EXPECTED_WIDTH,
    }


def run_ffprobe(ffprobe: Path, master: Path) -> tuple[dict[str, object], str]:
    command = [
        str(ffprobe),
        "-v",
        "error",
        "-count_frames",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        str(master),
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"ffprobe failed ({completed.returncode}): {completed.stderr.strip()}")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"ffprobe returned invalid JSON: {error}") from error

    version = subprocess.run(
        [str(ffprobe), "-version"],
        check=False,
        capture_output=True,
        text=True,
    )
    first_line = version.stdout.splitlines()[0] if version.stdout else "unknown"
    return payload, first_line


def write_json_atomic(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def self_test() -> None:
    fixture: dict[str, object] = {
        "streams": [
            {
                "codec_name": "h264",
                "codec_type": "video",
                "width": EXPECTED_WIDTH,
                "height": EXPECTED_HEIGHT,
                "pix_fmt": "yuv420p",
                "avg_frame_rate": "30/1",
                "r_frame_rate": "30/1",
                "nb_read_frames": str(EXPECTED_FRAMES),
            }
        ],
        "format": {"duration": "90.000000"},
    }
    validated = validate_probe(fixture)
    assert validated["frameCount"] == EXPECTED_FRAMES

    rejected = json.loads(json.dumps(fixture))
    rejected["streams"].append({"codec_type": "audio", "codec_name": "aac"})
    try:
        validate_probe(rejected)
    except ValueError:
        pass
    else:
        raise AssertionError("Video-only validation did not reject an audio stream")
    print("Master verifier self-test passed.")


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return

    ffprobe = Path(args.ffprobe).resolve(strict=True)
    master = Path(args.master).resolve(strict=True)
    if not ffprobe.is_file():
        raise SystemExit(f"ffprobe is not a file: {ffprobe}")
    if not master.is_file():
        raise SystemExit(f"Master is not a file: {master}")

    payload, ffprobe_version = run_ffprobe(ffprobe, master)
    contract = validate_probe(payload)
    record: dict[str, object] = {
        "schemaVersion": 1,
        "verifiedAtUtc": datetime.now(timezone.utc).isoformat(),
        "file": master.name,
        "bytes": master.stat().st_size,
        "sha256": sha256_file(master),
        "contract": contract,
        "ffprobe": ffprobe_version,
    }
    if args.metadata_output:
        write_json_atomic(Path(args.metadata_output).resolve(), record)
    print(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
