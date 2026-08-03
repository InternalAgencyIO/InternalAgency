from __future__ import annotations

import argparse
import hashlib
import json
from fractions import Fraction
from pathlib import Path

import av
from gradio_client import Client, handle_file


FPS = 30
DURATION_SECONDS = 15
FRAME_COUNT = FPS * DURATION_SECONDS
# FramePack emits 433 frames for a nominal 15-second request. Request one
# additional source second, then deterministically trim to the contracted 450
# frames in exact_15_second_master().
REQUEST_SECONDS = DURATION_SECONDS + 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Animate one World Series country finale into an exact 15-second MP4."
    )
    parser.add_argument("--source", required=True)
    parser.add_argument("--country", required=True)
    parser.add_argument("--batch", required=True, type=int)
    parser.add_argument("--source-image-number", required=True, type=int)
    prompt = parser.add_mutually_exclusive_group(required=True)
    prompt.add_argument("--prompt")
    prompt.add_argument("--prompt-file")
    parser.add_argument("--output")
    parser.add_argument("--server", default="http://127.0.0.1:7861")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--teacache", action="store_true")
    parser.add_argument(
        "--manifest",
        default="assets/lore/starlight-era/world-15s-video-manifest.json",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_video(path: Path) -> dict[str, object]:
    with av.open(str(path)) as container:
        streams = list(container.streams.video)
        if len(streams) != 1:
            raise RuntimeError(f"Expected exactly one video stream, found {len(streams)}")
        stream = streams[0]
        fps = float(stream.average_rate)
        width = stream.codec_context.width
        height = stream.codec_context.height
        frame_count = sum(1 for _ in container.decode(stream))
    duration = frame_count / fps
    return {
        "bytes": path.stat().st_size,
        "durationSeconds": round(duration, 3),
        "fps": round(fps, 3),
        "frameCount": frame_count,
        "width": width,
        "height": height,
        "sha256": sha256_file(path),
    }


def exact_15_second_master(generated: Path, output: Path) -> None:
    temporary = output.with_suffix(".tmp.mp4")
    if temporary.exists():
        temporary.unlink()

    with av.open(str(generated)) as source_container:
        source_stream = source_container.streams.video[0]
        width = source_stream.codec_context.width
        height = source_stream.codec_context.height
        if width % 2:
            width -= 1
        if height % 2:
            height -= 1

        with av.open(str(temporary), "w", format="mp4", options={"movflags": "+faststart"}) as output_container:
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


def resolve_repo_path(repo: Path, value: str) -> Path:
    candidate = Path(value)
    return candidate if candidate.is_absolute() else repo / candidate


def deterministic_seed(batch: int, country: str, source: Path) -> int:
    material = f"{batch}|{country}|{source.name}|world-15s-v1".encode("utf-8")
    return int(hashlib.sha256(material).hexdigest()[:8], 16) & 0x7FFFFFFF


def load_prompt(args: argparse.Namespace, repo: Path) -> str:
    if args.prompt is not None:
        return args.prompt.strip()
    prompt_path = resolve_repo_path(repo, args.prompt_file)
    return prompt_path.read_text(encoding="utf-8").strip()


def update_manifest(
    manifest_path: Path,
    *,
    batch: int,
    country: str,
    source: Path,
    source_image_number: int,
    output: Path,
    prompt: str,
    seed: int,
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    metadata = inspect_video(output)
    if metadata["frameCount"] != FRAME_COUNT:
        raise RuntimeError(f"Expected {FRAME_COUNT} frames, got {metadata['frameCount']}")
    if abs(float(metadata["fps"]) - FPS) > 0.01:
        raise RuntimeError(f"Expected {FPS} fps, got {metadata['fps']}")
    if abs(float(metadata["durationSeconds"]) - DURATION_SECONDS) > 0.01:
        raise RuntimeError(
            f"Expected {DURATION_SECONDS}s, got {metadata['durationSeconds']}s"
        )

    repo = Path(__file__).resolve().parents[2]
    source_relative = source.resolve().relative_to(repo.resolve()).as_posix()
    output_relative = output.resolve().relative_to(repo.resolve()).as_posix()
    record = {
        "batch": batch,
        "country": country,
        "sourceImageNumber": source_image_number,
        "sourceFile": source_relative,
        "sourceSha256": sha256_file(source),
        "file": output_relative,
        **metadata,
        "codec": "H.264",
        "pixelFormat": "yuv420p",
        "audio": False,
        "seed": seed,
        "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "status": "rendered",
        "xStatus": "eligible",
    }
    videos = [item for item in manifest.get("videos", []) if item["batch"] != batch]
    videos.append(record)
    manifest["videos"] = sorted(videos, key=lambda item: item["batch"])
    manifest["completedVideos"] = len(manifest["videos"])
    manifest["nextVideoBatch"] = batch + 1
    manifest["pendingVideo"] = None

    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(manifest_path)


def main() -> None:
    args = parse_args()
    repo = Path(__file__).resolve().parents[2]
    source = resolve_repo_path(repo, args.source)
    if not source.is_file():
        raise SystemExit(f"Missing source image: {source}")

    prompt = load_prompt(args, repo)
    if not prompt:
        raise SystemExit("Animation prompt is empty")
    seed = args.seed if args.seed is not None else deterministic_seed(
        args.batch, args.country, source
    )
    output = (
        resolve_repo_path(repo, args.output)
        if args.output
        else source.with_name(f"{source.stem}-15s.mp4")
    )
    output.parent.mkdir(parents=True, exist_ok=True)

    client = Client(args.server)
    negative_prompt = (
        "cuts, jump cut, camera shake, fast zoom, identity drift, face morphing, "
        "costume change, extra person, missing person, extra limbs, extra fingers, "
        "broken anatomy, cropped faces, cropped feet, text, logo, watermark"
    )
    result = client.predict(
        handle_file(str(source)),
        prompt,
        negative_prompt,
        seed,
        REQUEST_SECONDS,
        9,
        25,
        1.0,
        10.0,
        0.0,
        6.0,
        args.teacache,
        16,
        api_name="/process",
    )

    generated_result = result[0] if isinstance(result, (tuple, list)) else result
    if isinstance(generated_result, dict):
        generated_result = generated_result.get("video") or generated_result.get("path")
    if not generated_result:
        raise RuntimeError(f"FramePack did not return a video path: {result!r}")
    generated = Path(generated_result)
    if not generated.is_file():
        raise RuntimeError(f"FramePack output is missing: {generated}")

    exact_15_second_master(generated, output)
    manifest_path = resolve_repo_path(repo, args.manifest)
    update_manifest(
        manifest_path,
        batch=args.batch,
        country=args.country,
        source=source,
        source_image_number=args.source_image_number,
        output=output,
        prompt=prompt,
        seed=seed,
    )
    print(output)


if __name__ == "__main__":
    main()
