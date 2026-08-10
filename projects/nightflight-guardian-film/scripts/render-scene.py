from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from fractions import Fraction
from importlib import metadata as importlib_metadata
from pathlib import Path
from urllib.parse import urlparse

import av
from gradio_client import Client, handle_file
from PIL import Image


# Windows PowerShell commonly exposes a legacy cp1252 console. Gradio's client
# prints a Unicode check mark while connecting, so normalize both streams
# before any client output instead of requiring callers to set PYTHONUTF8.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


FPS = 30
DURATION_SECONDS = 15
FRAME_COUNT = FPS * DURATION_SECONDS
REQUEST_SECONDS = DURATION_SECONDS + 1
EXPECTED_SCENES = tuple(f"scene-{index:02d}" for index in range(1, 7))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Render one NIGHTFLIGHT keyframe through FramePack and create an exact "
            "450-frame, 15.000-second scene master."
        )
    )
    parser.add_argument("--repo-root")
    parser.add_argument("--scene", choices=EXPECTED_SCENES)
    parser.add_argument("--source")
    parser.add_argument("--prompt-file")
    parser.add_argument("--output")
    parser.add_argument("--metadata-output")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--server", default="http://127.0.0.1:7861")
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Exercise the exact-frame trimming contract without contacting FramePack.",
    )
    args = parser.parse_args()

    if args.self_test:
        return args

    required = (
        "repo_root",
        "scene",
        "source",
        "prompt_file",
        "output",
        "seed",
        "server",
    )
    missing = [name.replace("_", "-") for name in required if getattr(args, name) is None]
    if missing:
        parser.error("missing required arguments: " + ", ".join(f"--{name}" for name in missing))
    if not 0 <= args.seed <= 0x7FFFFFFF:
        parser.error("--seed must be between 0 and 2147483647")
    return args


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_version(name: str) -> str:
    try:
        return importlib_metadata.version(name)
    except importlib_metadata.PackageNotFoundError:
        return "unknown"


def resolve_repo_path(repo_root: Path, value: str, *, must_exist: bool = False) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = repo_root / candidate
    candidate = candidate.resolve(strict=must_exist)
    try:
        candidate.relative_to(repo_root)
    except ValueError as error:
        raise ValueError(f"Path must stay inside --repo-root: {candidate}") from error
    return candidate


def repo_relative(repo_root: Path, path: Path) -> str:
    return path.resolve().relative_to(repo_root).as_posix()


def validate_server_url(server: str) -> None:
    parsed = urlparse(server)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("--server must be a loopback HTTP URL; keyframes are never uploaded remotely")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("--server must not contain credentials, a query, or a fragment")


def validate_source_image(path: Path) -> dict[str, object]:
    if path.suffix.lower() != ".png":
        raise ValueError(f"Scene source must be a PNG: {path}")
    with Image.open(path) as image:
        width, height = image.size
        mode = image.mode
        image_format = image.format
    if image_format != "PNG":
        raise ValueError(f"Scene source has an unexpected format: {image_format}")
    if mode != "RGB":
        raise ValueError(f"Scene source must be opaque RGB, got {mode}: {path}")
    if width < 1280 or height < 720:
        raise ValueError(f"Scene source is too small for the production contract: {width}x{height}")
    if abs((width / height) - (16 / 9)) > 0.01:
        raise ValueError(f"Scene source must be 16:9, got {width}x{height}")
    return {"width": width, "height": height, "mode": mode, "format": image_format}


def inspect_video(path: Path) -> dict[str, object]:
    with av.open(str(path)) as container:
        streams = list(container.streams)
        video_streams = [stream for stream in streams if stream.type == "video"]
        if len(streams) != 1 or len(video_streams) != 1:
            raise RuntimeError(
                f"Expected one video-only stream, found {len(streams)} total streams in {path}"
            )
        stream = video_streams[0]
        fps = float(stream.average_rate)
        width = stream.codec_context.width
        height = stream.codec_context.height
        codec = stream.codec_context.name
        pixel_format = stream.codec_context.pix_fmt
        frame_count = sum(1 for _ in container.decode(stream))
    duration = frame_count / fps
    return {
        "bytes": path.stat().st_size,
        "codec": codec,
        "durationSeconds": round(duration, 6),
        "fps": round(fps, 6),
        "frameCount": frame_count,
        "height": height,
        "pixelFormat": pixel_format,
        "sha256": sha256_file(path),
        "width": width,
    }


def assert_scene_contract(metadata: dict[str, object]) -> None:
    if metadata["codec"] != "h264":
        raise RuntimeError(f"Expected H.264 output, got {metadata['codec']}")
    if metadata["pixelFormat"] != "yuv420p":
        raise RuntimeError(f"Expected yuv420p output, got {metadata['pixelFormat']}")
    if metadata["width"] != 832 or metadata["height"] != 480:
        raise RuntimeError(
            f"Expected the FramePack 16:9 bucket 832x480, got "
            f"{metadata['width']}x{metadata['height']}"
        )
    if metadata["frameCount"] != FRAME_COUNT:
        raise RuntimeError(f"Expected {FRAME_COUNT} frames, got {metadata['frameCount']}")
    if abs(float(metadata["fps"]) - FPS) > 0.001:
        raise RuntimeError(f"Expected {FPS} fps, got {metadata['fps']}")
    if abs(float(metadata["durationSeconds"]) - DURATION_SECONDS) > 0.001:
        raise RuntimeError(
            f"Expected {DURATION_SECONDS:.3f}s, got {metadata['durationSeconds']}s"
        )


