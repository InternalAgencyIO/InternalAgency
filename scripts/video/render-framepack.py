from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from gradio_client import Client, handle_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render one Radiance scene through FramePack.")
    parser.add_argument("--scene", required=True)
    parser.add_argument("--server", default="http://127.0.0.1:7861")
    parser.add_argument("--duration", type=float, help="Override duration for a proof render.")
    parser.add_argument("--teacache", action="store_true", help="Faster draft with lower motion fidelity.")
    return parser.parse_args()


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
    print(output)


if __name__ == "__main__":
    main()
