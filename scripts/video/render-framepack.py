from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import av
from gradio_client import Client, handle_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render one Radiance scene through FramePack.")
    parser.add_argument("--scene", required=True)
    parser.add_argument("--server", default="http://127.0.0.1:7861")
    parser.add_argument("--duration", type=float, help="Override duration for a proof render.")
    parser.add_argument("--teacache", action="store_true", help="Faster draft with lower motion fidelity.")
    return parser.parse_args()


def inspect_video(path: Path) -> dict[str, object]:
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        fps = float(stream.average_rate)
        frame_count = sum(1 for _ in container.decode(stream))
        duration = frame_count / fps

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return {
        "bytes": path.stat().st_size,
        "durationSeconds": round(duration, 3),
        "fps": round(fps, 3),
        "frameCount": frame_count,
        "sha256": digest.hexdigest(),
    }


def update_manifest(output_dir: Path, output: Path, scene: dict, suffix: str) -> None:
    manifest_path = output_dir / "manifest.json"
    manifest = {"version": 1, "assets": {}}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    metadata = inspect_video(output)
    if abs(float(metadata["fps"]) - 30.0) > 0.01:
        raise RuntimeError(f"Expected 30 fps, got {metadata['fps']} fps: {output}")

    manifest.setdefault("assets", {})[output.name] = {
        **metadata,
        "scene": scene["id"],
        "rendition": suffix,
        "source": scene["source"],
    }
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(manifest_path)


def main() -> None:
    args = parse_args()
    repo = Path(__file__).resolve().parents[2]
    config = json.loads((Path(__file__).parent / "scenes.json").read_text(encoding="utf-8"))
    scene = next((item for item in config["scenes"] if item["id"] == args.scene), None)
    if scene is None:
        raise SystemExit(f"Unknown scene: {args.scene}")

    source = repo / scene["source"]
    duration = args.duration or scene["durationSeconds"]
    client = Client(args.server)
    result = client.predict(
        handle_file(str(source)),
        scene["prompt"],
        config["negativePrompt"],
        scene["seed"],
        duration,
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

    generated = Path(result[0] if isinstance(result, (tuple, list)) else result)
    output_dir = repo / "assets" / "videos"
    output_dir.mkdir(parents=True, exist_ok=True)
    suffix = "draft" if args.duration else "full"
    output = output_dir / f"{scene['id']}-{suffix}-30fps.mp4"
    shutil.copy2(generated, output)
    update_manifest(output_dir, output, scene, suffix)
    print(output)


if __name__ == "__main__":
    main()