def exact_15_second_master(generated: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.{os.getpid()}.tmp.mp4")
    if temporary.exists():
        temporary.unlink()

    try:
        with av.open(str(generated)) as source_container:
            source_streams = list(source_container.streams.video)
            if len(source_streams) != 1:
                raise RuntimeError(
                    f"FramePack result must contain one video stream, found {len(source_streams)}"
                )
            source_stream = source_streams[0]
            width = source_stream.codec_context.width - (source_stream.codec_context.width % 2)
            height = source_stream.codec_context.height - (source_stream.codec_context.height % 2)

            with av.open(
                str(temporary),
                "w",
                format="mp4",
                options={"movflags": "+faststart"},
            ) as output_container:
                output_stream = output_container.add_stream("libx264", rate=FPS)
                output_stream.width = width
                output_stream.height = height
                output_stream.pix_fmt = "yuv420p"
                output_stream.options = {"crf": "18", "preset": "medium"}

                written = 0
                for frame in source_container.decode(source_stream):
                    if written >= FRAME_COUNT:
                        break
                    normalized = frame.reformat(width=width, height=height, format="yuv420p")
                    normalized.pts = written
                    normalized.time_base = Fraction(1, FPS)
                    for packet in output_stream.encode(normalized):
                        output_container.mux(packet)
                    written += 1

                if written < FRAME_COUNT:
                    raise RuntimeError(
                        f"FramePack returned only {written} frames; {FRAME_COUNT} are required"
                    )
                for packet in output_stream.encode(None):
                    output_container.mux(packet)

        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()


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


def resolve_framepack_result(result: object) -> Path:
    value = result[0] if isinstance(result, (tuple, list)) else result
    if isinstance(value, dict):
        value = value.get("video") or value.get("path")
    if not value:
        raise RuntimeError(f"FramePack did not return a video path: {result!r}")
    generated = Path(str(value)).resolve(strict=True)
    if not generated.is_file():
        raise RuntimeError(f"FramePack output is missing: {generated}")
    return generated


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="nightflight-render-contract-") as directory:
        root = Path(directory)
        source = root / "source.mp4"
        output = root / "output.mp4"
        with av.open(str(source), "w", format="mp4") as container:
            stream = container.add_stream("libx264", rate=FPS)
            stream.width = 832
            stream.height = 480
            stream.pix_fmt = "yuv420p"
            for index in range(FRAME_COUNT + 5):
                frame = av.VideoFrame(832, 480, "yuv420p")
                for plane in frame.planes:
                    plane.update(bytes([index % 255]) * plane.buffer_size)
                frame.pts = index
                frame.time_base = Fraction(1, FPS)
                for packet in stream.encode(frame):
                    container.mux(packet)
            for packet in stream.encode(None):
                container.mux(packet)

        exact_15_second_master(source, output)
        metadata = inspect_video(output)
        assert_scene_contract(metadata)
    print("Render contract self-test passed: 832x480, 450 frames, 30 fps, 15.000 seconds.")


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return

    repo_root = Path(args.repo_root).resolve(strict=True)
    if not repo_root.is_dir():
        raise SystemExit(f"--repo-root is not a directory: {repo_root}")
    validate_server_url(args.server)

    source = resolve_repo_path(repo_root, args.source, must_exist=True)
    prompt_file = resolve_repo_path(repo_root, args.prompt_file, must_exist=True)
    output = resolve_repo_path(repo_root, args.output)
    metadata_output = resolve_repo_path(
        repo_root,
        args.metadata_output or str(Path(args.output).with_suffix(".json")),
    )
    if output.suffix.lower() != ".mp4":
        raise ValueError("--output must end in .mp4")
    if metadata_output.suffix.lower() != ".json":
        raise ValueError("--metadata-output must end in .json")
    if output == metadata_output:
        raise ValueError("Video and metadata outputs must be different paths")

    image_metadata = validate_source_image(source)
    prompt = prompt_file.read_text(encoding="utf-8").strip()
    if not prompt:
        raise ValueError(f"Prompt is empty: {prompt_file}")
    if "\x00" in prompt:
        raise ValueError(f"Prompt contains a NUL byte: {prompt_file}")

    client = Client(args.server)
    result = client.predict(
        handle_file(str(source)),
        prompt,
        "",
        args.seed,
        REQUEST_SECONDS,
        9,
        25,
        1.0,
        10.0,
        0.0,
        6.0,
        False,
        16,
        api_name="/process",
    )
    generated = resolve_framepack_result(result)
    exact_15_second_master(generated, output)
    output_metadata = inspect_video(output)
    assert_scene_contract(output_metadata)

    record: dict[str, object] = {
        "schemaVersion": 1,
        "scene": args.scene,
        "seed": args.seed,
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "source": {
            "file": repo_relative(repo_root, source),
            "bytes": source.stat().st_size,
            "sha256": sha256_file(source),
            **image_metadata,
        },
        "prompt": {
            "file": repo_relative(repo_root, prompt_file),
            "sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "utf8Bytes": len(prompt.encode("utf-8")),
        },
        "render": {
            "server": args.server,
            "requestSeconds": REQUEST_SECONDS,
            "targetSeconds": DURATION_SECONDS,
            "targetFrames": FRAME_COUNT,
            "fps": FPS,
            "latentWindowSize": 9,
            "steps": 25,
            "cfg": 1.0,
            "distilledCfg": 10.0,
            "cfgRescale": 0.0,
            "gpuMemoryPreservationGb": 6.0,
            "teaCache": False,
            "framePackCrf": 16,
        },
        "output": {
            "file": repo_relative(repo_root, output),
            **output_metadata,
        },
        "tools": {
            "python": sys.version.split()[0],
            "pyav": av.__version__,
            "gradioClient": package_version("gradio_client"),
        },
    }
    write_json_atomic(metadata_output, record)
    print(output)


if __name__ == "__main__":
    main()
